import { useState, useEffect } from 'react';
import { FamilyMember, SAMPLE_MEMBERS } from '../types/family';

const STORAGE_KEY = 'gkshah_family_members';

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

function migrateMembers(raw: unknown[]): FamilyMember[] {
  const allById = new Map((raw as any[]).map(m => [m.id, m]));
  return (raw as any[]).map((m) => {
    const migrated = { ...m };
    // Remove stale fields
    delete migrated.relationship;
    // Rename familyBranch -> mainFamilyBranch
    if (m.familyBranch && !m.mainFamilyBranch) {
      migrated.mainFamilyBranch = m.familyBranch;
    }
    delete migrated.familyBranch;
    // Auto-compute lineageRootId if missing
    if (!migrated.lineageRootId) {
      migrated.lineageRootId = resolveLineageRoot(m, allById);
    }
    // Parse numeric fields that may have come in as strings (e.g. from Excel import)
    if (migrated.generationNumber !== undefined) {
      migrated.generationNumber = Number(migrated.generationNumber) || undefined;
    }
    if (migrated.siblingOrder !== undefined) {
      migrated.siblingOrder = Number(migrated.siblingOrder) || undefined;
    }
    // Normalise childrenNames: may be a comma-string after Excel round-trip
    if (typeof migrated.childrenNames === 'string') {
      migrated.childrenNames = (migrated.childrenNames as string)
        .split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    return migrated as FamilyMember;
  });
}

export function useFamilyStore() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        setMembers(migrateMembers(JSON.parse(data)));
      } else {
        setMembers(SAMPLE_MEMBERS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_MEMBERS));
      }
    } catch {
      setMembers(SAMPLE_MEMBERS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveMembers = (newMembers: FamilyMember[]) => {
    setMembers(newMembers);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMembers));
    } catch {
      // localStorage quota exceeded — silently fail; data is still in memory
    }
  };

  const addMember = (member: Omit<FamilyMember, 'id'>): FamilyMember => {
    const allById = new Map(members.map(m => [m.id, m]));
    const tempId = crypto.randomUUID();

    // Auto-compute lineageRootId from parent chain
    let lineageRootId = member.lineageRootId;
    if (!lineageRootId) {
      const parentId = member.fatherId || member.motherId;
      if (parentId) {
        lineageRootId = resolveLineageRoot(allById.get(parentId), allById) ?? parentId;
      } else {
        lineageRootId = tempId; // root of its own lineage
      }
    }

    // Auto-compute generationNumber from parent if not set
    let generationNumber = member.generationNumber;
    if (!generationNumber) {
      const parentId = member.fatherId || member.motherId;
      const parent = parentId ? allById.get(parentId) : undefined;
      if (parent?.generationNumber) {
        generationNumber = parent.generationNumber + 1;
      }
    }

    const newMember: FamilyMember = {
      ...member,
      id: tempId,
      lineageRootId,
      generationNumber,
      addedAt: new Date().toISOString(),
    };

    // Update lineageRootId if it was set to tempId (now we have the real id)
    if (newMember.lineageRootId === tempId) {
      newMember.lineageRootId = newMember.id;
    }

    saveMembers([...members, newMember]);
    return newMember;
  };

  const updateMember = (id: string, updates: Partial<FamilyMember>) => {
    const allById = new Map(members.map(m => [m.id, m]));
    const updated = { ...allById.get(id), ...updates, id } as FamilyMember;

    // Re-compute lineageRootId if parent changed
    if (updates.fatherId !== undefined || updates.motherId !== undefined) {
      const parentId = updated.fatherId || updated.motherId;
      if (parentId) {
        updated.lineageRootId = resolveLineageRoot(allById.get(parentId), allById) ?? parentId;
      }
    }

    saveMembers(members.map(m => m.id === id ? updated : m));
  };

  const deleteMember = (id: string) => {
    saveMembers(members.filter(m => m.id !== id));
  };

  const importMembers = (importedMembers: FamilyMember[]) => {
    saveMembers(migrateMembers(importedMembers) as FamilyMember[]);
  };

  return {
    members,
    isLoaded,
    addMember,
    updateMember,
    deleteMember,
    importMembers,
  };
}
