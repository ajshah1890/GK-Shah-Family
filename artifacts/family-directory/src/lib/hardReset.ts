/**
 * hardReset.ts
 *
 * True clean-room reset across every persistence layer:
 *   localStorage → sessionStorage → IndexedDB → GitHub JSON → hard reload
 *
 * A POST_RESET_FLAG is written BEFORE the reload so that on the next
 * page load the GitHub-restore path is blocked — preventing ghost members
 * from reappearing even if the GitHub sync call failed during reset.
 */

export const POST_RESET_FLAG = "gkshah_reset_completed";

/** Keys that survive the reset */
const PRESERVE_KEYS = ["gkshah_admin_password", "gkshah_admin_mode"] as const;

/** IndexedDB databases to delete */
const IDB_DATABASES = ["gkshah_photos", "gkshah_moment_photos"];

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function hardResetAllData(): Promise<void> {
  console.group(
    "%c[GK Shah Reset] Starting hard reset of all persistence layers",
    "color:#c0392b;font-weight:bold",
  );

  // ── 1. Save admin credentials so they survive the wipe ────────────────────
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
  console.log(`[Reset] 🗑️  localStorage: removed ${gkKeys.length} key(s) →`, gkKeys);

  // ── 3. Clear sessionStorage ───────────────────────────────────────────────
  const ssCount = sessionStorage.length;
  sessionStorage.clear();
  console.log(`[Reset] 🗑️  sessionStorage: cleared ${ssCount} item(s)`);

  // ── 4. Set post-reset flag FIRST — before restoring credentials ───────────
  //       This blocks GitHub data from being restored on the next load,
  //       even if the GitHub clear API call below fails.
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
              console.log(`[Reset] 🗑️  IndexedDB deleted: ${dbName}`);
              resolve();
            };
            req.onerror = () => {
              console.warn(`[Reset] ⚠️  IndexedDB delete error: ${dbName}`);
              resolve();
            };
            req.onblocked = () => {
              console.warn(`[Reset] ⚠️  IndexedDB delete blocked: ${dbName} (open connections exist — will complete after reload)`);
              resolve();
            };
          } catch {
            console.warn(`[Reset] ⚠️  IndexedDB unavailable: ${dbName}`);
            resolve();
          }
        }),
    ),
  );

  // ── 7. Clear GitHub JSON (best-effort — flag ensures safety if this fails) ─
  const now = new Date().toISOString();
  const adminPw = preserved["gkshah_admin_password"] ?? "gkshah2024";
  const headers = {
    "Content-Type": "application/json",
    "X-Admin-Secret": adminPw,
  };

  try {
    const [rMembers, rMoments, rSettings] = await Promise.allSettled([
      fetch("/api/data/members", {
        method: "POST",
        headers,
        body: JSON.stringify({ version: 2, members: [], _savedAt: now }),
      }),
      fetch("/api/data/moments", {
        method: "POST",
        headers,
        body: JSON.stringify([]),
      }),
      fetch("/api/data/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({ _resetAt: now }),
      }),
    ]);

    const label = (r: PromiseSettledResult<Response>, name: string) => {
      if (r.status === "fulfilled" && r.value.ok)
        return console.log(`[Reset] ☁️  GitHub ${name}.json: cleared ✓`);
      const detail =
        r.status === "rejected" ? String(r.reason) : `HTTP ${r.value.status}`;
      console.warn(
        `[Reset] ⚠️  GitHub ${name}.json: failed (${detail}) — post-reset flag will block restore`,
      );
    };

    label(rMembers, "members");
    label(rMoments, "moments");
    label(rSettings, "settings");
  } catch (err) {
    console.warn(
      "[Reset] ⚠️  GitHub clear threw unexpectedly:",
      err,
      "— post-reset flag will still block restore",
    );
  }

  console.log("[Reset] ✅ All persistence layers cleared. Hard-reloading...");
  console.groupEnd();

  // ── 8. Hard reload — bypass browser cache with a unique URL ───────────────
  //       Using href assignment (not reload()) so the browser re-fetches assets.
  window.location.href = `${window.location.pathname}?reset=${Date.now()}`;
}

// ─── Post-reset guard (call at top of every store init) ──────────────────────

/**
 * Returns true if this load is immediately after a hard reset.
 * Clears the flag so normal loads resume on subsequent navigations.
 *
 * Usage:
 *   if (checkAndClearPostResetFlag()) { setMembers([]); setIsLoaded(true); return; }
 */
export function checkAndClearPostResetFlag(): boolean {
  try {
    const flag = localStorage.getItem(POST_RESET_FLAG);
    if (flag) {
      localStorage.removeItem(POST_RESET_FLAG);
      console.log(
        "[GK Shah] 🚩 Post-reset load detected — GitHub restore skipped for this load",
      );
      return true;
    }
  } catch {
    // localStorage unavailable (private mode, quota)
  }
  return false;
}

// ─── Soft local-only clear (no GitHub, no reload) ────────────────────────────

/**
 * Clears only local storage layers without touching GitHub or reloading.
 * Used by the debug page's "Clear Local Data" button.
 */
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
