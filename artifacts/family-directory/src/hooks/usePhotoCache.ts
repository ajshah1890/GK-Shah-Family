/**
 * usePhotoCache
 *
 * Provides a Map<memberId, photoUrl> for synchronous reads in render functions.
 *
 * - Phase 1: reads inline base64 photos from member.photo (existing behaviour)
 * - Phase 2: if photo = "idb:<memberId>", fetches from IndexedDB asynchronously
 *   and stores in the cache map, triggering a re-render once resolved.
 *
 * Components should call:
 *   const photo = usePhotoUrl(member);
 * which returns the best available photo URL (inline, idb, or dicebear fallback).
 */

import { useEffect, useState, useCallback } from "react";
import { FamilyMember } from "@/types/family";
import { photoRepository } from "@/lib/repository";

const IDB_PREFIX = "idb:";

// Module-level cache to survive across hook instances
const _cache = new Map<string, string>();

export function usePhotoCache(members: FamilyMember[]) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    let needsUpdate = false;

    const promises = members
      .filter(m => m.photo?.startsWith(IDB_PREFIX) && !_cache.has(m.id))
      .map(async m => {
        const id = m.photo!.slice(IDB_PREFIX.length);
        const data = await photoRepository.get(id);
        if (data) {
          _cache.set(m.id, data);
          needsUpdate = true;
        }
      });

    if (promises.length > 0) {
      Promise.all(promises).then(() => {
        if (needsUpdate) forceUpdate(n => n + 1);
      });
    }
  }, [members]);

  const getPhoto = useCallback((member: FamilyMember): string | undefined => {
    if (!member.photo) return undefined;
    if (member.photo.startsWith(IDB_PREFIX)) {
      return _cache.get(member.id);
    }
    return member.photo;
  }, []);

  return { getPhoto };
}

/**
 * Convenience hook: returns the best photo URL for a single member,
 * falling back to a dicebear avatar if no photo is stored.
 */
export function usePhotoUrl(member: FamilyMember): string {
  const [url, setUrl] = useState<string>(() => {
    if (!member.photo) return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.fullName)}`;
    if (member.photo.startsWith(IDB_PREFIX)) {
      return _cache.get(member.id) ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.fullName)}`;
    }
    return member.photo;
  });

  useEffect(() => {
    if (member.photo?.startsWith(IDB_PREFIX)) {
      const id = member.photo.slice(IDB_PREFIX.length);
      if (_cache.has(member.id)) {
        setUrl(_cache.get(member.id)!);
        return;
      }
      photoRepository.get(id).then(data => {
        if (data) {
          _cache.set(member.id, data);
          setUrl(data);
        }
      });
    } else if (member.photo) {
      setUrl(member.photo);
    }
  }, [member.id, member.photo, member.fullName]);

  return url;
}
