/**
 * 2-pass genealogy import engine.
 *
 * Pass 1 — Create all members, assign UUIDs, build lookup maps.
 * Pass 2 — Resolve fatherName/motherName/spouseName to IDs.
 * Post   — Rebuild childrenIds, lineageRootId, infer generations,
 *           detect circular ancestry, orphans, duplicates.
 */

import { FamilyMember } from "@/types/family";
import {
  rebuildChildrenArrays,
  repairMissingLineageRoots,
  detectCircularRelationships,
} from "./familyTree";

// ─── Fuzzy normalize ──────────────────────────────────────────────────────────

function norm(s: unknown): string {
  if (!s || typeof s !== "string") return "";
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type WarnType =
  | "duplicate_in_file"
  | "duplicate_in_store"
  | "missing_father"
  | "missing_mother"
  | "unresolved_spouse"
  | "circular_ancestry"
  | "orphan";

export interface ImportWarning {
  memberName: string;
  type: WarnType;
  detail: string;
}

export interface ImportStats {
  totalRows: number;
  validRows: number;
  newMembers: number;
  updatedMembers: number;
  skippedMembers: number;
  duplicatesInFile: number;
  relationshipsResolved: number;
  relationshipsUnresolved: number;
}

export interface ImportResult {
  /** Final member list to persist (existingMembers if dryRun=true) */
  members: FamilyMember[];
  warnings: ImportWarning[];
  stats: ImportStats;
}

export interface ImportOptions {
  duplicateMode: "skip" | "update";
  /** Replace ALL existing members with the imported batch */
  replaceAll: boolean;
  /** Analyse without persisting */
  dryRun: boolean;
}

// ─── Core engine ─────────────────────────────────────────────────────────────

type RawMember = FamilyMember & { fatherName?: string; motherName?: string };

export function runImport(
  rawRows: unknown[][],
  headers: string[],
  mapping: Record<string, string>,
  existingMembers: FamilyMember[],
  options: ImportOptions,
): ImportResult {
  const warnings: ImportWarning[] = [];

  // Field → column index
  const fieldToColIdx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const field = mapping[h];
    if (field) fieldToColIdx[field] = i;
  });

  if (fieldToColIdx["fullName"] === undefined) {
    return {
      members: existingMembers,
      warnings: [{ memberName: "(all)", type: "missing_father", detail: "No 'Full Name' column mapped — cannot import." }],
      stats: { totalRows: rawRows.length, validRows: 0, newMembers: 0, updatedMembers: 0, skippedMembers: 0, duplicatesInFile: 0, relationshipsResolved: 0, relationshipsUnresolved: 0 },
    };
  }

  // ── Existing member lookup maps ───────────────────────────────────────────
  const existingByNorm = new Map<string, FamilyMember>();
  const existingByPhone = new Map<string, FamilyMember>();
  const existingByEmail = new Map<string, FamilyMember>();
  for (const m of existingMembers) {
    existingByNorm.set(norm(m.fullName), m);
    if (m.phone) existingByPhone.set(norm(m.phone), m);
    if (m.email) existingByEmail.set(norm(m.email), m);
  }
  // Silence unused-variable warnings for phone/email maps; they're available
  // for future fuzzy-lookup enhancements.
  void existingByPhone; void existingByEmail;

  // ── PASS 1: Build raw member objects + lookup maps ────────────────────────
  const importedByNorm = new Map<string, { id: string; raw: RawMember }>();
  const rawBatch: RawMember[] = [];
  let duplicatesInFile = 0;
  const now = new Date().toISOString();

  for (const row of rawRows) {
    const arr = row as unknown[];
    const raw: Record<string, unknown> = {};

    for (const [field, colIdx] of Object.entries(fieldToColIdx)) {
      const val = arr[colIdx];
      if (val === undefined || val === null || String(val).trim() === "") continue;

      if (field === "childrenNames") {
        raw[field] = String(val).split(",").map(s => s.trim()).filter(Boolean);
      } else if (field === "generationNumber" || field === "siblingOrder") {
        const n = Number(val);
        if (!isNaN(n) && n > 0) raw[field] = n;
      } else {
        raw[field] = String(val).trim().replace(/\s+/g, " ");
      }
    }

    const name = norm(raw["fullName"]);
    if (!name) continue;

    if (importedByNorm.has(name)) {
      duplicatesInFile++;
      warnings.push({
        memberName: String(raw["fullName"]),
        type: "duplicate_in_file",
        detail: `"${raw["fullName"]}" appears more than once in the file — only the first row is used.`,
      });
      continue;
    }

    const id = crypto.randomUUID();
    raw["id"] = id;
    raw["addedAt"] = now;
    raw["updatedAt"] = now;

    const member = raw as unknown as RawMember;
    importedByNorm.set(name, { id, raw: member });
    rawBatch.push(member);
  }

  // ── PASS 2: Resolve relationships ─────────────────────────────────────────
  let relationshipsResolved = 0;
  let relationshipsUnresolved = 0;

  function resolveId(name: unknown): string | undefined {
    const n = norm(name);
    if (!n) return undefined;
    return importedByNorm.get(n)?.id ?? existingByNorm.get(n)?.id;
  }

  for (const raw of rawBatch) {
    const label = raw.fullName;

    if (raw.fatherName && !raw.fatherId) {
      const id = resolveId(raw.fatherName);
      if (id) { raw.fatherId = id; relationshipsResolved++; }
      else { relationshipsUnresolved++; warnings.push({ memberName: label, type: "missing_father", detail: `Father "${raw.fatherName}" not found in file or directory.` }); }
    }

    if (raw.motherName && !raw.motherId) {
      const id = resolveId(raw.motherName);
      if (id) { raw.motherId = id; relationshipsResolved++; }
      else { relationshipsUnresolved++; warnings.push({ memberName: label, type: "missing_mother", detail: `Mother "${raw.motherName}" not found in file or directory.` }); }
    }

    if (raw.spouseName && !raw.spouseId) {
      const id = resolveId(raw.spouseName);
      if (id) { raw.spouseId = id; relationshipsResolved++; }
      else { relationshipsUnresolved++; warnings.push({ memberName: label, type: "unresolved_spouse", detail: `Spouse "${raw.spouseName}" not found in file or directory.` }); }
    }

    // Strip import-only temp fields before persisting
    delete raw.fatherName;
    delete raw.motherName;
  }

  // Make spouse links bidirectional
  const batchById = new Map(rawBatch.map(r => [r.id, r]));
  for (const raw of rawBatch) {
    if (raw.spouseId) {
      const spouse = batchById.get(raw.spouseId);
      if (spouse && !spouse.spouseId) {
        spouse.spouseId = raw.id;
        relationshipsResolved++;
      }
    }
  }

  // Warn about names that match existing directory members
  for (const raw of rawBatch) {
    if (existingByNorm.has(norm(raw.fullName))) {
      warnings.push({
        memberName: raw.fullName,
        type: "duplicate_in_store",
        detail: `"${raw.fullName}" already exists in the directory — will be ${options.duplicateMode === "update" ? "overwritten" : "skipped"}.`,
      });
    }
  }

  // ── Merge with existing ───────────────────────────────────────────────────
  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let baseMemberList: FamilyMember[];

  if (options.replaceAll) {
    baseMemberList = rawBatch as unknown as FamilyMember[];
    newCount = rawBatch.length;
  } else {
    const updatedExisting = [...existingMembers];
    const added: FamilyMember[] = [];

    for (const raw of rawBatch) {
      const existing = existingByNorm.get(norm(raw.fullName));
      if (existing) {
        if (options.duplicateMode === "update") {
          const idx = updatedExisting.findIndex(m => m.id === existing.id);
          if (idx >= 0) {
            updatedExisting[idx] = {
              ...existing,
              ...(raw as unknown as FamilyMember),
              id: existing.id,
              addedAt: existing.addedAt,
              updatedAt: now,
            };
            updatedCount++;
          }
        } else {
          skippedCount++;
        }
      } else {
        added.push(raw as unknown as FamilyMember);
        newCount++;
      }
    }

    baseMemberList = [...updatedExisting, ...added];
  }

  // ── Post-processing ───────────────────────────────────────────────────────
  inferGenerations(baseMemberList);
  let finalMembers = rebuildChildrenArrays(baseMemberList);
  finalMembers = repairMissingLineageRoots(finalMembers);

  // Circular ancestry
  const circularIds = detectCircularRelationships(finalMembers);
  if (circularIds.length > 0) {
    const byId = new Map(finalMembers.map(m => [m.id, m]));
    for (const id of circularIds) {
      const m = byId.get(id);
      warnings.push({
        memberName: m?.fullName ?? id,
        type: "circular_ancestry",
        detail: "Part of a circular ancestry chain — check parent IDs before importing.",
      });
    }
  }

  // Orphans within the imported batch
  if (finalMembers.length > 1) {
    const importedIds = new Set(rawBatch.map(r => r.id));
    const byIdFinal = new Map(finalMembers.map(m => [m.id, m]));
    for (const id of importedIds) {
      const m = byIdFinal.get(id);
      if (m && !m.fatherId && !m.motherId && !m.spouseId && (!m.childrenIds || m.childrenIds.length === 0)) {
        warnings.push({
          memberName: m.fullName,
          type: "orphan",
          detail: "No parents, children, or spouse linked — this member will be isolated in the tree.",
        });
      }
    }
  }

  if (options.dryRun) {
    return {
      members: existingMembers,
      warnings,
      stats: { totalRows: rawRows.length, validRows: rawBatch.length, newMembers: newCount, updatedMembers: updatedCount, skippedMembers: skippedCount, duplicatesInFile, relationshipsResolved, relationshipsUnresolved },
    };
  }

  return {
    members: finalMembers,
    warnings,
    stats: { totalRows: rawRows.length, validRows: rawBatch.length, newMembers: newCount, updatedMembers: updatedCount, skippedMembers: skippedCount, duplicatesInFile, relationshipsResolved, relationshipsUnresolved },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** BFS from root members (no parents) to infer missing generationNumbers */
function inferGenerations(members: FamilyMember[]) {
  const byId = new Map(members.map(m => [m.id, m]));
  const processed = new Set<string>();

  // First pass: rebuild children so BFS works
  const childrenOf = new Map<string, string[]>();
  for (const m of members) {
    if (m.fatherId) {
      const list = childrenOf.get(m.fatherId) ?? [];
      list.push(m.id);
      childrenOf.set(m.fatherId, list);
    }
    if (m.motherId) {
      const list = childrenOf.get(m.motherId) ?? [];
      list.push(m.id);
      childrenOf.set(m.motherId, list);
    }
  }

  const roots = members.filter(m => !m.fatherId && !m.motherId);
  const queue: Array<{ id: string; gen: number }> = roots.map(r => ({ id: r.id, gen: r.generationNumber ?? 1 }));

  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (processed.has(id)) continue;
    processed.add(id);

    const m = byId.get(id);
    if (!m) continue;
    if (!m.generationNumber) (m as unknown as Record<string, unknown>)["generationNumber"] = gen;

    for (const childId of childrenOf.get(id) ?? []) {
      if (!processed.has(childId)) queue.push({ id: childId, gen: gen + 1 });
    }
  }
}
