/**
 * Moments Repository — fully client-side, no backend.
 *
 * Moments metadata → localStorage  (key: gkshah_moments)
 * Photo blobs       → IndexedDB    (DB: gkshah_moment_photos, store: photos)
 */

import { Moment } from "@/types/moments";

// ─── localStorage moments store ──────────────────────────────────────────────

const LS_KEY = "gkshah_moments";

export function loadMoments(): Moment[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMoments(moments: Moment[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(moments));
  } catch (e) {
    console.error("[momentsRepository] Failed to save moments:", e);
  }
}

// ─── IndexedDB photo store ────────────────────────────────────────────────────

const IDB_NAME = "gkshah_moment_photos";
const IDB_STORE = "photos";
const IDB_VERSION = 1;

function openMomentPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveMomentPhoto(key: string, dataUrl: string): Promise<void> {
  const db = await openMomentPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const req = tx.objectStore(IDB_STORE).put(dataUrl, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getMomentPhoto(key: string): Promise<string | null> {
  try {
    const db = await openMomentPhotoDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteMomentPhoto(key: string): Promise<void> {
  try {
    const db = await openMomentPhotoDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* swallow */
  }
}

export async function getAllMomentPhotos(): Promise<Map<string, string>> {
  try {
    const db = await openMomentPhotoDB();
    return new Promise((resolve) => {
      const map = new Map<string, string>();
      const tx = db.transaction(IDB_STORE, "readonly");
      const cursor = tx.objectStore(IDB_STORE).openCursor();
      cursor.onsuccess = (e) => {
        const cur = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cur) { resolve(map); return; }
        map.set(String(cur.key), cur.value as string);
        cur.continue();
      };
      cursor.onerror = () => resolve(map);
    });
  } catch {
    return new Map();
  }
}

export function makeMomentPhotoKey(momentId: string, index: number): string {
  return `${momentId}_photo_${index}`;
}
