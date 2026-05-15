import { FamilyMember } from "@/types/family";

// ─── Ancestor chain ───────────────────────────────────────────────────────────

/**
 * Returns every ancestor of `startId`, mapped id → distance from startId.
 * Distance 1 = parent, 2 = grandparent, etc.
 */
export function buildAncestorDepthMap(
  startId: string,
  memberMap: Map<string, FamilyMember>
): Map<string, number> {
  const result = new Map<string, number>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (depth > 0) result.set(id, depth);

    const m = memberMap.get(id);
    if (!m) continue;
    if (m.fatherId && !visited.has(m.fatherId)) queue.push({ id: m.fatherId, depth: depth + 1 });
    if (m.motherId && !visited.has(m.motherId)) queue.push({ id: m.motherId, depth: depth + 1 });
  }

  return result;
}

/** Returns the ordered ancestry path from startId up to (and including) a terminal ancestor. */
function buildAncestryChain(
  startId: string,
  memberMap: Map<string, FamilyMember>,
  stopAtId?: string
): string[] {
  const chain: string[] = [startId];
  const visited = new Set<string>([startId]);
  let current = memberMap.get(startId);

  while (current) {
    const parentId = current.fatherId || current.motherId;
    if (!parentId || visited.has(parentId)) break;
    visited.add(parentId);
    chain.push(parentId);
    if (parentId === stopAtId) break;
    current = memberMap.get(parentId);
  }
  return chain;
}

// ─── Common ancestor ──────────────────────────────────────────────────────────

export interface CommonAncestor {
  ancestorId: string;
  depthA: number;
  depthB: number;
}

export function findCommonAncestor(
  idA: string,
  idB: string,
  members: FamilyMember[]
): CommonAncestor | null {
  if (idA === idB) return null;
  const memberMap = new Map(members.map(m => [m.id, m]));
  const mapA = buildAncestorDepthMap(idA, memberMap);
  const mapB = buildAncestorDepthMap(idB, memberMap);

  // Also allow A or B to be each other's ancestor (depth-0 self-check)
  mapA.set(idA, 0);
  mapB.set(idB, 0);

  let best: CommonAncestor | null = null;

  for (const [id, dA] of mapA) {
    const dB = mapB.get(id);
    if (dB === undefined) continue;
    if (!best || dA + dB < best.depthA + best.depthB) {
      best = { ancestorId: id, depthA: dA, depthB: dB };
    }
  }

  return best;
}

// ─── Relationship path ────────────────────────────────────────────────────────

export interface RelationshipPath {
  pathUp: FamilyMember[];   // A → ... → commonAncestor (inclusive)
  pathDown: FamilyMember[]; // commonAncestor → ... → B (inclusive, ancestor excluded)
}

export function findRelationshipPath(
  idA: string,
  idB: string,
  members: FamilyMember[]
): RelationshipPath | null {
  const ca = findCommonAncestor(idA, idB, members);
  if (!ca) return null;

  const memberMap = new Map(members.map(m => [m.id, m]));

  const chainA = buildAncestryChain(idA, memberMap, ca.ancestorId);
  const chainB = buildAncestryChain(idB, memberMap, ca.ancestorId);

  const resolve = (id: string) => memberMap.get(id)!;

  return {
    pathUp: chainA.map(resolve).filter(Boolean),
    pathDown: chainB.slice(0, -1).reverse().map(resolve).filter(Boolean),
  };
}

// ─── Kinship naming ───────────────────────────────────────────────────────────

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function greats(n: number): string {
  return n > 0 ? `${"Great-".repeat(n)}` : "";
}

/**
 * Returns a human-readable kinship label for the phrase "A is B's [label]".
 * dA = steps from A up to the common ancestor
 * dB = steps from B up to the common ancestor
 * genderA = gender of A (the subject being described — determines Father vs Mother, Son vs Daughter, etc.)
 */
export function kinshipLabel(
  dA: number,
  dB: number,
  genderA: string | undefined
): string {
  const isMale = genderA === "Male";
  const isFemale = genderA === "Female";

  // A is a direct ancestor of B (A IS the common ancestor, dA = 0)
  // → "A is B's Father / Grandfather / Great-Grandfather …"
  if (dA === 0) {
    if (dB === 1) return isFemale ? "Mother" : "Father";
    if (dB === 2) return isFemale ? "Grandmother" : "Grandfather";
    return `${greats(dB - 2)}Grand${isFemale ? "mother" : "father"}`;
  }

  // B is a direct ancestor of A (B IS the common ancestor, dB = 0)
  // → "A is B's Son / Grandson / Great-Grandson …"
  if (dB === 0) {
    if (dA === 1) return isFemale ? "Daughter" : "Son";
    if (dA === 2) return isFemale ? "Granddaughter" : "Grandson";
    return `${greats(dA - 2)}Grand${isFemale ? "daughter" : "son"}`;
  }

  // Siblings
  if (dA === 1 && dB === 1) return isFemale ? "Sister" : "Brother";

  // Uncle / Aunt
  if (dA === 1 && dB >= 2) {
    return `${greats(dB - 2)}${isFemale ? "Aunt" : "Uncle"}`;
  }

  // Niece / Nephew
  if (dB === 1 && dA >= 2) {
    return `${greats(dA - 2)}${isFemale ? "Niece" : "Nephew"}`;
  }

  // Cousins
  const degree = Math.min(dA, dB) - 1;
  const removed = Math.abs(dA - dB);

  const degreeLabel = `${ordinal(degree)} Cousin`;
  const removedLabel =
    removed === 0 ? "" :
    removed === 1 ? " Once Removed" :
    removed === 2 ? " Twice Removed" :
    ` ${removed}x Removed`;

  return `${degreeLabel}${removedLabel}`;
}

// ─── Full relationship result ─────────────────────────────────────────────────

export interface RelationshipResult {
  label: string;
  reversedLabel: string;
  commonAncestor: FamilyMember;
  depthA: number;
  depthB: number;
  path: RelationshipPath;
  description: string;
}

export function calculateRelationship(
  memberA: FamilyMember,
  memberB: FamilyMember,
  members: FamilyMember[]
): RelationshipResult | null {
  const ca = findCommonAncestor(memberA.id, memberB.id, members);
  if (!ca) return null;

  const memberMap = new Map(members.map(m => [m.id, m]));
  const ancestor = memberMap.get(ca.ancestorId);
  if (!ancestor) return null;

  const path = findRelationshipPath(memberA.id, memberB.id, members);
  if (!path) return null;

  const label = kinshipLabel(ca.depthA, ca.depthB, memberA.gender);
  const reversedLabel = kinshipLabel(ca.depthB, ca.depthA, memberB.gender);

  const ancestorNote =
    ca.depthA === 0 ? "" :
    ca.depthB === 0 ? "" :
    ` via ${ancestor.fullName}`;

  const description = `${memberA.fullName} is ${memberB.fullName}'s ${label}${ancestorNote}.`;

  return { label, reversedLabel, commonAncestor: ancestor, depthA: ca.depthA, depthB: ca.depthB, path, description };
}

// ─── Genealogy insight queries ────────────────────────────────────────────────

export interface GenealogyInsights {
  longestChain: { members: FamilyMember[]; length: number };
  largestSiblingGroup: { parent: FamilyMember | null; children: FamilyMember[]; count: number };
  generationCounts: Record<number, number>;
  countrySpread: number;
  citySpread: number;
}

export function computeGenealogyInsights(members: FamilyMember[]): GenealogyInsights {
  const memberMap = new Map(members.map(m => [m.id, m]));

  // Longest lineage chain — find deepest leaf, trace back to root
  const maxGen = Math.max(1, ...members.map(m => m.generationNumber ?? 1));
  const deepestLeaf = members
    .filter(m => (m.generationNumber ?? 1) === maxGen)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))[0];

  const longestChainMembers: FamilyMember[] = [];
  if (deepestLeaf) {
    const visited = new Set<string>();
    let cur: FamilyMember | undefined = deepestLeaf;
    while (cur && !visited.has(cur.id)) {
      longestChainMembers.unshift(cur);
      visited.add(cur.id);
      const parentId: string | undefined = cur.fatherId || cur.motherId;
      cur = parentId ? memberMap.get(parentId) : undefined;
    }
  }

  // Largest sibling group
  const parentChildCount: Record<string, string[]> = {};
  members.forEach(m => {
    const parentId = m.fatherId || m.motherId;
    if (parentId) {
      parentChildCount[parentId] = [...(parentChildCount[parentId] ?? []), m.id];
    }
  });

  let largestGroupParentId = "";
  let largestCount = 0;
  Object.entries(parentChildCount).forEach(([pid, childIds]) => {
    if (childIds.length > largestCount) {
      largestCount = childIds.length;
      largestGroupParentId = pid;
    }
  });

  const largestParent = largestGroupParentId ? memberMap.get(largestGroupParentId) ?? null : null;
  const largestChildren = (parentChildCount[largestGroupParentId] ?? [])
    .map(id => memberMap.get(id))
    .filter((m): m is FamilyMember => !!m);

  // Generation counts
  const generationCounts: Record<number, number> = {};
  members.forEach(m => {
    const g = m.generationNumber ?? 0;
    generationCounts[g] = (generationCounts[g] ?? 0) + 1;
  });

  // Geographic spread
  const countries = new Set(members.map(m => m.country).filter(Boolean));
  const cities = new Set(members.map(m => m.city).filter(Boolean));

  return {
    longestChain: { members: longestChainMembers, length: longestChainMembers.length },
    largestSiblingGroup: { parent: largestParent, children: largestChildren, count: largestCount },
    generationCounts,
    countrySpread: countries.size,
    citySpread: cities.size,
  };
}
