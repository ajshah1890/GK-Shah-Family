import { useState, useEffect } from 'react';
import { FamilyMember, SAMPLE_MEMBERS } from '../types/family';
import {
  rebuildChildrenArrays,
  repairMissingLineageRoots,
  wouldCreateCircularAncestry,
} from '../lib/familyTree';

const STORAGE_KEY = 'gkshah_family_members';
const SCHEMA_VERSION = 2;

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

// ─── Migration ────────────────────────────────────────────────────────────────

function migrateMembers(raw: any[]): FamilyMember[] {
  const allById = new Map(raw.map(m => [m.id, m]));

  const migrated = raw.map((m): FamilyMember => {
    const out = { ...m };
    delete out.relationship;
    if (m.familyBranch && !m.mainFamilyBranch) {
      out.mainFamilyBranch = m.familyBranch;
    }
    delete out.familyBranch;

    if (!out.lineageRootId) {
      out.lineageRootId = resolveLineageRoot(m, allById);
    }
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

  // Ensure childrenIds arrays are consistent
  return rebuildChildrenArrays(repairMissingLineageRoots(migrated));
}

function load(): FamilyMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Support both old format (plain array) and new format ({ version, members })
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFamilyStore() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loaded = load();
    if (loaded.length === 0) {
      const initial = migrateMembers(SAMPLE_MEMBERS as any[]);
      setMembers(initial);
      save(initial);
    } else {
      setMembers(loaded);
    }
    setIsLoaded(true);
  }, []);

  const saveMembers = (next: FamilyMember[]) => {
    setMembers(next);
    save(next);
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

    const newMember: FamilyMember = {
      ...member,
      id,
      lineageRootId,
      generationNumber,
      addedAt: new Date().toISOString(),
    };
    if (newMember.lineageRootId === id && member.fatherId === undefined && member.motherId === undefined) {
      newMember.lineageRootId = id;
    }

    const next = rebuildChildrenArrays([...members, newMember]);
    saveMembers(next);
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

    const updated = { ...existing, ...updates, id } as FamilyMember;

    // Recompute lineageRootId if parent changed
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
    return {};
  };

  const deleteMember = (id: string) => {
    const next = rebuildChildrenArrays(members.filter(m => m.id !== id));
    saveMembers(next);
  };

  const importMembers = (importedMembers: FamilyMember[]) => {
    saveMembers(migrateMembers(importedMembers as any[]));
  };

  return {
    members,
    isLoaded,
    addMember,
    updateMember,
    deleteMember,
    importMembers,
    validateRelationship,
  };
}
