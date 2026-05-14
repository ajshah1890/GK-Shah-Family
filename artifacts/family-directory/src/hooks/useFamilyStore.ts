import { useState, useEffect, useMemo } from 'react';
import { FamilyMember, SAMPLE_MEMBERS } from '../types/family';
import {
  rebuildChildrenArrays,
  repairMissingLineageRoots,
  wouldCreateCircularAncestry,
} from '../lib/familyTree';
import { logAudit, diffMembers } from '../lib/auditLog';
import { loadFromGitHub } from './useGitHubSync';
import { checkAndClearPostResetFlag, logHydration } from '../lib/hardReset';

const STORAGE_KEY = 'gkshah_family_members';
const SCHEMA_VERSION = 2;

// ─── Stored format ────────────────────────────────────────────────────────────

interface StoredData {
  version: number;
  members: FamilyMember[];
}

// ─── Module-level undo snapshot ───────────────────────────────────────────────

let _undoSnapshot: FamilyMember[] | null = null;

// ─── Lineage root resolution ──────────────────────────────────────────────────

function resolveLineageRoot(m: any, allById: Map<string, any>): string | undefined {
  const visited = new Set<string>();
  let cur = m;
  while (cur) {
    if (visited.has(cur.id)) break;
    visited.add(cur.id);
    const parentId = cur.fatherId || cur.motherId;
    if (!parentId) return cur.id;
    const parent = allById.get(parentId);
    if (!parent) return cur.id;
    cur = parent;
  }
  return cur?.id;
}

// ─── memberId generation ──────────────────────────────────────────────────────

function generateMemberId(gen: number | undefined, seqByGen: Record<number, number>): string {
  const g = gen ?? 0;
  seqByGen[g] = (seqByGen[g] ?? 0) + 1;
  return `GK-G${g}-${String(seqByGen[g]).padStart(4, '0')}`;
}

// ─── Migration ────────────────────────────────────────────────────────────────

function migrateMembers(raw: any[]): FamilyMember[] {
  const allById = new Map(raw.map(m => [m.id, m]));

  const seqByGen: Record<number, number> = {};
  const sorted = [...raw].sort(
    (a, b) =>
      (a.generationNumber ?? 99) - (b.generationNumber ?? 99) ||
      (a.siblingOrder ?? 99) - (b.siblingOrder ?? 99)
  );
  const newMemberIds: Record<string, string> = {};
  sorted.forEach(m => {
    if (!m.memberId) {
      newMemberIds[m.id] = generateMemberId(m.generationNumber, seqByGen);
    } else {
      const g = m.generationNumber ?? 0;
      const seq = parseInt(m.memberId.split('-').pop() ?? '0', 10);
      if (!isNaN(seq) && seq > (seqByGen[g] ?? 0)) seqByGen[g] = seq;
    }
  });

  const migrated = raw.map((m): FamilyMember => {
    const out = { ...m };
    delete out.relationship;
    if (m.familyBranch && !m.mainFamilyBranch) {
      out.mainFamilyBranch = m.familyBranch;
    }
    delete out.familyBranch;

    if (!out.memberId) out.memberId = newMemberIds[m.id];
    if (!out.lineageRootId) out.lineageRootId = resolveLineageRoot(m, allById);
    if (out.generationNumber !== undefined) {
      const n = Number(out.generationNumber);
      out.generationNumber = isNaN(n) ? undefined : n;
    }
    if (out.siblingOrder !== undefined) {
      const n = Number(out.siblingOrder);
      out.siblingOrder = isNaN(n) ? undefined : n;
    }
    if (typeof out.childrenNames === 'string') {
      out.childrenNames = out.childrenNames
        .split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    return out;
  });

  return rebuildChildrenArrays(repairMissingLineageRoots(migrated));
}

function load(): FamilyMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const members = Array.isArray(parsed) ? parsed : (parsed as StoredData).members;
    return migrateMembers(members);
  } catch {
    return [];
  }
}

function save(members: FamilyMember[]) {
  try {
    const data: StoredData = { version: SCHEMA_VERSION, members };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage quota exceeded — data remains in memory
  }
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

export interface DuplicateCandidate {
  member: FamilyMember;
  reasons: string[];
}

export function detectPotentialDuplicates(
  candidate: { fullName?: string; phone?: string; birthday?: string },
  existing: FamilyMember[],
  excludeId?: string
): DuplicateCandidate[] {
  const results: DuplicateCandidate[] = [];
  for (const m of existing) {
    if (m.id === excludeId) continue;
    const reasons: string[] = [];
    if (candidate.fullName && m.fullName.toLowerCase() === candidate.fullName.toLowerCase()) {
      reasons.push("Same full name");
    }
    if (candidate.phone && m.phone && candidate.phone.replace(/\D/g, '') === m.phone.replace(/\D/g, '')) {
      reasons.push("Same phone number");
    }
    if (candidate.birthday && m.birthday && candidate.birthday === m.birthday && reasons.length > 0) {
      reasons.push("Same birthday");
    }
    if (reasons.length > 0) results.push({ member: m, reasons });
  }
  return results;
}

// ─── Next memberId for a given generation ─────────────────────────────────────

function nextMemberIdForGen(gen: number | undefined, members: FamilyMember[]): string {
  const g = gen ?? 0;
  const existing = members
    .filter(m => m.memberId?.startsWith(`GK-G${g}-`))
    .map(m => parseInt(m.memberId!.split('-').pop() ?? '0', 10))
    .filter(n => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `GK-G${g}-${String(max + 1).padStart(4, '0')}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFamilyStore() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasUndo, setHasUndo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Post-reset guard — module-level cache in hardReset.ts ensures ALL stores
      // (useFamilyStore, useMomentsStore) see the same result for this page load
      // even though each calls checkAndClearPostResetFlag() independently.
      if (checkAndClearPostResetFlag()) {
        logHydration("Members loaded from: RESET — showing 0 members (GitHub restore blocked)");
        if (!cancelled) { setMembers([]); setIsLoaded(true); }
        return;
      }

      // 1. Show localStorage data immediately so the UI is not blank
      const local = load();
      if (local.length > 0 && !cancelled) {
        logHydration(`Members loaded from: localStorage (${local.length} member${local.length !== 1 ? "s" : ""} — showing while GitHub loads)`);
        setMembers(local);
        setIsLoaded(true);
      }

      // 2. Try GitHub (authoritative source)
      try {
        const remote = await loadFromGitHub<{ version?: number; members?: any[] } | any[]>("members");
        if (cancelled) return;

        if (remote !== null) {
          const raw = Array.isArray(remote)
            ? remote
            : (remote as { members?: any[] }).members ?? [];

          if (raw.length > 0) {
            const migrated = migrateMembers(raw);
            logHydration(`Members loaded from: GitHub (${migrated.length} member${migrated.length !== 1 ? "s" : ""})`);
            setMembers(migrated);
            save(migrated);
            setIsLoaded(true);
            return;
          }

          // GitHub returned 0 members — directory is legitimately empty (e.g. post-reset).
          // DO NOT fall back to local or sample data.
          logHydration("Members loaded from: GitHub (returned 0 members — directory is empty)");
          setMembers([]);
          setIsLoaded(true);
          return;
        }

        // null = GitHub unreachable (network error or non-OK HTTP response)
        logHydration(`Members loaded from: localStorage (${local.length} member${local.length !== 1 ? "s" : ""} — GitHub unreachable)`);
      } catch {
        logHydration(`Members loaded from: localStorage (${local.length} member${local.length !== 1 ? "s" : ""} — GitHub threw)`);
      }

      // 3. GitHub unavailable — keep showing local data (already set above).
      //    If localStorage is also empty, show an empty directory.
      //    DO NOT seed SAMPLE_MEMBERS.
      if (!cancelled) {
        if (local.length === 0) {
          logHydration("Members loaded from: empty (no localStorage data, GitHub unreachable)");
        }
        setIsLoaded(true);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const saveMembers = (next: FamilyMember[]) => {
    setMembers(next);
    save(next);
  };

  const saveUndoSnapshot = (current: FamilyMember[]) => {
    _undoSnapshot = [...current];
    setHasUndo(true);
  };

  const undoLastAction = () => {
    if (!_undoSnapshot) return;
    saveMembers(_undoSnapshot);
    _undoSnapshot = null;
    setHasUndo(false);
  };

  // ── Validation helpers ──────────────────────────────────────────────────────

  function validateRelationship(
    memberId: string | undefined,
    fatherId: string | undefined,
    motherId: string | undefined,
    spouseId: string | undefined
  ): string | null {
    const id = memberId ?? "__new__";
    if (fatherId && fatherId === id) return "A member cannot be their own father.";
    if (motherId && motherId === id) return "A member cannot be their own mother.";
    if (spouseId && spouseId === id) return "A member cannot be their own spouse.";
    if (fatherId && spouseId && fatherId === spouseId) return "Father and spouse cannot be the same person.";
    if (motherId && spouseId && motherId === spouseId) return "Mother and spouse cannot be the same person.";
    if (id !== "__new__") {
      if (fatherId && wouldCreateCircularAncestry(id, fatherId, members)) {
        return "Selecting this father would create a circular ancestry loop.";
      }
      if (motherId && wouldCreateCircularAncestry(id, motherId, members)) {
        return "Selecting this mother would create a circular ancestry loop.";
      }
    }
    return null;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const addMember = (member: Omit<FamilyMember, 'id'>): { member: FamilyMember; error?: string } => {
    const validationError = validateRelationship(
      undefined, member.fatherId, member.motherId, member.spouseId
    );
    if (validationError) return { member: {} as FamilyMember, error: validationError };

    const allById = new Map(members.map(m => [m.id, m]));
    const id = crypto.randomUUID();

    let lineageRootId = member.lineageRootId;
    if (!lineageRootId) {
      const parentId = member.fatherId || member.motherId;
      lineageRootId = parentId
        ? (resolveLineageRoot(allById.get(parentId), allById) ?? parentId)
        : id;
    }

    let generationNumber = member.generationNumber;
    if (!generationNumber) {
      const parentId = member.fatherId || member.motherId;
      const parent = parentId ? allById.get(parentId) : undefined;
      if (parent?.generationNumber) generationNumber = parent.generationNumber + 1;
    }

    const memberId = member.memberId || nextMemberIdForGen(generationNumber, members);
    const now = new Date().toISOString();

    const newMember: FamilyMember = {
      ...member,
      id,
      memberId,
      lineageRootId,
      generationNumber,
      addedAt: now,
      updatedAt: now,
    };

    const next = rebuildChildrenArrays([...members, newMember]);
    saveMembers(next);

    logAudit({
      action: 'create',
      memberId: id,
      memberName: member.fullName,
      timestamp: now,
    });

    return { member: next.find(m => m.id === id)! };
  };

  const updateMember = (id: string, updates: Partial<FamilyMember>): { error?: string } => {
    const validationError = validateRelationship(
      id, updates.fatherId, updates.motherId, updates.spouseId
    );
    if (validationError) return { error: validationError };

    const allById = new Map(members.map(m => [m.id, m]));
    const existing = allById.get(id);
    if (!existing) return { error: "Member not found" };

    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() } as FamilyMember;

    const parentChanged =
      updates.fatherId !== undefined || updates.motherId !== undefined;
    if (parentChanged) {
      const parentId = updated.fatherId || updated.motherId;
      updated.lineageRootId = parentId
        ? (resolveLineageRoot(allById.get(parentId), allById) ?? parentId)
        : id;
    }

    const next = rebuildChildrenArrays(
      members.map(m => m.id === id ? updated : m)
    );
    saveMembers(next);

    const changes = diffMembers(existing, updated);
    if (Object.keys(changes).length > 0) {
      logAudit({
        action: 'update',
        memberId: id,
        memberName: updated.fullName,
        timestamp: updated.updatedAt!,
        changes,
      });
    }

    return {};
  };

  const deleteMember = (id: string) => {
    saveUndoSnapshot(members);
    const target = members.find(m => m.id === id);
    const next = rebuildChildrenArrays(members.filter(m => m.id !== id));
    saveMembers(next);

    if (target) {
      logAudit({
        action: 'delete',
        memberId: id,
        memberName: target.fullName,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const archiveMember = (id: string) => {
    saveUndoSnapshot(members);
    const now = new Date().toISOString();
    const target = members.find(m => m.id === id);
    const next = members.map(m =>
      m.id === id ? { ...m, isArchived: true, archivedAt: now, updatedAt: now } : m
    );
    saveMembers(next);

    if (target) {
      logAudit({
        action: 'archive',
        memberId: id,
        memberName: target.fullName,
        timestamp: now,
      });
    }
  };

  const unarchiveMember = (id: string) => {
    const now = new Date().toISOString();
    const target = members.find(m => m.id === id);
    const next = members.map(m =>
      m.id === id ? { ...m, isArchived: false, archivedAt: undefined, updatedAt: now } : m
    );
    saveMembers(next);

    if (target) {
      logAudit({
        action: 'unarchive',
        memberId: id,
        memberName: target.fullName,
        timestamp: now,
      });
    }
  };

  const importMembers = (importedMembers: FamilyMember[]) => {
    saveMembers(migrateMembers(importedMembers as any[]));
  };

  // ── Merge ───────────────────────────────────────────────────────────────────

  const mergeMember = (
    winnerId: string,
    loserId: string,
    fieldOverrides: Partial<FamilyMember>
  ): { error?: string } => {
    const allById = new Map(members.map(m => [m.id, m]));
    const winner = allById.get(winnerId);
    const loser  = allById.get(loserId);
    if (!winner || !loser) return { error: "Member not found" };

    saveUndoSnapshot(members);

    const now = new Date().toISOString();

    const mergedWinner: FamilyMember = {
      ...winner,
      ...fieldOverrides,
      id: winnerId,
      memberId: winner.memberId,
      updatedAt: now,
    };

    const updated = members
      .filter(m => m.id !== loserId)
      .map(m => {
        if (m.id === winnerId) return mergedWinner;
        let changed = false;
        const patch: Partial<FamilyMember> = {};
        if (m.fatherId === loserId) { patch.fatherId = winnerId; changed = true; }
        if (m.motherId === loserId) { patch.motherId = winnerId; changed = true; }
        if (m.spouseId === loserId) { patch.spouseId = winnerId; changed = true; }
        return changed ? { ...m, ...patch, updatedAt: now } : m;
      });

    const rebuilt = rebuildChildrenArrays(updated);
    saveMembers(rebuilt);

    logAudit({
      action: 'merge',
      memberId: winnerId,
      memberName: winner.fullName,
      timestamp: now,
      note: `Merged with "${loser.fullName}" (${loser.memberId ?? loser.id})`,
      changes: diffMembers(winner, mergedWinner),
    });

    return {};
  };

  const activeMembers = useMemo(() => members.filter(m => !m.isArchived), [members]);

  return {
    members,
    activeMembers,
    isLoaded,
    addMember,
    updateMember,
    deleteMember,
    archiveMember,
    unarchiveMember,
    importMembers,
    mergeMember,
    canUndo: hasUndo,
    undoLastAction,
    validateRelationship,
    detectPotentialDuplicates: (
      candidate: { fullName?: string; phone?: string; birthday?: string },
      excludeId?: string
    ) => detectPotentialDuplicates(candidate, members, excludeId),
  };
}
