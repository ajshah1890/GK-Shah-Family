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

// ─── GitHub hydration disable toggle ─────────────────────────────────────────

/**
 * localStorage key for the "Disable GitHub hydration" debug toggle.
 * When present, all GitHub reads are skipped on init — only localStorage is used.
 * Set/clear from Settings › Debug section.
 */
export const GITHUB_HYDRATION_DISABLED_KEY = 'gkshah_disable_github_hydration';

// ─── Persistence guards ───────────────────────────────────────────────────────
//
// _isSaving:
//   true while addMember / updateMember is executing. Prevents a concurrent
//   GitHub fetch response from blindly overwriting a fresh local write.
//   Auto-clears after 8 s to handle any edge case where the store unmounts
//   before the timer fires.
//
// _localSaveTimestamp:
//   Epoch-ms of the most recent call to save(). Used by smartMergeMembers to
//   know that our local data was written more recently than GitHub returned.

let _isSaving = false;
let _isSavingTimer: ReturnType<typeof setTimeout> | null = null;
let _localSaveTimestamp = 0;

/** localStorage key — when set, the _isSaving lock is never acquired (debug aid). */
export const SAVE_LOCK_DISABLED_KEY = 'gkshah_disable_save_lock';
/** localStorage key — when set, smart merge is bypassed; remote data wins directly. */
export const MERGE_PROTECTION_DISABLED_KEY = 'gkshah_disable_merge_protection';

function setSaving(): void {
  if (localStorage.getItem(SAVE_LOCK_DISABLED_KEY)) {
    console.log('[GKShah] setSaving: save lock DISABLED by debug toggle — skipping');
    return;
  }
  _isSaving = true;
  if (_isSavingTimer) clearTimeout(_isSavingTimer);
  // 3 s is plenty — real GitHub fetches resolve in < 2 s. Shorter window = less
  // risk of a stuck lock if something goes wrong.
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
//
// This ensures a freshly saved birthday / gender / blood group is NEVER
// overwritten by a stale GitHub payload arriving milliseconds later.

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
    // TASK 4 — log updatedAt comparison so we can verify local always wins after a fresh edit
    if (localMs < remoteMs) {
      // Remote wins — log so we can catch any unexpected cases
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
  _localSaveTimestamp = Date.now();
  try {
    const data: StoredData = { version: SCHEMA_VERSION, members };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem('gkshah_local_save_at', String(_localSaveTimestamp));
    // Broadcast to every mounted useFamilyStore instance.
    // useFamilyStore uses per-component useState, so a save in one component
    // is invisible to every other mounted component without this notification.
    window.dispatchEvent(new CustomEvent('gkshah:members-changed', { detail: { count: members.length } }));
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

            // Guard 1 — block if a save is in progress: an in-flight GitHub response
            // must not overwrite a local write that just happened.
            // Use a fresh load() so state reflects any save that happened AFTER
            // init() started capturing `local`.
            if (_isSaving) {
              const localNow = load();
              logHydration(
                `Members: GitHub response arrived during active save — refreshing to post-save state ` +
                `(${migrated.length} remote ignored, ${localNow.length} local preserved)`
              );
              if (!cancelled) {
                setMembers(localNow);
                setIsLoaded(true);
              }
              return;
            }

            // Guard 2 — debug toggle set in Settings › Persistence Controls
            if (localStorage.getItem(GITHUB_HYDRATION_DISABLED_KEY)) {
              logHydration(
                `Members: GitHub hydration disabled by debug toggle — keeping ${local.length} local members`
              );
              if (!cancelled) setIsLoaded(true);
              return;
            }

            // Guard 3 — merge protection disabled: use remote data directly
            if (localStorage.getItem(MERGE_PROTECTION_DISABLED_KEY)) {
              logHydration(
                `Members: merge protection disabled — using ${migrated.length} remote members directly`
              );
              if (!cancelled) {
                setMembers(migrated);
                save(migrated);
                setIsLoaded(true);
              }
              return;
            }

            // Smart merge: per-member updatedAt comparison replaces blind overwrite.
            // Local edits saved after the last GitHub sync always win.
            const { merged, localWins, remoteWins, localOnly, remoteOnly } =
              smartMergeMembers(local, migrated);

            console.group("[GKShah Save Trace] HYDRATION PAYLOAD (members)");
            console.log(
              `Remote=${migrated.length}  Local=${local.length}  Merged=${merged.length}`
            );
            console.log(
              `localWins=${localWins}  remoteWins=${remoteWins}  ` +
              `localOnly=${localOnly}  remoteOnly=${remoteOnly}`
            );
            console.groupEnd();

            logHydration(
              `Members merged: ${merged.length} total | ` +
              `localWins=${localWins} remoteWins=${remoteWins} ` +
              `localOnly=${localOnly} remoteOnly=${remoteOnly}`
            );

            if (!cancelled) {
              setMembers(merged);
              save(merged);
              setIsLoaded(true);
            }
            return;
          }

          // GitHub returned 0 members.
          // ─── CRITICAL: never let an empty GitHub response wipe local data. ───
          // GitHub returning 0 is normal for new setups, post-reset, or when the
          // remote repo was cleared. The local store is the user's working copy —
          // it must survive a 0-member remote response.

          // Guard A — debug toggle
          if (localStorage.getItem(GITHUB_HYDRATION_DISABLED_KEY)) {
            logHydration(
              `Members: GitHub hydration disabled — keeping ${local.length} local member${local.length !== 1 ? "s" : ""} (remote returned 0)`
            );
            if (!cancelled) setIsLoaded(true);
            return;
          }

          // Guard B — save in progress: re-read localStorage so any write that
          // happened AFTER init() started (and after `local` was captured) is visible.
          if (_isSaving) {
            const localNow = load();
            logHydration(
              `Members: GitHub returned 0 but save is in progress — refreshing to post-save state (${localNow.length} member${localNow.length !== 1 ? "s" : ""})`
            );
            if (!cancelled) {
              setMembers(localNow);
              setIsLoaded(true);
            }
            return;
          }

          // Guard C — re-read localStorage RIGHT NOW instead of using the `local`
          // snapshot captured at init() start. A save (addMember / importMembers)
          // may have written data AFTER init() started but BEFORE this GitHub
          // response arrived, making the captured `local` stale and Guard C fail.
          const localNow = load();
          if (localNow.length > 0) {
            logHydration(
              `Members: GitHub returned 0 — preserving ${localNow.length} local-only member${localNow.length !== 1 ? "s" : ""} ` +
              `(remote is empty, local is authoritative)`
            );
            console.log(
              "[GKShah] HYDRATION 0-member guard fired:",
              localNow.map(m => ({ id: m.id, name: m.fullName, updatedAt: m.updatedAt }))
            );
            if (!cancelled) {
              setMembers(localNow);
              setIsLoaded(true);
            }
            return;
          }

          // Both GitHub and localStorage are empty — genuinely fresh start.
          logHydration("Members: GitHub returned 0 and localStorage is also empty — starting fresh");
          if (!cancelled) {
            setMembers([]);
            setIsLoaded(true);
          }
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

  // Re-sync this instance whenever ANY component calls save().
  // Without this, state changes made in one component (e.g. MemberForm adding a
  // member) are never propagated to other mounted components (Dashboard, Members,
  // FamilyTree, CommandPalette) because each has its own independent useState.
  useEffect(() => {
    const handleChange = (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail?.count ?? '?';
      console.log(
        `%c[GKShah] useFamilyStore: members-changed broadcast — refreshing ${count} members into this instance`,
        'color:#8b5e3c;font-style:italic'
      );
      const fresh = load();
      setMembers(fresh);
      setIsLoaded(true);
    };
    window.addEventListener('gkshah:members-changed', handleChange);
    return () => window.removeEventListener('gkshah:members-changed', handleChange);
  }, []); // setMembers / setIsLoaded are stable React dispatch functions

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
    // console.group opened here so groupEnd in finally always pairs correctly.
    console.group('[GKShah] addMember START');
    console.log('[GKShah] addMember INPUT', {
      fullName: member.fullName, birthday: member.birthday,
      gender: member.gender, bloodGroup: member.bloodGroup, generation: member.generation,
    });
    try {
      const validationError = validateRelationship(
        undefined, member.fatherId, member.motherId, member.spouseId
      );
      if (validationError) {
        console.warn('[GKShah] addMember FAILURE (validation):', validationError);
        return { member: {} as FamilyMember, error: validationError };
      }

      // Mark saving BEFORE the write so any concurrent GitHub fetch response
      // that resolves in the same tick will be blocked by the _isSaving guard.
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
      saveMembers(next);

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

      // TASK 2 — delayed verify: confirm localStorage still has the member 2 s later
      // (catches any hydration overwrite that happens after the save returns)
      setTimeout(() => {
        try {
          const raw2 = localStorage.getItem(STORAGE_KEY);
          const parsed2 = raw2 ? JSON.parse(raw2) : null;
          const list2: Array<{ id: string; fullName?: string; updatedAt?: string }> =
            Array.isArray(parsed2) ? parsed2 : (parsed2?.members ?? []);
          const check = list2.find(m => m.id === id);
          console.log(
            '[GKShah] addMember +2s LOCALSTORAGE VERIFY',
            check ? `✓ still present — ${check.fullName} updatedAt=${check.updatedAt}` : `❌ GONE — was wiped after save!`
          );
        } catch { /* noop */ }
      }, 2000);

      return { member: saved };
    } catch (err) {
      console.error('[GKShah] addMember FAILURE (exception):', err);
      throw err; // re-throw so performSave catch can show a toast
    } finally {
      console.groupEnd(); // always paired with the opening group
    }
  };

  const updateMember = (id: string, updates: Partial<FamilyMember>): { error?: string } => {
    const validationError = validateRelationship(
      id, updates.fatherId, updates.motherId, updates.spouseId
    );
    // console.group opened here so groupEnd in finally always pairs correctly.
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

      // Mark saving BEFORE the write so any concurrent GitHub fetch response
      // that resolves in the same tick will be blocked by the _isSaving guard.
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
      saveMembers(next);

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

      // TASK 2 — delayed verify: confirm localStorage still has the updated member 2 s later
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
      throw err; // re-throw so performSave catch can show a toast
    } finally {
      console.groupEnd(); // always paired with the opening group
    }
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
    console.group('[GKShah] importMembers START');
    console.log('[GKShah] importMembers INPUT count:', importedMembers.length);
    try {
      setSaving(); // block GitHub hydration from overwriting mid-import
      console.log('[GKShah] importMembers: _isSaving set, lock acquired');
      saveMembers(migrateMembers(importedMembers as any[]));
      console.log('[GKShah] importMembers END — saved', importedMembers.length, 'member(s)');
    } catch (err) {
      console.error('[GKShah] importMembers FAILURE (exception):', err);
      throw err;
    } finally {
      console.groupEnd();
    }
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
