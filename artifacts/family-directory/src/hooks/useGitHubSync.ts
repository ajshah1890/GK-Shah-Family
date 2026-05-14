/**
 * useGitHubSync
 *
 * Provides helpers to:
 *  - loadFromGitHub(type)  → fetch JSON from the API proxy (no token exposed)
 *  - syncToGitHub(type, data) → POST JSON through the API proxy (admin secret sent server-side)
 *
 * The frontend never touches the GitHub token or ADMIN_SECRET directly.
 * It sends X-Admin-Secret (the app admin password) to the API proxy which
 * validates it against the real ADMIN_SECRET env var server-side.
 */

import { useState, useCallback } from "react";

export type SyncDataType = "members" | "moments" | "settings";

export type SyncStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "syncing" }
  | { state: "success"; savedAt: string }
  | { state: "error"; message: string };

const API_BASE = "/api/data";

function getAdminPassword(): string {
  try {
    return localStorage.getItem("gkshah_admin_password") ?? "gkshah2024";
  } catch {
    return "gkshah2024";
  }
}

export async function loadFromGitHub<T>(type: SyncDataType): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/${type}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const json = await res.json() as { data: T | null };
    return json.data;
  } catch {
    return null;
  }
}

export async function syncToGitHub<T>(type: SyncDataType, data: T): Promise<{ ok: boolean; savedAt?: string; error?: string }> {
  try {
    const adminPassword = getAdminPassword();
    const res = await fetch(`${API_BASE}/${type}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": adminPassword,
      },
      body: JSON.stringify(data),
    });
    const json = await res.json() as { ok?: boolean; savedAt?: string; error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` };
    return { ok: true, savedAt: json.savedAt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export function useGitHubSync() {
  const [membersStatus, setMembersStatus] = useState<SyncStatus>({ state: "idle" });
  const [momentsStatus, setMomentsStatus] = useState<SyncStatus>({ state: "idle" });

  const setStatus = (type: SyncDataType, s: SyncStatus) => {
    if (type === "members") setMembersStatus(s);
    else if (type === "moments") setMomentsStatus(s);
  };

  const sync = useCallback(async <T>(type: SyncDataType, data: T): Promise<boolean> => {
    setStatus(type, { state: "syncing" });
    const result = await syncToGitHub(type, data);
    if (result.ok) {
      setStatus(type, { state: "success", savedAt: result.savedAt! });
      return true;
    } else {
      setStatus(type, { state: "error", message: result.error ?? "Unknown error" });
      return false;
    }
  }, []);

  return { membersStatus, momentsStatus, sync };
}
