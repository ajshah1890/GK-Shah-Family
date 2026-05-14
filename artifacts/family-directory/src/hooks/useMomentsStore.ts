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
            logHydration(`Moments loaded from: GitHub (${remote.length} moment${remote.length !== 1 ? "s" : ""})`);
            setMoments(remote);
            saveMoments(remote);
            setIsLoaded(true);
            return;
          }
          // GitHub returned 0 moments — show empty, do NOT fall back to local
          logHydration("Moments loaded from: GitHub (returned 0 moments — empty)");
          setMoments([]);
          setIsLoaded(true);
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

  const persist = useCallback((updated: Moment[]) => {
    setMoments(updated);
    saveMoments(updated);
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

      persist([moment, ...moments]);
      return moment;
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
