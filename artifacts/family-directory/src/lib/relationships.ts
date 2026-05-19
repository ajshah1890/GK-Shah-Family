import { FamilyMember } from "@/types/family";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/** A relation expressed in English + optional Gujarati family term (English script). */
export interface RelationLabel {
  english: string;
  gujarati?: string;
}

export interface CommonAncestor {
  ancestorId: string;
  depthA: number;
  depthB: number;
}

export interface RelationshipPath {
  pathUp: FamilyMember[];
  pathDown: FamilyMember[];
}

export interface RelationshipResult {
  label: RelationLabel;
  reversedLabel: RelationLabel;
  commonAncestor?: FamilyMember;
  depthA: number;
  depthB: number;
  path: RelationshipPath;
  description: string;
  isSpouseRelation: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 1 — GRAPH HELPERS (blood-only traversal)
// ═══════════════════════════════════════════════════════════════════

/**
 * BFS up the blood ancestry tree from startId.
 * Returns id → steps-above-startId (1 = parent, 2 = grandparent …).
 */
export function buildAncestorDepthMap(
  startId: string,
  memberMap: Map<string, FamilyMember>
): Map<string, number> {
  const result = new Map<string, number>();
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];

  while (queue.length) {
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

/** True if `ancestorId` is a direct blood ancestor of (or equal to) `descendantId`. */
function isAncestorOf(
  ancestorId: string,
  descendantId: string | undefined,
  memberMap: Map<string, FamilyMember>
): boolean {
  if (!descendantId) return false;
  if (descendantId === ancestorId) return true;
  return buildAncestorDepthMap(descendantId, memberMap).has(ancestorId);
}

/**
 * Determine whether the common ancestor is on B's paternal or maternal side.
 * This is the key driver for Kaka/Mama, Dada/Nana, Dadi/Nani, Fui/Masi, etc.
 */
function getRelationSide(
  commonAncestorId: string,
  B: FamilyMember,
  memberMap: Map<string, FamilyMember>
): "paternal" | "maternal" | null {
  // Direct parent of B (dB = 1)
  if (commonAncestorId === B.fatherId) return "paternal";
  if (commonAncestorId === B.motherId) return "maternal";
  // Deeper: check which parent-chain leads to the common ancestor
  if (isAncestorOf(commonAncestorId, B.fatherId, memberMap)) return "paternal";
  if (isAncestorOf(commonAncestorId, B.motherId, memberMap)) return "maternal";
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 2 — COMMON ANCESTOR & RELATIONSHIP PATH
// ═══════════════════════════════════════════════════════════════════

export function findCommonAncestor(
  idA: string,
  idB: string,
  members: FamilyMember[]
): CommonAncestor | null {
  if (idA === idB) return null;
  const memberMap = new Map(members.map(m => [m.id, m]));
  const mapA = buildAncestorDepthMap(idA, memberMap);
  const mapB = buildAncestorDepthMap(idB, memberMap);
  // Include self so direct ancestor/descendant relationships are found
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

function buildAncestryChain(
  startId: string,
  memberMap: Map<string, FamilyMember>,
  stopAtId?: string
): string[] {
  const chain = [startId];
  const visited = new Set([startId]);
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

export function findRelationshipPath(
  idA: string,
  idB: string,
  members: FamilyMember[]
): RelationshipPath | null {
  const ca = findCommonAncestor(idA, idB, members);
  if (!ca) return null;
  const memberMap = new Map(members.map(m => [m.id, m]));
  const resolve = (id: string) => memberMap.get(id)!;
  const chainA = buildAncestryChain(idA, memberMap, ca.ancestorId);
  const chainB = buildAncestryChain(idB, memberMap, ca.ancestorId);
  return {
    pathUp: chainA.map(resolve).filter(Boolean),
    pathDown: chainB.slice(0, -1).reverse().map(resolve).filter(Boolean),
  };
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 3A — BLOOD RELATION LABEL (English + Gujarati)
//
// Priority order (per spec):
//   1. Direct ancestor / descendant
//   2. Sibling
//   3. Uncle / Aunt (paternal/maternal — BEFORE cousin math)
//   4. Nephew / Niece
//   5. Deeper generational variants (great-uncle, etc.)
//   6. Cousin formulas — last resort
// ═══════════════════════════════════════════════════════════════════

type Gender = FamilyMember["gender"];
const isMaleG   = (g: Gender) => g === "Male";
const isFemaleG = (g: Gender) => g === "Female";

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
function greats(n: number) { return n > 0 ? "Great-".repeat(n) : ""; }

function bloodRelationLabel(
  dA: number,
  dB: number,
  genderA: Gender,
  commonAncestorId: string,
  B: FamilyMember,
  memberMap: Map<string, FamilyMember>
): RelationLabel {
  const side = getRelationSide(commonAncestorId, B, memberMap);
  const fem = isFemaleG(genderA);

  // ── 1. A is direct ancestor of B (dA = 0) ────────────────────────────────
  if (dA === 0) {
    if (dB === 1) {
      return fem ? { english: "Mother",  gujarati: "Maa"  }
                 : { english: "Father",  gujarati: "Pita" };
    }
    if (dB === 2) {
      if (fem) {
        return side === "maternal"
          ? { english: "Maternal Grandmother", gujarati: "Nani" }
          : { english: "Paternal Grandmother", gujarati: "Dadi" };
      }
      return side === "maternal"
        ? { english: "Maternal Grandfather", gujarati: "Nana" }
        : { english: "Paternal Grandfather", gujarati: "Dada" };
    }
    // Great-grandparent and beyond
    const g = dB - 2;
    if (fem) {
      return side === "maternal"
        ? { english: `${greats(g)}Maternal Grandmother`, gujarati: g === 1 ? "Par Nani" : undefined }
        : { english: `${greats(g)}Paternal Grandmother`, gujarati: g === 1 ? "Par Dadi" : undefined };
    }
    return side === "maternal"
      ? { english: `${greats(g)}Maternal Grandfather`, gujarati: g === 1 ? "Par Nana" : undefined }
      : { english: `${greats(g)}Paternal Grandfather`, gujarati: g === 1 ? "Par Dada" : undefined };
  }

  // ── 2. B is direct ancestor of A (dB = 0) ────────────────────────────────
  if (dB === 0) {
    if (dA === 1) {
      return fem ? { english: "Daughter", gujarati: "Dikri" }
                 : { english: "Son",      gujarati: "Dikro" };
    }
    if (dA === 2) {
      return fem ? { english: "Granddaughter", gujarati: "Poti" }
                 : { english: "Grandson",      gujarati: "Pota" };
    }
    const g = dA - 2;
    return fem
      ? { english: `${greats(g)}Granddaughter`, gujarati: g === 1 ? "Par Poti" : undefined }
      : { english: `${greats(g)}Grandson`,      gujarati: g === 1 ? "Par Pota" : undefined };
  }

  // ── 3. Siblings ───────────────────────────────────────────────────────────
  if (dA === 1 && dB === 1) {
    return fem ? { english: "Sister", gujarati: "Ben"  }
               : { english: "Brother", gujarati: "Bhai" };
  }

  // ── 4. Uncle / Aunt — explicit priority over cousin math ─────────────────
  if (dA === 1 && dB === 2) {
    if (fem) {
      return side === "maternal"
        ? { english: "Maternal Aunt", gujarati: "Masi" }
        : { english: "Paternal Aunt", gujarati: "Fui"  };
    }
    return side === "maternal"
      ? { english: "Maternal Uncle", gujarati: "Mama" }
      : { english: "Paternal Uncle", gujarati: "Kaka" };
  }

  // ── 5. Nephew / Niece ─────────────────────────────────────────────────────
  if (dA === 2 && dB === 1) {
    return fem ? { english: "Niece",   gujarati: "Bhatiji" }
               : { english: "Nephew",  gujarati: "Bhatijo" };
  }

  // ── 6. Great-uncle / Great-aunt (dA=1, dB≥3) ─────────────────────────────
  if (dA === 1 && dB >= 3) {
    const g = dB - 2;
    if (fem) {
      return side === "maternal"
        ? { english: `${greats(g)}Maternal Aunt`  }
        : { english: `${greats(g)}Paternal Aunt`  };
    }
    return side === "maternal"
      ? { english: `${greats(g)}Maternal Uncle` }
      : { english: `${greats(g)}Paternal Uncle` };
  }

  // ── 7. Grand-nephew / Grand-niece (dA≥3, dB=1) ───────────────────────────
  if (dA >= 3 && dB === 1) {
    const g = dA - 2;
    return fem
      ? { english: `${greats(g)}Niece`   }
      : { english: `${greats(g)}Nephew`  };
  }

  // ── 8. Cousins — last resort ──────────────────────────────────────────────
  const degree = Math.min(dA, dB) - 1;
  const removed = Math.abs(dA - dB);
  const removedLabel =
    removed === 0 ? "" :
    removed === 1 ? " Once Removed" :
    removed === 2 ? " Twice Removed" :
    ` ${removed}x Removed`;
  return { english: `${ordinal(degree)} Cousin${removedLabel}` };
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 3B — MARRIED-IN / SPOUSE-OF-RELATIVE INFERENCE
//
// Detects: Kaki, Mami, Fuva, Masa, Bhabhi, Jijaji, etc.
// Checks if A is the spouse of one of B's blood relatives.
// ═══════════════════════════════════════════════════════════════════

function inferSpouseRelation(
  A: FamilyMember,
  B: FamilyMember,
  members: FamilyMember[],
  memberMap: Map<string, FamilyMember>
): RelationLabel | null {
  if (!A.spouseId) return null;
  const spouse = memberMap.get(A.spouseId);
  if (!spouse) return null;

  const ca = findCommonAncestor(spouse.id, B.id, members);
  if (!ca) return null;

  const { depthA: dSp, depthB: dB } = ca;
  const side = getRelationSide(ca.ancestorId, B, memberMap);
  const fem = isFemaleG(A.gender);

  // Spouse is B's sibling → Bhabhi / Jijaji
  if (dSp === 1 && dB === 1) {
    return fem
      ? { english: "Sister-in-law (Brother's Wife)", gujarati: "Bhabhi" }
      : { english: "Brother-in-law (Sister's Husband)", gujarati: "Jijaji" };
  }

  // Spouse is B's uncle (Kaka/Mama) → wife is Kaki / Mami
  if (dSp === 1 && dB === 2 && isMaleG(spouse.gender) && fem) {
    return side === "maternal"
      ? { english: "Maternal Uncle's Wife", gujarati: "Mami" }
      : { english: "Paternal Uncle's Wife", gujarati: "Kaki" };
  }

  // Spouse is B's aunt (Fui/Masi) → husband is Fuva / Masa
  if (dSp === 1 && dB === 2 && isFemaleG(spouse.gender) && !fem) {
    return side === "maternal"
      ? { english: "Maternal Aunt's Husband", gujarati: "Masa"  }
      : { english: "Paternal Aunt's Husband", gujarati: "Fuva" };
  }

  // Spouse is B's parent → step-parent figure
  if (dSp === 0 && dB === 1) {
    return fem ? { english: "Mother", gujarati: "Maa"  }
               : { english: "Father", gujarati: "Pita" };
  }

  // Generic: spouse of [relation]
  const spouseLabel = bloodRelationLabel(dSp, dB, spouse.gender, ca.ancestorId, B, memberMap);
  return { english: `${spouseLabel.english}'s Spouse` };
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 4 — PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export function calculateRelationship(
  memberA: FamilyMember,
  memberB: FamilyMember,
  members: FamilyMember[]
): RelationshipResult | null {
  const memberMap = new Map(members.map(m => [m.id, m]));

  // ── Priority 1: Direct spouses ────────────────────────────────────────────
  const areSpouses = memberA.spouseId === memberB.id || memberB.spouseId === memberA.id;
  if (areSpouses) {
    const label: RelationLabel = isFemaleG(memberA.gender)
      ? { english: "Wife",    gujarati: "Patni" }
      : { english: "Husband", gujarati: "Pati"  };
    const reversedLabel: RelationLabel = isFemaleG(memberB.gender)
      ? { english: "Wife",    gujarati: "Patni" }
      : { english: "Husband", gujarati: "Pati"  };
    return {
      label, reversedLabel,
      depthA: 0, depthB: 0,
      path: { pathUp: [memberA], pathDown: [memberB] },
      description: `${memberA.fullName} is ${memberB.fullName}'s ${label.english}.`,
      isSpouseRelation: true,
    };
  }

  // ── Priority 2: Blood relation via common ancestor ────────────────────────
  const ca = findCommonAncestor(memberA.id, memberB.id, members);
  if (ca) {
    const ancestor = memberMap.get(ca.ancestorId);
    if (!ancestor) return null;
    const path = findRelationshipPath(memberA.id, memberB.id, members);
    if (!path) return null;

    const label = bloodRelationLabel(
      ca.depthA, ca.depthB, memberA.gender, ca.ancestorId, memberB, memberMap
    );
    const reversedLabel = bloodRelationLabel(
      ca.depthB, ca.depthA, memberB.gender, ca.ancestorId, memberA, memberMap
    );
    const ancestorNote = ca.depthA > 0 && ca.depthB > 0 ? ` via ${ancestor.fullName}` : "";
    return {
      label, reversedLabel,
      commonAncestor: ancestor,
      depthA: ca.depthA, depthB: ca.depthB,
      path,
      description: `${memberA.fullName} is ${memberB.fullName}'s ${label.english}${ancestorNote}.`,
      isSpouseRelation: false,
    };
  }

  // ── Priority 3: Married-in (spouse of a blood relative) ──────────────────
  const spouseLabel = inferSpouseRelation(memberA, memberB, members, memberMap);
  if (spouseLabel) {
    const reverseLabel = inferSpouseRelation(memberB, memberA, members, memberMap)
      ?? { english: "Relative's Spouse" };
    return {
      label: spouseLabel,
      reversedLabel: reverseLabel,
      depthA: 1, depthB: 1,
      path: { pathUp: [memberA], pathDown: [memberB] },
      description: `${memberA.fullName} is ${memberB.fullName}'s ${spouseLabel.english}.`,
      isSpouseRelation: true,
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// LEGACY SHIM — for any callers using the old plain-string API
// ═══════════════════════════════════════════════════════════════════

/** @deprecated Use calculateRelationship() which returns RelationLabel objects. */
export function kinshipLabel(dA: number, dB: number, genderA: string | undefined): string {
  const dummyB = { id: "__b__", fullName: "", gender: undefined } as FamilyMember;
  const map = new Map<string, FamilyMember>();
  return bloodRelationLabel(dA, dB, genderA as Gender, "", dummyB, map).english;
}

// ═══════════════════════════════════════════════════════════════════
// GENEALOGY INSIGHTS — unchanged from previous version
// ═══════════════════════════════════════════════════════════════════

export interface GenealogyInsights {
  longestChain: { members: FamilyMember[]; length: number };
  largestSiblingGroup: { parent: FamilyMember | null; children: FamilyMember[]; count: number };
  generationCounts: Record<number, number>;
  countrySpread: number;
  citySpread: number;
}

export function computeGenealogyInsights(members: FamilyMember[]): GenealogyInsights {
  const memberMap = new Map(members.map(m => [m.id, m]));
  let longestChainMembers: FamilyMember[] = [];

  function dfsLongest(member: FamilyMember, path: FamilyMember[], visited: Set<string>) {
    if (visited.has(member.id)) return;
    visited.add(member.id);
    path.push(member);
    const children = (member.childrenIds ?? [])
      .map(cid => memberMap.get(cid))
      .filter((m): m is FamilyMember => !!m && !visited.has(m.id));
    if (children.length === 0) {
      if (path.length > longestChainMembers.length) longestChainMembers = [...path];
    } else {
      for (const child of children) dfsLongest(child, path, visited);
    }
    path.pop();
    visited.delete(member.id);
  }

  const roots = members.filter(m => !m.fatherId && !m.motherId);
  for (const root of roots) dfsLongest(root, [], new Set());

  if (longestChainMembers.length === 0 && members.length > 0) {
    const maxGen = Math.max(1, ...members.map(m => m.generationNumber ?? 1));
    const deepestLeaf = members
      .filter(m => (m.generationNumber ?? 1) === maxGen)
      .sort((a, b) => a.fullName.localeCompare(b.fullName))[0];
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
  }

  const parentChildCount: Record<string, string[]> = {};
  members.forEach(m => {
    const pid = m.fatherId || m.motherId;
    if (pid) parentChildCount[pid] = [...(parentChildCount[pid] ?? []), m.id];
  });

  let largestGroupParentId = "";
  let largestCount = 0;
  for (const [pid, cids] of Object.entries(parentChildCount)) {
    if (cids.length > largestCount) { largestCount = cids.length; largestGroupParentId = pid; }
  }

  const largestParent = largestGroupParentId ? (memberMap.get(largestGroupParentId) ?? null) : null;
  const largestChildren = (parentChildCount[largestGroupParentId] ?? [])
    .map(id => memberMap.get(id)).filter((m): m is FamilyMember => !!m);

  const generationCounts: Record<number, number> = {};
  members.forEach(m => {
    const g = m.generationNumber ?? 0;
    generationCounts[g] = (generationCounts[g] ?? 0) + 1;
  });

  const countries = new Set(members.map(m => m.country).filter(Boolean));
  const cities    = new Set(members.map(m => m.city).filter(Boolean));

  return {
    longestChain: { members: longestChainMembers, length: longestChainMembers.length },
    largestSiblingGroup: { parent: largestParent, children: largestChildren, count: largestCount },
    generationCounts,
    countrySpread: countries.size,
    citySpread: cities.size,
  };
}
