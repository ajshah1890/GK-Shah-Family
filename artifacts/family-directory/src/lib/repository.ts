/**
 * Repository abstraction layer for family data.
 *
 * Decouples storage concerns from UI. Each interface maps cleanly to
 * a future REST API, Supabase, or PostgreSQL backend.
 *
 * Current implementations:
 *  - LocalStorageFamilyRepository   (default; works offline)
 *  - IndexedDBPhotoRepository       (for photo blobs)
 *
 * To migrate to a backend:
 *  1. Implement FamilyRepository against your API endpoint
 *  2. Replace `new LocalStorageFamilyRepository()` with your impl
 *  3. Wrap calls with React Query for caching + optimistic updates
 */

import { FamilyMember } from "@/types/family";

// ─── Core interfaces ──────────────────────────────────────────────────────────

export interface FamilyRepository {
  /** Returns all members, already migrated to current schema. */
  getAll(): Promise<FamilyMember[]>;
  /** Returns a single member by internal UUID, or null. */
  getById(id: string): Promise<FamilyMember | null>;
  /** Persists the full members array (replaces storage). */
  saveAll(members: FamilyMember[]): Promise<void>;
  /** Deletes a single member by internal UUID. */
  delete(id: string): Promise<void>;
}

export interface PhotoRepository {
  /** Returns the stored photo (base64 or URL) for a member, or null. */
  get(memberId: string): Promise<string | null>;
  /** Stores a photo for a member. Accepts a base64 data URL or blob URL. */
  set(memberId: string, data: string): Promise<void>;
  /** Removes a photo by member internal UUID. */
  delete(memberId: string): Promise<void>;
  /** Returns all stored photos as a Map<memberId, base64>. */
  getAll(): Promise<Map<string, string>>;
}

export interface RelationshipRepository {
  /**
   * Returns the cached kinship label between two members, if computed.
   * Key: sorted pair "${idA}|${idB}"
   */
  getCached(idA: string, idB: string): string | null;
  /** Caches a kinship label for a pair. TTL = session only. */
  setCached(idA: string, idB: string, label: string): void;
  /** Clears all cached relationships (e.g. after member edits). */
  clearCache(): void;
}

// ─── LocalStorage implementation ─────────────────────────────────────────────

const LS_KEY = "gkshah_family_members";
const LS_SCHEMA_VERSION = 2;

export class LocalStorageFamilyRepository implements FamilyRepository {
  async getAll(): Promise<FamilyMember[]> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : (parsed.members ?? []);
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<FamilyMember | null> {
    const all = await this.getAll();
    return all.find(m => m.id === id) ?? null;
  }

  async saveAll(members: FamilyMember[]): Promise<void> {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ version: LS_SCHEMA_VERSION, members })
    );
  }

  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    await this.saveAll(all.filter(m => m.id !== id));
  }
}

// ─── In-memory relationship cache ────────────────────────────────────────────

export class InMemoryRelationshipCache implements RelationshipRepository {
  private readonly cache = new Map<string, string>();

  private key(a: string, b: string): string {
    return [a, b].sort().join("|");
  }

  getCached(idA: string, idB: string): string | null {
    return this.cache.get(this.key(idA, idB)) ?? null;
  }

  setCached(idA: string, idB: string, label: string): void {
    this.cache.set(this.key(idA, idB), label);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ─── IndexedDB photo repository ───────────────────────────────────────────────

const IDB_DB_NAME = "gkshah_photos";
const IDB_STORE   = "photos";
const IDB_VERSION = 1;

function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDBPhotoRepository implements PhotoRepository {
  async get(memberId: string): Promise<string | null> {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(memberId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => resolve(null);
    });
  }

  async set(memberId: string, data: string): Promise<void> {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const req = tx.objectStore(IDB_STORE).put(data, memberId);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async delete(memberId: string): Promise<void> {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const req = tx.objectStore(IDB_STORE).delete(memberId);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async getAll(): Promise<Map<string, string>> {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
      const map = new Map<string, string>();
      const tx = db.transaction(IDB_STORE, "readonly");
      const cursor = tx.objectStore(IDB_STORE).openCursor();
      cursor.onsuccess = (e) => {
        const cur = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cur) { resolve(map); return; }
        map.set(String(cur.key), cur.value);
        cur.continue();
      };
      cursor.onerror = () => resolve(map);
    });
  }

  /**
   * Migrates inline base64 photos from member records into IndexedDB.
   * After migration, the member record's `photo` field is cleared so
   * localStorage doesn't store the large base64 blobs.
   *
   * Returns { migrated, skipped }.
   */
  async migrateFromInline(members: FamilyMember[]): Promise<{ migrated: number; skipped: number; cleanedMembers: FamilyMember[] }> {
    let migrated = 0;
    let skipped  = 0;
    const cleanedMembers = [...members];

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (m.photo && m.photo.startsWith("data:")) {
        try {
          await this.set(m.id, m.photo);
          cleanedMembers[i] = { ...m, photo: `idb:${m.id}` };
          migrated++;
        } catch {
          skipped++;
        }
      }
    }

    return { migrated, skipped, cleanedMembers };
  }
}

// ─── Singleton instances ──────────────────────────────────────────────────────

export const familyRepository   = new LocalStorageFamilyRepository();
export const photoRepository    = new IndexedDBPhotoRepository();
export const relationshipCache  = new InMemoryRelationshipCache();
