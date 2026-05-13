import { FamilyMember } from "@/types/family";

export interface TreeNode {
  member: FamilyMember;
  spouse?: FamilyMember;
  children: TreeNode[];
  depth: number;
}

/**
 * Builds the full family tree from a flat list of members.
 * Each member appears EXACTLY ONCE. Spouses are attached to
 * their partner's node. Children nest under their parents.
 * Members with no parentage and not placed as a spouse become roots.
 */
export function buildFamilyTree(members: FamilyMember[]): TreeNode[] {
  const memberMap = new Map(members.map(m => [m.id, m]));
  const placed = new Set<string>();

  function buildNode(m: FamilyMember, depth: number): TreeNode {
    placed.add(m.id);

    // Resolve spouse: prefer spouseId, fall back to spouseName match
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

    // Children: any member whose fatherId or motherId is one of the parent IDs
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

  // Roots: members with no parentage, sorted by generationNumber then siblingOrder
  const candidateRoots = members
    .filter(m => !m.fatherId && !m.motherId)
    .sort(
      (a, b) =>
        (a.generationNumber ?? 99) - (b.generationNumber ?? 99) ||
        (a.siblingOrder ?? 99) - (b.siblingOrder ?? 99)
    );

  const roots: TreeNode[] = [];
  for (const r of candidateRoots) {
    if (placed.has(r.id)) continue; // already placed as a spouse
    roots.push(buildNode(r, 0));
  }

  return roots;
}

/** Returns all direct children of a member (those whose fatherId or motherId matches) */
export function getChildren(memberId: string, members: FamilyMember[]): FamilyMember[] {
  return members.filter(
    m => m.fatherId === memberId || m.motherId === memberId
  ).sort((a, b) => (a.siblingOrder ?? 999) - (b.siblingOrder ?? 999));
}

/** Returns all ancestors of a member, walking up via fatherId */
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
    current = father; // walk up paternal line
  }
  return ancestors;
}

/** Returns all descendants of a member recursively */
export function getDescendants(memberId: string, members: FamilyMember[]): FamilyMember[] {
  const visited = new Set<string>();
  const result: FamilyMember[] = [];

  function walk(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const children = getChildren(id, members);
    for (const child of children) {
      result.push(child);
      walk(child.id);
    }
  }

  walk(memberId);
  return result;
}

/** Calculates the generation number of a member by walking up to root */
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
    if (gen > 20) break; // safety cap
  }
  return gen;
}

/** Returns the Set of all ancestor member IDs for a given member */
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

/** Given a search query, returns IDs of matching members and all their ancestors (nodes that must be expanded) */
export function getSearchState(query: string, members: FamilyMember[]): {
  matchIds: Set<string>;
  expandIds: Set<string>;
} {
  const q = query.toLowerCase().trim();
  if (!q) return { matchIds: new Set(), expandIds: new Set() };

  const matchIds = new Set<string>(
    members
      .filter(m => m.fullName.toLowerCase().includes(q) ||
                   (m.city || "").toLowerCase().includes(q) ||
                   (m.mainFamilyBranch || "").toLowerCase().includes(q))
      .map(m => m.id)
  );

  const expandIds = new Set<string>();
  for (const id of matchIds) {
    const ancestors = getAncestorIds(id, members);
    ancestors.forEach(aid => expandIds.add(aid));
  }

  return { matchIds, expandIds };
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
export function generationLabel(n: number): string {
  return `${ORDINALS[n - 1] ?? `${n}th`} Generation`;
}
