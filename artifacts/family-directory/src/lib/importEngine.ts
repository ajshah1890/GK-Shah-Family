/**
 * 2-pass genealogy import engine — ID-first relationship resolution.
 *
 * Pass 1 — Parse rows, assign internal UUIDs, build lookup maps:
 *           excelIdToUUID  (Excel memberId → internalUUID)
 *           importedByNorm (normalised name → {id, raw})
 *
 * Pass 2 — Resolve fatherId / motherId / spouseId:
 *   Priority 1: Excel memberId column → UUID via excelIdToUUID
 *   Priority 2: memberId of an existing store member
 *   Priority 3: existing store member UUID (handles re-imports)
 *   Fallback  : fuzzy name matching (fatherName / motherName / spouseName)
 *
 * Post  — Rebuild childrenIds, repair lineageRootId, optionally recompute
 *         generations, detect circular ancestry, flag self-references.
 */

import { FamilyMember } from "@/types/family";
import {
  rebuildChildrenArrays,
  repairMissingLineageRoots,
  detectCircularRelationships,
} from "./familyTree";

// ─── Utilities ────────────────────────────────────────────────────────────────

function norm(s: unknown): string {
  if (!s || typeof s !== "string") return "";
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type WarnType =
  | "duplicate_in_file"
  | "duplicate_in_store"
  | "missing_father"
  | "missing_mother"
  | "unresolved_spouse"
  | "self_reference"
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
  /** Relationships resolved using Excel / store member IDs */
  resolvedByID: number;
  /** Relationships resolved using fuzzy name fallback */
  resolvedByName: number;
  /** Relationships that could not be resolved at all */
  unresolvedCount: number;
  /** Imported members with no parents, children, or spouse */
  isolatedNodes: number;
}

export interface ImportResult {
  /** Final member list to persist (unchanged if dryRun=true) */
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
  /**
   * When true: recompute generationNumber for every member from the tree
   *            structure, overwriting imported values.
   * When false (default): preserve Excel generation values; only fill in
   *            members that have no generationNumber at all.
   */
  recomputeGenerations: boolean;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type RawMember = FamilyMember & { fatherName?: string; motherName?: string };

type ResolvedRel =
  | { uuid: string; via: "id" }
  | { uuid: string; via: "name" };

// ─── Core engine ─────────────────────────────────────────────────────────────

export function runImport(
  rawRows: unknown[][],
  headers: string[],
  mapping: Record<string, string>,
  existingMembers: FamilyMember[],
  options: ImportOptions,
): ImportResult {
  const warnings: ImportWarning[] = [];

  // ── Field → column index ──────────────────────────────────────────────────
  const colOf: Record<string, number> = {};
  headers.forEach((h, i) => {
    const field = mapping[h];
    if (field) colOf[field] = i;
  });

  if (colOf["fullName"] === undefined) {
    return {
      members: existingMembers,
      warnings: [{ memberName: "(all)", type: "missing_father", detail: "No 'Full Name' column mapped — cannot import." }],
      stats: makeEmptyStats(rawRows.length),
    };
  }

  // ── Build existing-member lookup maps ─────────────────────────────────────
  const existingByNorm     = new Map<string, FamilyMember>(); // normalised name
  const existingByMemberId = new Map<string, FamilyMember>(); // Excel-style memberId e.g. GK-G1-0001
  const existingByUUID     = new Map<string, FamilyMember>(); // internal UUID

  for (const m of existingMembers) {
    existingByNorm.set(norm(m.fullName), m);
    if (m.memberId) existingByMemberId.set(m.memberId.trim(), m);
    existingByUUID.set(m.id, m);
  }

  // ── PASS 1: Parse rows, assign UUIDs, build lookup maps ───────────────────
  //
  // excelIdToUUID maps the Excel "Member ID" column value for each row to the
  // internal UUID we generate. This is the primary ID translation table.
  const excelIdToUUID  = new Map<string, string>(); // Excel memberId → UUID
  const importedByNorm = new Map<string, { id: string; raw: RawMember }>();
  const rawBatch: RawMember[] = [];
  let duplicatesInFile = 0;
  const now = new Date().toISOString();

  for (const row of rawRows) {
    const arr = row as unknown[];
    const raw: Record<string, unknown> = {};

    for (const [field, ci] of Object.entries(colOf)) {
      const val = arr[ci];
      if (val === undefined || val === null || str(val) === "") continue;

      if (field === "childrenNames") {
        raw[field] = str(val).split(",").map(s => s.trim()).filter(Boolean);
      } else if (field === "generationNumber" || field === "siblingOrder") {
        const n = Number(val);
        if (!isNaN(n) && n > 0) raw[field] = n;
      } else {
        raw[field] = str(val).replace(/\s+/g, " ");
      }
    }

    if (!norm(raw["fullName"])) continue;

    // Deduplicate within file (by normalised name)
    const nameKey = norm(raw["fullName"]);
    if (importedByNorm.has(nameKey)) {
      duplicatesInFile++;
      warnings.push({
        memberName: str(raw["fullName"]),
        type: "duplicate_in_file",
        detail: `"${raw["fullName"]}" appears more than once — only the first row is used.`,
      });
      continue;
    }

    const uuid = crypto.randomUUID();
    raw["id"]        = uuid;
    raw["addedAt"]   = now;
    raw["updatedAt"] = now;

    const member = raw as unknown as RawMember;

    // Register Excel memberId → UUID translation
    const excelMId = str(raw["memberId"]);
    if (excelMId) excelIdToUUID.set(excelMId, uuid);

    importedByNorm.set(nameKey, { id: uuid, raw: member });
    rawBatch.push(member);
  }

  // ── PASS 2: Resolve relationship IDs ──────────────────────────────────────
  //
  // Resolution priority for each relationship field:
  //   1. Excel memberId column in this file  (excelIdToUUID)
  //   2. memberId of an existing store member (existingByMemberId)
  //   3. Raw UUID of an existing store member (existingByUUID)
  //   4. Fuzzy name fallback                  (importedByNorm / existingByNorm)

  let resolvedByID   = 0;
  let resolvedByName = 0;
  let unresolvedCount = 0;

  /**
   * Try to resolve a raw Excel ID value to an internal UUID.
   * Returns {uuid, via:"id"} when found via ID lookup.
   */
  function resolveByExcelId(excelId: unknown): ResolvedRel | undefined {
    const s = str(excelId);
    if (!s) return undefined;

    // Check this file's batch first
    const fromBatch = excelIdToUUID.get(s);
    if (fromBatch) return { uuid: fromBatch, via: "id" };

    // Check existing store by memberId
    const fromStore = existingByMemberId.get(s);
    if (fromStore) return { uuid: fromStore.id, via: "id" };

    // Check existing store by raw UUID (handles re-import of previously exported data)
    const fromUUID = existingByUUID.get(s);
    if (fromUUID) return { uuid: fromUUID.id, via: "id" };

    return undefined;
  }

  /** Fuzzy name fallback — searches import batch then existing store. */
  function resolveByName(name: unknown): ResolvedRel | undefined {
    const n = norm(name);
    if (!n) return undefined;
    const fromBatch = importedByNorm.get(n)?.id;
    if (fromBatch) return { uuid: fromBatch, via: "name" };
    const fromStore = existingByNorm.get(n)?.id;
    if (fromStore) return { uuid: fromStore, via: "name" };
    return undefined;
  }

  function applyResolution(r: ResolvedRel) {
    if (r.via === "id") resolvedByID++;
    else resolvedByName++;
  }

  // Build a quick UUID → excelMemberId reverse map for self-reference detection
  const uuidToExcelId = new Map(
    [...excelIdToUUID.entries()].map(([excelId, uuid]) => [uuid, excelId]),
  );

  for (const raw of rawBatch) {
    const label       = raw.fullName;
    const selfExcelId = str(raw.memberId);
    const selfUUID    = raw.id;

    // ── fatherId ────────────────────────────────────────────────────────────
    if (str(raw.fatherId)) {
      // Self-reference?
      if (str(raw.fatherId) === selfExcelId || str(raw.fatherId) === selfUUID) {
        warnings.push({ memberName: label, type: "self_reference", detail: "Father ID references this member — ignored." });
        raw.fatherId = undefined;
      } else {
        const r = resolveByExcelId(raw.fatherId);
        if (r) { raw.fatherId = r.uuid; applyResolution(r); }
        else {
          // ID given but not found — try name fallback
          const byName = resolveByName(raw.fatherName);
          if (byName) { raw.fatherId = byName.uuid; applyResolution(byName); }
          else {
            warnings.push({ memberName: label, type: "missing_father", detail: `Father ID "${raw.fatherId}" not found in file or directory.` });
            unresolvedCount++;
            raw.fatherId = undefined; // clear invalid reference
          }
        }
      }
    } else if (str(raw.fatherName)) {
      // No fatherId column — name-only fallback
      const r = resolveByName(raw.fatherName);
      if (r) { raw.fatherId = r.uuid; applyResolution(r); }
      else {
        warnings.push({ memberName: label, type: "missing_father", detail: `Father "${raw.fatherName}" not found in file or directory.` });
        unresolvedCount++;
      }
    }

    // ── motherId ────────────────────────────────────────────────────────────
    if (str(raw.motherId)) {
      if (str(raw.motherId) === selfExcelId || str(raw.motherId) === selfUUID) {
        warnings.push({ memberName: label, type: "self_reference", detail: "Mother ID references this member — ignored." });
        raw.motherId = undefined;
      } else {
        const r = resolveByExcelId(raw.motherId);
        if (r) { raw.motherId = r.uuid; applyResolution(r); }
        else {
          const byName = resolveByName(raw.motherName);
          if (byName) { raw.motherId = byName.uuid; applyResolution(byName); }
          else {
            warnings.push({ memberName: label, type: "missing_mother", detail: `Mother ID "${raw.motherId}" not found in file or directory.` });
            unresolvedCount++;
            raw.motherId = undefined;
          }
        }
      }
    } else if (str(raw.motherName)) {
      const r = resolveByName(raw.motherName);
      if (r) { raw.motherId = r.uuid; applyResolution(r); }
      else {
        warnings.push({ memberName: label, type: "missing_mother", detail: `Mother "${raw.motherName}" not found in file or directory.` });
        unresolvedCount++;
      }
    }

    // ── spouseId ────────────────────────────────────────────────────────────
    if (str(raw.spouseId)) {
      if (str(raw.spouseId) === selfExcelId || str(raw.spouseId) === selfUUID) {
        warnings.push({ memberName: label, type: "self_reference", detail: "Spouse ID references this member — ignored." });
        raw.spouseId = undefined;
      } else {
        const r = resolveByExcelId(raw.spouseId);
        if (r) { raw.spouseId = r.uuid; applyResolution(r); }
        else {
          const byName = resolveByName(raw.spouseName);
          if (byName) { raw.spouseId = byName.uuid; applyResolution(byName); }
          else {
            warnings.push({ memberName: label, type: "unresolved_spouse", detail: `Spouse ID "${raw.spouseId}" not found in file or directory.` });
            unresolvedCount++;
            raw.spouseId = undefined;
          }
        }
      }
    } else if (str(raw.spouseName) && !str(raw.spouseId)) {
      const r = resolveByName(raw.spouseName);
      if (r) { raw.spouseId = r.uuid; applyResolution(r); }
      else {
        warnings.push({ memberName: label, type: "unresolved_spouse", detail: `Spouse "${raw.spouseName}" not found in file or directory.` });
        unresolvedCount++;
      }
    }

    // ── lineageRootId — validate, don't preserve invalid references ─────────
    if (str(raw.lineageRootId)) {
      const rootResolved = resolveByExcelId(raw.lineageRootId);
      if (rootResolved) {
        raw.lineageRootId = rootResolved.uuid;
      } else if (!existingByUUID.has(str(raw.lineageRootId))) {
        // Invalid lineageRootId — clear so repairMissingLineageRoots rebuilds it
        raw.lineageRootId = undefined;
      }
      // else: it's an existing-member UUID — keep as-is
    }

    // Strip import-only helper fields before persisting
    delete raw.fatherName;
    delete raw.motherName;
  }

  // ── Bidirectional spouse backlinks ────────────────────────────────────────
  const batchById = new Map(rawBatch.map(r => [r.id, r]));
  for (const raw of rawBatch) {
    if (raw.spouseId) {
      const spouse = batchById.get(raw.spouseId);
      if (spouse && !str(spouse.spouseId)) {
        spouse.spouseId = raw.id;
        resolvedByID++; // backlink counts as an ID-resolved relationship
      }
    }
  }
  void uuidToExcelId; // silence unused warning

  // ── Duplicate-in-store warnings ───────────────────────────────────────────
  for (const raw of rawBatch) {
    if (existingByNorm.has(norm(raw.fullName))) {
      warnings.push({
        memberName: raw.fullName,
        type: "duplicate_in_store",
        detail: `"${raw.fullName}" already exists — will be ${options.duplicateMode === "update" ? "overwritten" : "skipped"}.`,
      });
    }
  }

  // ── Merge with existing members ───────────────────────────────────────────
  let newCount = 0, updatedCount = 0, skippedCount = 0;
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
  inferGenerations(baseMemberList, options.recomputeGenerations);
  let finalMembers = rebuildChildrenArrays(baseMemberList);
  finalMembers = repairMissingLineageRoots(finalMembers);

  // Circular ancestry detection
  const circularIds = detectCircularRelationships(finalMembers);
  if (circularIds.length > 0) {
    const byId = new Map(finalMembers.map(m => [m.id, m]));
    for (const id of circularIds) {
      const m = byId.get(id);
      warnings.push({
        memberName: m?.fullName ?? id,
        type: "circular_ancestry",
        detail: "Part of a circular ancestry chain — check parent IDs.",
      });
    }
  }

  // Isolated nodes (imported members with no links at all)
  let isolatedNodes = 0;
  if (finalMembers.length > 1) {
    const importedIds = new Set(rawBatch.map(r => r.id));
    const byIdFinal   = new Map(finalMembers.map(m => [m.id, m]));
    for (const id of importedIds) {
      const m = byIdFinal.get(id);
      if (m && !m.fatherId && !m.motherId && !m.spouseId && (!m.childrenIds || m.childrenIds.length === 0)) {
        isolatedNodes++;
        warnings.push({
          memberName: m.fullName,
          type: "orphan",
          detail: "No parents, children, or spouse linked — isolated in the tree.",
        });
      }
    }
  }

  const stats: ImportStats = {
    totalRows: rawRows.length,
    validRows: rawBatch.length,
    newMembers: newCount,
    updatedMembers: updatedCount,
    skippedMembers: skippedCount,
    duplicatesInFile,
    resolvedByID,
    resolvedByName,
    unresolvedCount,
    isolatedNodes,
  };

  if (options.dryRun) {
    return { members: existingMembers, warnings, stats };
  }

  return { members: finalMembers, warnings, stats };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * BFS from root members to assign generationNumber.
 * @param force  When true, overwrite existing values. When false (default),
 *               only fill in members that have no generationNumber.
 */
function inferGenerations(members: FamilyMember[], force = false) {
  const byId = new Map(members.map(m => [m.id, m]));
  const processed = new Set<string>();

  // Build children map from parent links (childrenIds may not be rebuilt yet)
  const childrenOf = new Map<string, string[]>();
  for (const m of members) {
    for (const pid of [m.fatherId, m.motherId]) {
      if (!pid) continue;
      const list = childrenOf.get(pid) ?? [];
      list.push(m.id);
      childrenOf.set(pid, list);
    }
  }

  const roots = members.filter(m => !m.fatherId && !m.motherId);
  const queue: Array<{ id: string; gen: number }> = roots.map(r => ({
    id: r.id,
    gen: (!force && r.generationNumber) ? r.generationNumber : 1,
  }));

  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (processed.has(id)) continue;
    processed.add(id);

    const m = byId.get(id);
    if (!m) continue;

    if (force || !m.generationNumber) {
      (m as unknown as Record<string, unknown>)["generationNumber"] = gen;
    }

    for (const childId of childrenOf.get(id) ?? []) {
      if (!processed.has(childId)) {
        const child = byId.get(childId);
        const childGen = (!force && child?.generationNumber) ? child.generationNumber : gen + 1;
        queue.push({ id: childId, gen: childGen });
      }
    }
  }
}

function makeEmptyStats(totalRows: number): ImportStats {
  return { totalRows, validRows: 0, newMembers: 0, updatedMembers: 0, skippedMembers: 0, duplicatesInFile: 0, resolvedByID: 0, resolvedByName: 0, unresolvedCount: 0, isolatedNodes: 0 };
}
