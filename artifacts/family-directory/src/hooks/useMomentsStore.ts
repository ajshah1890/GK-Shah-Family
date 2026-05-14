import { useState, useEffect, useCallback } from "react";
import { Moment, EventType } from "@/types/moments";
import {
  loadMoments,
  saveMoments,
  saveMomentPhoto,
  deleteMomentPhoto,
  makeMomentPhotoKey,
} from "@/lib/momentsRepository";
import { loadFromGitHub } from "./useGitHubSync";
import { checkAndClearPostResetFlag, logHydration } from "@/lib/hardReset";

// ─── Persistence guards ───────────────────────────────────────────────────────

/** Same key as useFamilyStore — both stores honour the same debug toggle. */
const GITHUB_HYDRATION_DISABLED_KEY = 'gkshah_disable_github_hydration';

let _isMomentSaving = false;
let _isMomentSavingTimer: ReturnType<typeof setTimeout> | null = null;

function setSavingMoment(): void {
  _isMomentSaving = true;
  if (_isMomentSavingTimer) clearTimeout(_isMomentSavingTimer);
  // 3 s max — same as members store
  _isMomentSavingTimer = setTimeout(() => {
    _isMomentSaving = false;
    console.log('[GKShah] setSavingMoment: _isMomentSaving auto-cleared after 3 s timeout');
  }, 3000);
}

// ─── Smart merge ──────────────────────────────────────────────────────────────

function smartMergeMoments(local: Moment[], remote: Moment[]): {
  merged: Moment[];
  localWins: number; remoteWins: number; localOnly: number; remoteOnly: number;
} {
  const localById  = new Map(local.map(m => [m.id, m]));
  const remoteById = new Map(remote.map(m => [m.id, m]));
  const allIds     = new Set([...localById.keys(), ...remoteById.keys()]);
  const merged: Moment[] = [];
  let localWins = 0, remoteWins = 0, localOnly = 0, remoteOnly = 0;

  for (const id of allIds) {
    const loc = localById.get(id);
    const rem = remoteById.get(id);
    if (!rem) { merged.push(loc!); localOnly++;  continue; }
    if (!loc) { merged.push(rem);  remoteOnly++; continue; }
    const localMs  = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
    const remoteMs = rem.updatedAt ? new Date(rem.updatedAt).getTime() : 0;
    if (localMs >= remoteMs) { merged.push(loc); localWins++;  }
    else                     { merged.push(rem); remoteWins++; }
  }
  return { merged, localWins, remoteWins, localOnly, remoteOnly };
}

function generateId(): string {
  return `moment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface CreateMomentInput {
  caption: string;
  photoDataUrls: string[];
  taggedMemberIds: string[];
  eventDate: string;
  location?: string;
  branch?: string;
  eventType: EventType;
  favorite?: boolean;
}

export interface UpdateMomentInput extends Partial<CreateMomentInput> {
  favorite?: boolean;
  archived?: boolean;
}

export function useMomentsStore() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Post-reset guard — module-level cache ensures this returns true for
      // ALL stores in the same page load (flag is consumed once, then cached).
      if (checkAndClearPostResetFlag()) {
        logHydration("Moments loaded from: RESET — showing 0 moments (GitHub restore blocked)");
        if (!cancelled) { setMoments([]); setIsLoaded(true); }
        return;
      }

      const local = loadMoments();
      if (local.length > 0 && !cancelled) {
        logHydration(`Moments loaded from: localStorage (${local.length} moment${local.length !== 1 ? "s" : ""} — showing while GitHub loads)`);
        setMoments(local);
        setIsLoaded(true);
      }

      try {
        const remote = await loadFromGitHub<Moment[]>("moments");
        if (cancelled) return;

        if (remote !== null) {
          if (Array.isArray(remote) && remote.length > 0) {
            // Guard 1 — block if createMoment / updateMoment is in progress.
            // Use fresh loadMoments() to capture any write that happened after init() started.
            if (_isMomentSaving) {
              const localNow = loadMoments();
              logHydration(
                `Moments: GitHub response arrived during active save — refreshing to post-save state ` +
                `(${remote.length} remote ignored, ${localNow.length} local preserved)`
              );
              if (!cancelled) {
                setMoments(localNow);
                setIsLoaded(true);
              }
              return;
            }

            // Guard 2 — debug toggle set in Settings › Persistence Controls
            if (localStorage.getItem(GITHUB_HYDRATION_DISABLED_KEY)) {
              logHydration(
                `Moments: GitHub hydration disabled by debug toggle — keeping ${local.length} local moments`
              );
              if (!cancelled) setIsLoaded(true);
              return;
            }

            // Smart merge: per-moment updatedAt comparison replaces blind overwrite
            const { merged, localWins, remoteWins, localOnly, remoteOnly } =
              smartMergeMoments(local, remote as Moment[]);

            console.group("[GKShah Save Trace] HYDRATION PAYLOAD (moments)");
            console.log(`Remote=${remote.length}  Local=${local.length}  Merged=${merged.length}`);
            console.log(`localWins=${localWins}  remoteWins=${remoteWins}  localOnly=${localOnly}  remoteOnly=${remoteOnly}`);
            console.groupEnd();

            logHydration(
              `Moments merged: ${merged.length} total | ` +
              `localWins=${localWins} remoteWins=${remoteWins} ` +
              `localOnly=${localOnly} remoteOnly=${remoteOnly}`
            );

            if (!cancelled) {
              setMoments(merged);
              saveMoments(merged);
              setIsLoaded(true);
            }
            return;
          }

          // GitHub returned 0 moments.
          // ─── CRITICAL: never let an empty GitHub response wipe local data. ───

          // Guard A — debug toggle
          if (localStorage.getItem(GITHUB_HYDRATION_DISABLED_KEY)) {
            logHydration(
              `Moments: GitHub hydration disabled — keeping ${local.length} local moment${local.length !== 1 ? "s" : ""} (remote returned 0)`
            );
            if (!cancelled) setIsLoaded(true);
            return;
          }

          // Guard B — save in progress: use fresh read (same timing fix as members).
          if (_isMomentSaving) {
            const localNow = loadMoments();
            logHydration(
              `Moments: GitHub returned 0 but save is in progress — refreshing to post-save state (${localNow.length} moment${localNow.length !== 1 ? "s" : ""})`
            );
            if (!cancelled) {
              setMoments(localNow);
              setIsLoaded(true);
            }
            return;
          }

          // Guard C — re-read localStorage NOW (captured `local` may be stale
          // if a moment was created after init() started but before GitHub resolved).
          const localNow = loadMoments();
          if (localNow.length > 0) {
            logHydration(
              `Moments: GitHub returned 0 — preserving ${localNow.length} local-only moment${localNow.length !== 1 ? "s" : ""} ` +
              `(remote is empty, local is authoritative)`
            );
            if (!cancelled) {
              setMoments(localNow);
              setIsLoaded(true);
            }
            return;
          }

          // Both GitHub and localStorage are empty — genuinely fresh start.
          logHydration("Moments: GitHub returned 0 and localStorage is also empty — starting fresh");
          if (!cancelled) {
            setMoments([]);
            setIsLoaded(true);
          }
          return;
        }

        // null = GitHub unreachable
        logHydration(`Moments loaded from: localStorage (${local.length} moment${local.length !== 1 ? "s" : ""} — GitHub unreachable)`);
      } catch {
        logHydration(`Moments loaded from: localStorage (${local.length} moment${local.length !== 1 ? "s" : ""} — GitHub threw)`);
      }

      if (!cancelled) {
        if (local.length === 0) {
          logHydration("Moments loaded from: empty (no localStorage data, GitHub unreachable)");
        }
        setIsLoaded(true);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Re-sync whenever any component writes moments.
  useEffect(() => {
    const handleChange = (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail?.count ?? '?';
      console.log(
        `%c[GKShah] useMomentsStore: moments-changed broadcast — refreshing ${count} moments into this instance`,
        'color:#8b5e3c;font-style:italic'
      );
      const fresh = loadMoments();
      setMoments(fresh);
      setIsLoaded(true);
    };
    window.addEventListener('gkshah:moments-changed', handleChange);
    return () => window.removeEventListener('gkshah:moments-changed', handleChange);
  }, []);

  const persist = useCallback((updated: Moment[]) => {
    setMoments(updated);
    saveMoments(updated);
    // Broadcast to every mounted useMomentsStore instance (same pattern as members).
    window.dispatchEvent(new CustomEvent('gkshah:moments-changed', { detail: { count: updated.length } }));
  }, []);

  const createMoment = useCallback(
    async (input: CreateMomentInput): Promise<Moment> => {
      const id = generateId();
      const now = new Date().toISOString();

      const photoKeys: string[] = [];
      for (let i = 0; i < input.photoDataUrls.length; i++) {
        const key = makeMomentPhotoKey(id, i);
        await saveMomentPhoto(key, input.photoDataUrls[i]);
        photoKeys.push(key);
      }

      const moment: Moment = {
        id,
        caption: input.caption,
        photoKeys,
        taggedMemberIds: input.taggedMemberIds,
        eventDate: input.eventDate,
        location: input.location,
        branch: input.branch,
        eventType: input.eventType,
        favorite: input.favorite ?? false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };

      console.group('[GKShah] createMoment START');
      try {
        // Mark saving BEFORE the write so any concurrent GitHub fetch response
        // that resolves in the same tick will be blocked by the _isMomentSaving guard.
        setSavingMoment();
        console.log('[GKShah] createMoment: _isMomentSaving set, lock acquired');
        persist([moment, ...moments]);
        console.log('[GKShah] createMoment END —', moment.id, moment.caption);
        return moment;
      } catch (err) {
        console.error('[GKShah] createMoment FAILURE (exception):', err);
        throw err;
      } finally {
        console.groupEnd();
      }
    },
    [moments, persist]
  );

  const updateMoment = useCallback(
    async (id: string, input: UpdateMomentInput & { newPhotoDataUrls?: string[]; removedPhotoKeys?: string[] }): Promise<void> => {
      const existing = moments.find((m) => m.id === id);
      if (!existing) return;

      let photoKeys = [...existing.photoKeys];

      if (input.removedPhotoKeys?.length) {
        for (const key of input.removedPhotoKeys) {
          await deleteMomentPhoto(key);
          photoKeys = photoKeys.filter((k) => k !== key);
        }
      }

      if (input.newPhotoDataUrls?.length) {
        const startIdx = existing.photoKeys.length;
        for (let i = 0; i < input.newPhotoDataUrls.length; i++) {
          const key = makeMomentPhotoKey(id, startIdx + i);
          await saveMomentPhoto(key, input.newPhotoDataUrls[i]);
          photoKeys.push(key);
        }
      }

      const updated: Moment = {
        ...existing,
        caption: input.caption ?? existing.caption,
        photoKeys,
        taggedMemberIds: input.taggedMemberIds ?? existing.taggedMemberIds,
        eventDate: input.eventDate ?? existing.eventDate,
        location: input.location !== undefined ? input.location : existing.location,
        branch: input.branch !== undefined ? input.branch : existing.branch,
        eventType: input.eventType ?? existing.eventType,
        favorite: input.favorite !== undefined ? input.favorite : existing.favorite,
        archived: input.archived !== undefined ? input.archived : existing.archived,
        updatedAt: new Date().toISOString(),
      };

      persist(moments.map((m) => (m.id === id ? updated : m)));
    },
    [moments, persist]
  );

  const deleteMoment = useCallback(
    async (id: string): Promise<void> => {
      const existing = moments.find((m) => m.id === id);
      if (existing) {
        for (const key of existing.photoKeys) {
          await deleteMomentPhoto(key);
        }
      }
      persist(moments.filter((m) => m.id !== id));
    },
    [moments, persist]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      persist(
        moments.map((m) =>
          m.id === id ? { ...m, favorite: !m.favorite, updatedAt: new Date().toISOString() } : m
        )
      );
    },
    [moments, persist]
  );

  const getMoment = useCallback(
    (id: string): Moment | undefined => moments.find((m) => m.id === id),
    [moments]
  );

  const activeMoments = moments.filter((m) => !m.archived);

  return {
    moments,
    activeMoments,
    isLoaded,
    createMoment,
    updateMoment,
    deleteMoment,
    toggleFavorite,
    getMoment,
  };
}
