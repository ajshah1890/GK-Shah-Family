/**
 * hardReset.ts
 *
 * True clean-room reset across every persistence layer:
 *   localStorage → sessionStorage → IndexedDB → GitHub JSON → hard reload
 *
 * The POST_RESET_FLAG is written BEFORE the reload so that on the next page
 * load the GitHub-restore path is blocked in every store — preventing ghost
 * members from reappearing even if the GitHub clear API call failed.
 *
 * IMPORTANT: checkAndClearPostResetFlag() uses a module-level cache so
 * multiple stores calling it in the same page load all see the same result.
 * Without the cache, the first store removes the flag and the second store
 * misses it, causing GitHub data to restore into moments / members.
 */

export const POST_RESET_FLAG  = "gkshah_reset_completed";

/** sessionStorage keys used by the debug page */
export const RESET_LOG_KEY    = "gkshah_debug_last_reset";
export const HYDRATION_LOG_KEY = "gkshah_debug_hydration_log";

const PRESERVE_KEYS  = ["gkshah_admin_password", "gkshah_admin_mode"] as const;
const IDB_DATABASES  = ["gkshah_photos", "gkshah_moment_photos"];

// ─── Post-reset flag — module-level cache ────────────────────────────────────
//
// First call reads localStorage and caches the result; all subsequent calls
// (from other stores in the same page load) return the cached value without
// touching localStorage, so the flag is consumed exactly once.

let _postResetCached: boolean | null = null;

export function checkAndClearPostResetFlag(): boolean {
  if (_postResetCached !== null) return _postResetCached;
  try {
    const flag = localStorage.getItem(POST_RESET_FLAG);
    _postResetCached = !!flag;
    if (flag) {
      localStorage.removeItem(POST_RESET_FLAG);
      const msg = "🚩 Post-reset load detected — GitHub restore blocked for all stores this page load";
      console.log(`%c[GK Shah] ${msg}`, "color:#c0392b;font-weight:bold");
      logHydration(msg);
    }
  } catch {
    _postResetCached = false;
  }
  return _postResetCached;
}

// ─── Hydration activity log ───────────────────────────────────────────────────
//
// Stores call logHydration() during init to record where their data came from.
// Each call is written to sessionStorage so the debug page can display it
// even after navigating away from the boot page.

export interface HydrationEntry { ts: string; message: string }
const _hydrationLog: HydrationEntry[] = [];

export function logHydration(message: string): void {
  const entry: HydrationEntry = { ts: new Date().toLocaleTimeString(), message };
  _hydrationLog.push(entry);
  console.log(`%c[GK Shah] ${message}`, "color:#8b5e3c;font-style:italic");
  try {
    sessionStorage.setItem(HYDRATION_LOG_KEY, JSON.stringify(_hydrationLog));
  } catch {}
}

export function getHydrationLog(): HydrationEntry[] {
  return [..._hydrationLog];
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function hardResetAllData(): Promise<void> {
  console.group(
    "%c[GK Shah Reset] Starting hard reset of all persistence layers",
    "color:#c0392b;font-weight:bold",
  );

  const resetRecord: {
    ts: string;
    lsKeysRemoved: string[];
    ssItemsCleared: number;
    idbDeleted: string[];
    githubCleared: string[];
    githubFailed: string[];
  } = {
    ts: new Date().toISOString(),
    lsKeysRemoved: [],
    ssItemsCleared: 0,
    idbDeleted: [],
    githubCleared: [],
    githubFailed: [],
  };

  // ── 1. Save admin credentials ─────────────────────────────────────────────
  const preserved: Partial<Record<string, string>> = {};
  for (const key of PRESERVE_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) preserved[key] = val;
  }
  console.log("[Reset] 🔐 Preserving keys:", Object.keys(preserved));

  // ── 2. Wipe all gkshah_* localStorage keys ────────────────────────────────
  const lsSnapshot = { ...localStorage };
  const gkKeys = Object.keys(lsSnapshot).filter(k => k.startsWith("gkshah_"));
  gkKeys.forEach(k => localStorage.removeItem(k));
  resetRecord.lsKeysRemoved = gkKeys;
  console.log(`[Reset] 🗑️  localStorage: removed ${gkKeys.length} key(s) →`, gkKeys);

  // ── 3. Clear sessionStorage ───────────────────────────────────────────────
  const ssCount = sessionStorage.length;
  resetRecord.ssItemsCleared = ssCount;
  sessionStorage.clear();
  console.log(`[Reset] 🗑️  sessionStorage: cleared ${ssCount} item(s)`);

  // ── 4. Set post-reset flag BEFORE restoring credentials ───────────────────
  //       Must come after sessionStorage.clear() so it survives the reload.
  localStorage.setItem(POST_RESET_FLAG, "1");
  console.log("[Reset] 🚩 Post-reset flag set — GitHub restore blocked on next load");

  // ── 5. Restore admin credentials ─────────────────────────────────────────
  for (const [key, val] of Object.entries(preserved)) {
    if (val !== undefined) localStorage.setItem(key, val);
  }
  console.log("[Reset] ✅ Admin credentials restored");

  // ── 6. Delete IndexedDB databases ────────────────────────────────────────
  await Promise.allSettled(
    IDB_DATABASES.map(
      dbName =>
        new Promise<void>(resolve => {
          try {
            const req = indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => {
              resetRecord.idbDeleted.push(dbName);
              console.log(`[Reset] 🗑️  IndexedDB deleted: ${dbName}`);
              resolve();
            };
            req.onerror = () => {
              console.warn(`[Reset] ⚠️  IndexedDB delete error: ${dbName}`);
              resolve();
            };
            req.onblocked = () => {
              console.warn(`[Reset] ⚠️  IndexedDB delete blocked: ${dbName} — will complete after reload`);
              resolve();
            };
          } catch {
            console.warn(`[Reset] ⚠️  IndexedDB unavailable: ${dbName}`);
            resolve();
          }
        }),
    ),
  );

  // ── 7. Clear GitHub JSON (best-effort) ────────────────────────────────────
  const now = new Date().toISOString();
  const adminPw = preserved["gkshah_admin_password"] ?? "gkshah2024";
  const headers = {
    "Content-Type": "application/json",
    "X-Admin-Secret": adminPw,
  };

  try {
    const [rMembers, rMoments, rSettings] = await Promise.allSettled([
      fetch("/api/data/members",  { method: "POST", headers, body: JSON.stringify({ version: 2, members: [], _savedAt: now }) }),
      fetch("/api/data/moments",  { method: "POST", headers, body: JSON.stringify([]) }),
      fetch("/api/data/settings", { method: "POST", headers, body: JSON.stringify({ _resetAt: now }) }),
    ]);

    const check = (r: PromiseSettledResult<Response>, name: string) => {
      if (r.status === "fulfilled" && r.value.ok) {
        resetRecord.githubCleared.push(name);
        return console.log(`[Reset] ☁️  GitHub ${name}.json: cleared ✓`);
      }
      resetRecord.githubFailed.push(name);
      const detail = r.status === "rejected" ? String(r.reason) : `HTTP ${r.value.status}`;
      console.warn(`[Reset] ⚠️  GitHub ${name}.json: failed (${detail}) — post-reset flag will block restore`);
    };
    check(rMembers,  "members");
    check(rMoments,  "moments");
    check(rSettings, "settings");
  } catch (err) {
    console.warn("[Reset] ⚠️  GitHub clear threw:", err, "— post-reset flag still blocks restore");
    resetRecord.githubFailed.push("members", "moments", "settings");
  }

  // ── 8. Write reset summary to sessionStorage for debug page ──────────────
  //       Written AFTER sessionStorage.clear() so it survives the page reload.
  try {
    sessionStorage.setItem(RESET_LOG_KEY, JSON.stringify(resetRecord));
  } catch {}

  console.log("[Reset] ✅ All persistence layers cleared. Hard-reloading...");
  console.groupEnd();

  // ── 9. Hard reload — bypass browser cache with a unique URL ───────────────
  window.location.href = `${window.location.pathname}?reset=${Date.now()}`;
}

// ─── Soft local-only clear ────────────────────────────────────────────────────

export function clearLocalDataOnly(): { lsKeys: string[]; idbDbs: string[] } {
  const preserved: Partial<Record<string, string>> = {};
  for (const key of PRESERVE_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) preserved[key] = val;
  }

  const lsKeys = Object.keys(localStorage).filter(k => k.startsWith("gkshah_"));
  lsKeys.forEach(k => localStorage.removeItem(k));
  sessionStorage.clear();
  localStorage.setItem(POST_RESET_FLAG, "1");
  for (const [key, val] of Object.entries(preserved)) {
    if (val !== undefined) localStorage.setItem(key, val);
  }

  const idbDbs: string[] = [];
  for (const dbName of IDB_DATABASES) {
    try {
      indexedDB.deleteDatabase(dbName);
      idbDbs.push(dbName);
    } catch {
      // noop
    }
  }

  return { lsKeys, idbDbs };
}
