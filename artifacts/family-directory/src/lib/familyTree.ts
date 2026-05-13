import { FamilyMember } from "@/types/family";

export interface TreeNode {
  member: FamilyMember;
  spouse?: FamilyMember;
  children: TreeNode[];
  depth: number;
}

// ─── Core tree builder ────────────────────────────────────────────────────────

export function buildFamilyTree(members: FamilyMember[]): TreeNode[] {
  const memberMap = new Map(members.map(m => [m.id, m]));
  const placed = new Set<string>();

  function buildNode(m: FamilyMember, depth: number): TreeNode {
    placed.add(m.id);

    let spouse: FamilyMember | undefined;
    if (m.spouseId) {
      spouse = memberMap.get(m.spouseId);
    } else if (m.spouseName) {
      spouse = members.find(
        x => x.id !== m.id && !placed.has(x.id) &&
          x.fullName.toLowerCase() === m.spouseName!.toLowerCase()
      );
    }
    if (spouse && !placed.has(spouse.id)) {
      placed.add(spouse.id);
    } else {
      spouse = undefined;
    }

    const parentIds = new Set<string>(
      [m.id, spouse?.id].filter((id): id is string => !!id)
    );

    const children = members
      .filter(x => {
        if (placed.has(x.id)) return false;
        return (x.fatherId && parentIds.has(x.fatherId)) ||
               (x.motherId && parentIds.has(x.motherId));
      })
      .sort((a, b) => (a.siblingOrder ?? 999) - (b.siblingOrder ?? 999));

    const childNodes = children.map(c => buildNode(c, depth + 1));
    return { member: m, spouse, children: childNodes, depth };
  }

  const candidateRoots = members
    .filter(m => !m.fatherId && !m.motherId)
    .sort(
      (a, b) =>
        (a.generationNumber ?? 99) - (b.generationNumber ?? 99) ||
        (a.siblingOrder ?? 99) - (b.siblingOrder ?? 99)
    );

  const roots: TreeNode[] = [];
  for (const r of candidateRoots) {
    if (placed.has(r.id)) continue;
    roots.push(buildNode(r, 0));
  }
  return roots;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getChildren(memberId: string, members: FamilyMember[]): FamilyMember[] {
  return members
    .filter(m => m.fatherId === memberId || m.motherId === memberId)
    .sort((a, b) => (a.siblingOrder ?? 999) - (b.siblingOrder ?? 999));
}

export function getDescendants(memberId: string, members: FamilyMember[]): FamilyMember[] {
  const visited = new Set<string>();
  const result: FamilyMember[] = [];
  function walk(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    for (const child of getChildren(id, members)) {
      result.push(child);
      walk(child.id);
    }
  }
  walk(memberId);
  return result;
}

export function getAncestors(memberId: string, members: FamilyMember[]): FamilyMember[] {
  const map = new Map(members.map(m => [m.id, m]));
  const ancestors: FamilyMember[] = [];
  const visited = new Set<string>();
  let current = map.get(memberId);
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const father = current.fatherId ? map.get(current.fatherId) : undefined;
    const mother = current.motherId ? map.get(current.motherId) : undefined;
    if (father) ancestors.push(father);
    if (mother) ancestors.push(mother);
    current = father;
  }
  return ancestors;
}

/** Returns the ordered ancestry path from root ancestor down to (but not including) the given member. */
export function getAncestryPath(memberId: string, members: FamilyMember[]): FamilyMember[] {
  const map = new Map(members.map(m => [m.id, m]));
  const path: FamilyMember[] = [];
  const visited = new Set<string>();
  let current = map.get(memberId);
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const parentId = current.fatherId || current.motherId;
    if (!parentId) break;
    const parent = map.get(parentId);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}

export function getAncestorIds(memberId: string, members: FamilyMember[]): Set<string> {
  const map = new Map(members.map(m => [m.id, m]));
  const ids = new Set<string>();
  const visited = new Set<string>();
  function walk(id: string) {
    const m = map.get(id);
    if (!m || visited.has(id)) return;
    visited.add(id);
    if (m.fatherId) { ids.add(m.fatherId); walk(m.fatherId); }
    if (m.motherId) { ids.add(m.motherId); walk(m.motherId); }
  }
  walk(memberId);
  return ids;
}

export function calculateGeneration(memberId: string, members: FamilyMember[]): number {
  const map = new Map(members.map(m => [m.id, m]));
  const visited = new Set<string>();
  let gen = 1;
  let current = map.get(memberId);
  while (current?.fatherId || current?.motherId) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const parentId = current.fatherId || current.motherId;
    if (!parentId) break;
    current = map.get(parentId);
    gen++;
    if (gen > 20) break;
  }
  return gen;
}

// ─── Search helpers ───────────────────────────────────────────────────────────

export function getSearchState(query: string, members: FamilyMember[]): {
  matchIds: Set<string>;
  expandIds: Set<string>;
} {
  const q = query.toLowerCase().trim();
  if (!q) return { matchIds: new Set(), expandIds: new Set() };

  const matchIds = new Set<string>(
    members
      .filter(m =>
        m.fullName.toLowerCase().includes(q) ||
        (m.city || "").toLowerCase().includes(q) ||
        (m.mainFamilyBranch || "").toLowerCase().includes(q) ||
        (m.profession || "").toLowerCase().includes(q)
      )
      .map(m => m.id)
  );

  const expandIds = new Set<string>();
  for (const id of matchIds) {
    getAncestorIds(id, members).forEach(aid => expandIds.add(aid));
  }
  return { matchIds, expandIds };
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
export function generationLabel(n: number): string {
  return `${ORDINALS[n - 1] ?? `${n}th`} Generation`;
}

// ─── Data integrity utilities ─────────────────────────────────────────────────

export interface OrphanInfo {
  member: FamilyMember;
  missingFatherId?: string;
  missingMotherId?: string;
  missingSpouseId?: string;
}

/** Finds members whose referenced parent/spouse IDs don't exist in the dataset. */
export function detectOrphans(members: FamilyMember[]): OrphanInfo[] {
  const ids = new Set(members.map(m => m.id));
  return members
    .filter(m =>
      (m.fatherId && !ids.has(m.fatherId)) ||
      (m.motherId && !ids.has(m.motherId)) ||
      (m.spouseId && !ids.has(m.spouseId))
    )
    .map(m => ({
      member: m,
      missingFatherId: m.fatherId && !ids.has(m.fatherId) ? m.fatherId : undefined,
      missingMotherId: m.motherId && !ids.has(m.motherId) ? m.motherId : undefined,
      missingSpouseId: m.spouseId && !ids.has(m.spouseId) ? m.spouseId : undefined,
    }));
}

/** Checks if adding parentId as a parent of childId would create a circular ancestry loop. */
export function wouldCreateCircularAncestry(
  childId: string,
  potentialParentId: string,
  members: FamilyMember[]
): boolean {
  // Circular if potentialParent is already a descendant of child
  const descendantIds = new Set(getDescendants(childId, members).map(m => m.id));
  return descendantIds.has(potentialParentId) || potentialParentId === childId;
}

/** Detects members whose ancestry chain contains a cycle. Returns their IDs. */
export function detectCircularRelationships(members: FamilyMember[]): string[] {
  const map = new Map(members.map(m => [m.id, m]));
  const circular: string[] = [];

  function hasCycle(startId: string): boolean {
    const visited = new Set<string>();
    let cur = map.get(startId);
    while (cur) {
      if (visited.has(cur.id)) return true;
      visited.add(cur.id);
      const parentId = cur.fatherId || cur.motherId;
      if (!parentId) return false;
      cur = map.get(parentId);
    }
    return false;
  }

  members.forEach(m => { if (hasCycle(m.id)) circular.push(m.id); });
  return circular;
}

/** Rebuilds childrenIds arrays from fatherId/motherId references. */
export function rebuildChildrenArrays(members: FamilyMember[]): FamilyMember[] {
  const childrenMap: Record<string, string[]> = {};
  members.forEach(m => {
    if (m.fatherId) {
      childrenMap[m.fatherId] = [...(childrenMap[m.fatherId] ?? []), m.id];
    }
    if (m.motherId && m.motherId !== m.fatherId) {
      childrenMap[m.motherId] = [...(childrenMap[m.motherId] ?? []), m.id];
    }
  });
  return members.map(m => ({ ...m, childrenIds: childrenMap[m.id] ?? [] }));
}

/** Re-computes lineageRootId for all members by walking ancestry chains. */
export function repairMissingLineageRoots(members: FamilyMember[]): FamilyMember[] {
  const map = new Map(members.map(m => [m.id, m]));

  function findRoot(m: FamilyMember, visited = new Set<string>()): string {
    if (visited.has(m.id)) return m.id;
    visited.add(m.id);
    const parentId = m.fatherId || m.motherId;
    if (!parentId) return m.id;
    const parent = map.get(parentId);
    if (!parent) return m.id;
    return findRoot(parent, visited);
  }

  return members.map(m => ({
    ...m,
    lineageRootId: m.lineageRootId ?? findRoot(m),
  }));
}

/** Full data integrity report. */
export interface IntegrityReport {
  orphans: OrphanInfo[];
  circularIds: string[];
  missingLineageCount: number;
  totalMembers: number;
}

export function runIntegrityCheck(members: FamilyMember[]): IntegrityReport {
  return {
    orphans: detectOrphans(members),
    circularIds: detectCircularRelationships(members),
    missingLineageCount: members.filter(m => !m.lineageRootId).length,
    totalMembers: members.length,
  };
}
