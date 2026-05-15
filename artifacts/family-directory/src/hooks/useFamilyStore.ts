import { create } from 'zustand';
import { FamilyMember } from '../types/family';
import {
  rebuildChildrenArrays,
  repairMissingLineageRoots,
  wouldCreateCircularAncestry,
} from '../lib/familyTree';
import { logAudit, diffMembers } from '../lib/auditLog';
import { loadFromGitHub } from './useGitHubSync';
import { checkAndClearPostResetFlag, logHydration } from '../lib/hardReset';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'gkshah_family_members';
const SCHEMA_VERSION = 2;

/** localStorage key — when set, GitHub hydration is skipped entirely (debug aid). */
export const GITHUB_HYDRATION_DISABLED_KEY = 'gkshah_disable_github_hydration';
/** localStorage key — when set, the _isSaving lock is never acquired (debug aid). */
export const SAVE_LOCK_DISABLED_KEY = 'gkshah_disable_save_lock';
/** localStorage key — when set, smart merge is bypassed; remote data wins directly. */
export const MERGE_PROTECTION_DISABLED_KEY = 'gkshah_disable_merge_protection';

// ─── Module-level saving guard ────────────────────────────────────────────────
//
// _isSaving is set whenever addMember / updateMember / importMembers writes to
// localStorage. If a GitHub fetch resolves while this flag is true, the remote
// payload is discarded so it cannot overwrite the freshly-saved local data.

let _isSaving = false;
let _isSavingTimer: ReturnType<typeof setTimeout> | null = null;

// Epoch-ms of the most recent call to save(). Used by smartMergeMembers to
// detect a write that happened after the GitHub fetch started.
let _localSaveTimestamp = 0;

// Module-level undo snapshot (single-level undo)
let _undoSnapshot: FamilyMember[] | null = null;

function setSaving(): void {
  if (localStorage.getItem(SAVE_LOCK_DISABLED_KEY)) {
    console.log('[GKShah] setSaving: save lock DISABLED by debug toggle — skipping');
    return;
  }
  _isSaving = true;
  if (_isSavingTimer) clearTimeout(_isSavingTimer);
  _isSavingTimer = setTimeout(() => {
    _isSaving = false;
    console.log('[GKShah] setSaving: _isSaving auto-cleared after 3 s timeout');
  }, 3000);
}

// ─── Smart merge ──────────────────────────────────────────────────────────────
//
// Replaces the previous blind overwrite of local state with GitHub data.
//
// Rules:
//  • Local-only members (not yet synced to GitHub) are always preserved.
//  • Remote-only members are adopted (added from another device/browser).
//  • Conflicting members: whichever has the newer updatedAt timestamp wins.

function smartMergeMembers(local: FamilyMember[], remote: FamilyMember[]): {
  merged: FamilyMember[];
  localWins: number; remoteWins: number; localOnly: number; remoteOnly: number;
} {
  const localById  = new Map(local.map(m => [m.id, m]));
  const remoteById = new Map(remote.map(m => [m.id, m]));
  const allIds     = new Set([...localById.keys(), ...remoteById.keys()]);
  const merged: FamilyMember[] = [];
  let localWins = 0, remoteWins = 0, localOnly = 0, remoteOnly = 0;

  for (const id of allIds) {
    const loc = localById.get(id);
    const rem = remoteById.get(id);
    if (!rem) { merged.push(loc!); localOnly++;  continue; }
    if (!loc) { merged.push(rem);  remoteOnly++; continue; }
    const localMs  = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
    const remoteMs = rem.updatedAt ? new Date(rem.updatedAt).getTime() : 0;
    if (localMs < remoteMs) {
      console.warn(
        `[GKShah] smartMerge REMOTE WINS for ${loc.fullName} (${id}):`,
        { localUpdatedAt: loc.updatedAt, remoteUpdatedAt: rem.updatedAt, remoteAheadByMs: remoteMs - localMs }
      );
    }
    if (localMs >= remoteMs) { merged.push(loc); localWins++;  }
    else                     { merged.push(rem); remoteWins++; }
  }
  return { merged, localWins, remoteWins, localOnly, remoteOnly };
}

// ─── Stored format ────────────────────────────────────────────────────────────

interface StoredData {
  version: number;
  members: FamilyMember[];
}

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

function nextMemberIdForGen(gen: number | undefined, members: FamilyMember[]): string {
  const g = gen ?? 0;
  const existing = members
    .filter(m => m.memberId?.startsWith(`GK-G${g}-`))
    .map(m => parseInt(m.memberId!.split('-').pop() ?? '0', 10))
    .filter(n => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `GK-G${g}-${String(max + 1).padStart(4, '0')}`;
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

// ─── Storage ──────────────────────────────────────────────────────────────────

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

function save(members: FamilyMember[]): void {
  _localSaveTimestamp = Date.now();
  try {
    const data: StoredData = { version: SCHEMA_VERSION, members };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem('gkshah_local_save_at', String(_localSaveTimestamp));
  } catch {
    // localStorage quota exceeded — data remains in Zustand memory
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

// ─── State type ───────────────────────────────────────────────────────────────

interface FamilyState {
  members: FamilyMember[];
  /** Derived: members where isArchived !== true. Always in sync with members. */
  activeMembers: FamilyMember[];
  isLoaded: boolean;
  canUndo: boolean;
  addMember: (member: Omit<FamilyMember, 'id'>) => { member: FamilyMember; error?: string };
  updateMember: (id: string, updates: Partial<FamilyMember>) => { error?: string };
  deleteMember: (id: string) => void;
  archiveMember: (id: string) => void;
  unarchiveMember: (id: string) => void;
  importMembers: (data: FamilyMember[]) => void;
  mergeMember: (winnerId: string, loserId: string, overrides: Partial<FamilyMember>) => { error?: string };
  undoLastAction: () => void;
  validateRelationship: (
    memberId: string | undefined,
    fatherId: string | undefined,
    motherId: string | undefined,
    spouseId: string | undefined
  ) => string | null;
  detectPotentialDuplicates: (
    candidate: { fullName?: string; phone?: string; birthday?: string },
    excludeId?: string
  ) => DuplicateCandidate[];
}

// ─── Singleton Zustand store ──────────────────────────────────────────────────
//
// ONE global instance. Every component that calls useFamilyStore() subscribes
// to the same state. A write in MemberForm is immediately visible in Dashboard,
// FamilyTree, CommandPalette — no events, no per-component copies.

export const useFamilyStore = create<FamilyState>()((set, get) => ({
  members: [],
  activeMembers: [],
  isLoaded: false,
  canUndo: false,

  // ── addMember ─────────────────────────────────────────────────────────────

  addMember: (member) => {
    console.group('[GKShah] addMember START');
    console.log('[GKShah] addMember INPUT', {
      fullName: member.fullName, birthday: member.birthday,
      gender: member.gender, bloodGroup: member.bloodGroup, generation: member.generation,
    });
    try {
      const { members, validateRelationship } = get();

      const validationError = validateRelationship(
        undefined, member.fatherId, member.motherId, member.spouseId
      );
      if (validationError) {
        console.warn('[GKShah] addMember FAILURE (validation):', validationError);
        return { member: {} as FamilyMember, error: validationError };
      }

      setSaving();
      console.log('[GKShah] addMember: _isSaving set, lock acquired');

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
        ...member, id, memberId, lineageRootId, generationNumber, addedAt: now, updatedAt: now,
      };

      const next = rebuildChildrenArrays([...members, newMember]);
      set({ members: next, activeMembers: next.filter(m => !m.isArchived) });
      save(next);

      // Best-effort localStorage verify
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const lsList: Array<{ id: string }> = Array.isArray(parsed) ? parsed : (parsed?.members ?? []);
        console.log('[GKShah] addMember LOCALSTORAGE VERIFY',
          lsList.find(m => m.id === id) ? `✓ found (${id})` : `❌ NOT FOUND (${id})`);
      } catch { /* noop */ }

      logAudit({ action: 'create', memberId: id, memberName: member.fullName, timestamp: now });

      const saved = next.find(m => m.id === id)!;
      console.log('[GKShah] addMember END —', id, saved?.fullName);

      setTimeout(() => {
        try {
          const raw2 = localStorage.getItem(STORAGE_KEY);
          const parsed2 = raw2 ? JSON.parse(raw2) : null;
          const list2: Array<{ id: string; fullName?: string; updatedAt?: string }> =
            Array.isArray(parsed2) ? parsed2 : (parsed2?.members ?? []);
          const check = list2.find(m => m.id === id);
          console.log(
            '[GKShah] addMember +2s LOCALSTORAGE VERIFY',
            check
              ? `✓ still present — ${check.fullName} updatedAt=${check.updatedAt}`
              : `❌ GONE — was wiped after save!`
          );
        } catch { /* noop */ }
      }, 2000);

      return { member: saved };
    } catch (err) {
      console.error('[GKShah] addMember FAILURE (exception):', err);
      throw err;
    } finally {
      console.groupEnd();
    }
  },

  // ── updateMember ──────────────────────────────────────────────────────────

  updateMember: (id, updates) => {
    const { members, validateRelationship } = get();
    const validationError = validateRelationship(id, updates.fatherId, updates.motherId, updates.spouseId);
    console.group('[GKShah] updateMember START');
    console.log('[GKShah] updateMember INPUT', {
      id, fullName: updates.fullName, birthday: updates.birthday,
      gender: updates.gender, bloodGroup: updates.bloodGroup, generation: updates.generation,
    });
    try {
      if (validationError) {
        console.warn('[GKShah] updateMember FAILURE (validation):', validationError);
        return { error: validationError };
      }

      setSaving();
      console.log('[GKShah] updateMember: _isSaving set, lock acquired');

      const allById = new Map(members.map(m => [m.id, m]));
      const existing = allById.get(id);
      if (!existing) {
        console.warn('[GKShah] updateMember FAILURE: member not found:', id);
        return { error: "Member not found" };
      }

      const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() } as FamilyMember;
      console.log('[GKShah] updateMember EXISTING vs UPDATED', {
        existing: { birthday: existing.birthday, gender: existing.gender, bloodGroup: existing.bloodGroup },
        updated:  { birthday: updated.birthday,  gender: updated.gender,  bloodGroup: updated.bloodGroup  },
      });

      const parentChanged = updates.fatherId !== undefined || updates.motherId !== undefined;
      if (parentChanged) {
        const parentId = updated.fatherId || updated.motherId;
        updated.lineageRootId = parentId
          ? (resolveLineageRoot(allById.get(parentId), allById) ?? parentId)
          : id;
      }

      const next = rebuildChildrenArrays(members.map(m => m.id === id ? updated : m));
      set({ members: next, activeMembers: next.filter(m => !m.isArchived) });
      save(next);

      // Best-effort localStorage verify
      try {
        const rawLs = localStorage.getItem(STORAGE_KEY);
        const parsedLs = rawLs ? JSON.parse(rawLs) : null;
        const lsList: Array<{ id: string }> = Array.isArray(parsedLs) ? parsedLs : (parsedLs?.members ?? []);
        console.log('[GKShah] updateMember LOCALSTORAGE VERIFY',
          lsList.find(m => m.id === id) ? `✓ found (${id})` : `❌ NOT FOUND (${id})`);
      } catch { /* noop */ }

      const changes = diffMembers(existing, updated);
      if (Object.keys(changes).length > 0) {
        logAudit({ action: 'update', memberId: id, memberName: updated.fullName, timestamp: updated.updatedAt!, changes });
      }

      console.log('[GKShah] updateMember END —', id, updated.fullName);

      setTimeout(() => {
        try {
          const raw2 = localStorage.getItem(STORAGE_KEY);
          const parsed2 = raw2 ? JSON.parse(raw2) : null;
          const list2: Array<{ id: string; fullName?: string; birthday?: string; gender?: string; bloodGroup?: string; updatedAt?: string }> =
            Array.isArray(parsed2) ? parsed2 : (parsed2?.members ?? []);
          const check = list2.find(m => m.id === id);
          if (check) {
            console.log(
              '[GKShah] updateMember +2s LOCALSTORAGE VERIFY ✓ still present',
              { id, fullName: check.fullName, birthday: check.birthday, gender: check.gender, bloodGroup: check.bloodGroup, updatedAt: check.updatedAt }
            );
          } else {
            console.error('[GKShah] updateMember +2s LOCALSTORAGE VERIFY ❌ GONE — member was wiped after save!', { id });
          }
        } catch { /* noop */ }
      }, 2000);

      return {};
    } catch (err) {
      console.error('[GKShah] updateMember FAILURE (exception):', err);
      throw err;
    } finally {
      console.groupEnd();
    }
  },

  // ── deleteMember ──────────────────────────────────────────────────────────

  deleteMember: (id) => {
    const { members } = get();
    _undoSnapshot = [...members];
    set({ canUndo: true });
    const target = members.find(m => m.id === id);
    const next = rebuildChildrenArrays(members.filter(m => m.id !== id));
    set({ members: next, activeMembers: next.filter(m => !m.isArchived) });
    save(next);

    if (target) {
      logAudit({
        action: 'delete',
        memberId: id,
        memberName: target.fullName,
        timestamp: new Date().toISOString(),
      });
    }
  },

  // ── archiveMember ─────────────────────────────────────────────────────────

  archiveMember: (id) => {
    const { members } = get();
    _undoSnapshot = [...members];
    set({ canUndo: true });
    const now = new Date().toISOString();
    const target = members.find(m => m.id === id);
    const next = members.map(m =>
      m.id === id ? { ...m, isArchived: true, archivedAt: now, updatedAt: now } : m
    );
    set({ members: next, activeMembers: next.filter(m => !m.isArchived) });
    save(next);

    if (target) {
      logAudit({
        action: 'archive',
        memberId: id,
        memberName: target.fullName,
        timestamp: now,
      });
    }
  },

  // ── unarchiveMember ───────────────────────────────────────────────────────

  unarchiveMember: (id) => {
    const { members } = get();
    const now = new Date().toISOString();
    const target = members.find(m => m.id === id);
    const next = members.map(m =>
      m.id === id ? { ...m, isArchived: false, archivedAt: undefined, updatedAt: now } : m
    );
    set({ members: next, activeMembers: next.filter(m => !m.isArchived) });
    save(next);

    if (target) {
      logAudit({
        action: 'unarchive',
        memberId: id,
        memberName: target.fullName,
        timestamp: now,
      });
    }
  },

  // ── importMembers ─────────────────────────────────────────────────────────

  importMembers: (importedMembers) => {
    console.group('[GKShah] importMembers START');
    console.log('[GKShah] importMembers INPUT count:', importedMembers.length);
    try {
      setSaving();
      console.log('[GKShah] importMembers: _isSaving set, lock acquired');
      const next = migrateMembers(importedMembers as any[]);
      set({ members: next, activeMembers: next.filter(m => !m.isArchived) });
      save(next);
      console.log('[GKShah] importMembers END — saved', next.length, 'member(s)');
    } catch (err) {
      console.error('[GKShah] importMembers FAILURE (exception):', err);
      throw err;
    } finally {
      console.groupEnd();
    }
  },

  // ── mergeMember ───────────────────────────────────────────────────────────

  mergeMember: (winnerId, loserId, fieldOverrides) => {
    const { members } = get();
    const allById = new Map(members.map(m => [m.id, m]));
    const winner = allById.get(winnerId);
    const loser  = allById.get(loserId);
    if (!winner || !loser) return { error: "Member not found" };

    _undoSnapshot = [...members];
    set({ canUndo: true });

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
    set({ members: rebuilt, activeMembers: rebuilt.filter(m => !m.isArchived) });
    save(rebuilt);

    logAudit({
      action: 'merge',
      memberId: winnerId,
      memberName: winner.fullName,
      timestamp: now,
      note: `Merged with "${loser.fullName}" (${loser.memberId ?? loser.id})`,
      changes: diffMembers(winner, mergedWinner),
    });

    return {};
  },

  // ── undoLastAction ────────────────────────────────────────────────────────

  undoLastAction: () => {
    if (!_undoSnapshot) return;
    const next = _undoSnapshot;
    _undoSnapshot = null;
    set({ members: next, activeMembers: next.filter(m => !m.isArchived), canUndo: false });
    save(next);
  },

  // ── validateRelationship ──────────────────────────────────────────────────

  validateRelationship: (memberId, fatherId, motherId, spouseId) => {
    const { members } = get();
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
  },

  // ── detectPotentialDuplicates ─────────────────────────────────────────────

  detectPotentialDuplicates: (candidate, excludeId) => {
    const { members } = get();
    return detectPotentialDuplicates(candidate, members, excludeId);
  },
}));

// ─── Single global hydration pipeline ────────────────────────────────────────
//
// This IIFE runs ONCE when the module is first imported — not per component
// mount. Zustand's subscription mechanism ensures all components receive the
// updated state automatically without any additional wiring.

(async function hydrate() {
  if (checkAndClearPostResetFlag()) {
    logHydration("Members loaded from: RESET — showing 0 members (GitHub restore blocked)");
    useFamilyStore.setState({ members: [], activeMembers: [], isLoaded: true });
    return;
  }

  const local = load();
  if (local.length > 0) {
    logHydration(
      `Members loaded from: localStorage (${local.length} member${local.length !== 1 ? 's' : ''} — showing while GitHub loads)`
    );
    useFamilyStore.setState({
      members: local,
      activeMembers: local.filter(m => !m.isArchived),
      isLoaded: true,
    });
  }

  try {
    const remote = await loadFromGitHub<FamilyMember[] | StoredData>("members");

    if (remote === null) {
      logHydration(
        `Members loaded from: localStorage (${local.length} member${local.length !== 1 ? 's' : ''} — GitHub unreachable)`
      );
      useFamilyStore.setState({ isLoaded: true });
      return;
    }

    const raw: any[] = Array.isArray(remote) ? remote : (remote as StoredData).members ?? [];

    if (raw.length > 0) {
      // Guard 1 — save in progress: discard GitHub payload to protect fresh local write
      if (_isSaving) {
        const localNow = load();
        logHydration(
          `Members: GitHub response arrived during active save — refreshing to post-save state ` +
          `(${raw.length} remote ignored, ${localNow.length} local preserved)`
        );
        useFamilyStore.setState({
          members: localNow,
          activeMembers: localNow.filter(m => !m.isArchived),
          isLoaded: true,
        });
        return;
      }

      // Guard 2 — debug toggle
      if (localStorage.getItem(GITHUB_HYDRATION_DISABLED_KEY)) {
        logHydration(`Members: GitHub hydration disabled by debug toggle — keeping ${local.length} local members`);
        useFamilyStore.setState({ isLoaded: true });
        return;
      }

      // Guard 3 — merge protection disabled (remote wins directly)
      if (localStorage.getItem(MERGE_PROTECTION_DISABLED_KEY)) {
        const migrated = migrateMembers(raw);
        logHydration(`Members: merge protection disabled — remote wins (${migrated.length} members)`);
        useFamilyStore.setState({
          members: migrated,
          activeMembers: migrated.filter(m => !m.isArchived),
          isLoaded: true,
        });
        save(migrated);
        return;
      }

      // Smart merge — always use a fresh localStorage read so any write that
      // happened during the GitHub await is included on the local side.
      const migrated = migrateMembers(raw);
      const currentLocal = load();
      const { merged, localWins, remoteWins, localOnly, remoteOnly } =
        smartMergeMembers(currentLocal, migrated);

      console.group("[GKShah Save Trace] HYDRATION PAYLOAD (members)");
      console.log(`Remote=${raw.length}  Local=${currentLocal.length}  Merged=${merged.length}`);
      console.log(`localWins=${localWins}  remoteWins=${remoteWins}  localOnly=${localOnly}  remoteOnly=${remoteOnly}`);
      console.groupEnd();

      logHydration(
        `Members merged: ${merged.length} total | ` +
        `localWins=${localWins} remoteWins=${remoteWins} ` +
        `localOnly=${localOnly} remoteOnly=${remoteOnly}`
      );

      useFamilyStore.setState({
        members: merged,
        activeMembers: merged.filter(m => !m.isArchived),
        isLoaded: true,
      });
      save(merged);
      return;
    }

    // GitHub returned 0 members.
    // ─── CRITICAL: never let an empty GitHub response wipe local data. ───

    // Guard A — debug toggle
    if (localStorage.getItem(GITHUB_HYDRATION_DISABLED_KEY)) {
      logHydration(
        `Members: GitHub hydration disabled — keeping ${local.length} local member${local.length !== 1 ? 's' : ''} (remote returned 0)`
      );
      useFamilyStore.setState({ isLoaded: true });
      return;
    }

    // Guard B — save in progress
    if (_isSaving) {
      const localNow = load();
      logHydration(
        `Members: GitHub returned 0 but save is in progress — refreshing to post-save state ` +
        `(${localNow.length} member${localNow.length !== 1 ? 's' : ''})`
      );
      useFamilyStore.setState({
        members: localNow,
        activeMembers: localNow.filter(m => !m.isArchived),
        isLoaded: true,
      });
      return;
    }

    // Guard C — re-read localStorage NOW (captured `local` may be stale if a
    // member was added after init started but before GitHub resolved)
    const localNow = load();
    if (localNow.length > 0) {
      logHydration(
        `Members: GitHub returned 0 — preserving ${localNow.length} local-only member${localNow.length !== 1 ? 's' : ''} ` +
        `(remote is empty, local is authoritative)`
      );
      useFamilyStore.setState({
        members: localNow,
        activeMembers: localNow.filter(m => !m.isArchived),
        isLoaded: true,
      });
      return;
    }

    // Both GitHub and localStorage are genuinely empty — fresh start.
    logHydration("Members: GitHub returned 0 and localStorage is also empty — starting fresh");
    useFamilyStore.setState({ members: [], activeMembers: [], isLoaded: true });

  } catch {
    logHydration(
      `Members loaded from: localStorage (${local.length} member${local.length !== 1 ? 's' : ''} — GitHub threw)`
    );
    const localNow = load();
    useFamilyStore.setState({
      members: localNow,
      activeMembers: localNow.filter(m => !m.isArchived),
      isLoaded: true,
    });
  }
})();
