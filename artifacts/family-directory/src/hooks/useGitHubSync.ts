/**
 * useGitHubSync
 *
 * Provides helpers to:
 *  - loadFromGitHub(type)  → fetch JSON from the API proxy (no token exposed)
 *  - syncToGitHub(type, data) → POST JSON through the API proxy (admin secret sent server-side)
 *  - testGitHubConnection()  → verifies token, repo reachability, and write access
 *
 * The frontend sends X-Admin-Secret (VITE_ADMIN_SECRET) to the API proxy which
 * validates it against the real ADMIN_SECRET env var server-side.
 *
 * All response.json() calls are wrapped in safe parsing — never throws on
 * empty body, non-JSON content-type, or malformed payloads.
 */

import { useState, useCallback } from "react";

export type SyncDataType = "members" | "moments" | "settings";

export type SyncStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "syncing" }
  | { state: "success"; savedAt: string }
  | { state: "error"; message: string };

export interface SyncDiagnostic {
  timestamp: string;
  type: SyncDataType;
  direction: "read" | "write";
  httpStatus: number | null;
  ok: boolean;
  latencyMs: number;
  error?: string;
  responsePreview?: string;
  // enriched diagnostics
  endpoint?: string;
  method?: string;
  contentType?: string | null;
  responseBodyPreview?: string;
}

const API_BASE = "/api/data";


/**
 * Safely reads a Response body and parses JSON.
 * Never throws — returns { json: null, error: ..., rawText, contentType } on failure.
 */
async function safeJson(res: Response): Promise<{
  json: Record<string, unknown> | null;
  error: string | null;
  rawText: string;
  contentType: string | null;
}> {
  const contentType = res.headers.get("content-type");
  let text = "";
  try {
    text = await res.text();
  } catch (err) {
    return { json: null, error: `Could not read response body: ${err instanceof Error ? err.message : String(err)}`, rawText: "", contentType };
  }

  if (!text.trim()) {
    return { json: {}, error: null, rawText: text, contentType };
  }

  const ct = contentType ?? "";
  if (!ct.includes("application/json") && !ct.includes("text/json")) {
    return {
      json: null,
      error: `Expected JSON but received ${ct || "unknown content-type"}: ${text.slice(0, 120)}`,
      rawText: text,
      contentType,
    };
  }

  try {
    return { json: JSON.parse(text) as Record<string, unknown>, error: null, rawText: text, contentType };
  } catch (err) {
    return {
      json: null,
      error: `JSON parse failed: ${err instanceof Error ? err.message : String(err)} — body preview: ${text.slice(0, 120)}`,
      rawText: text,
      contentType,
    };
  }
}

const diagnosticLog: SyncDiagnostic[] = [];

export function getLastDiagnostic(type: SyncDataType, direction: "read" | "write"): SyncDiagnostic | undefined {
  return [...diagnosticLog].reverse().find((d) => d.type === type && d.direction === direction);
}

export function getAllDiagnostics(): SyncDiagnostic[] {
  return [...diagnosticLog].reverse().slice(0, 20);
}

function recordDiagnostic(d: SyncDiagnostic) {
  diagnosticLog.push(d);
  if (diagnosticLog.length > 40) diagnosticLog.splice(0, diagnosticLog.length - 40);
}

export async function loadFromGitHub<T>(type: SyncDataType): Promise<T | null> {
  const endpoint = `${API_BASE}/${type}`;
  const method = "GET";
  const t0 = Date.now();
  try {
    const res = await fetch(endpoint, {
      headers: { "Cache-Control": "no-cache" },
    });
    const latencyMs = Date.now() - t0;
    const { json, error, rawText, contentType } = await safeJson(res);

    if (error || !res.ok || !json) {
      recordDiagnostic({
        timestamp: new Date().toISOString(),
        type,
        direction: "read",
        httpStatus: res.status,
        ok: false,
        latencyMs,
        error: error ?? `HTTP ${res.status}`,
        responsePreview: error ?? undefined,
        endpoint,
        method,
        contentType,
        responseBodyPreview: rawText.slice(0, 200),
      });
      return null;
    }

    recordDiagnostic({
      timestamp: new Date().toISOString(),
      type,
      direction: "read",
      httpStatus: res.status,
      ok: true,
      latencyMs,
      endpoint,
      method,
      contentType,
    });

    return (json["data"] as T) ?? null;
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const msg = err instanceof Error ? err.message : "Network error";
    recordDiagnostic({
      timestamp: new Date().toISOString(),
      type,
      direction: "read",
      httpStatus: null,
      ok: false,
      latencyMs,
      error: msg,
      endpoint,
      method,
      contentType: null,
    });
    return null;
  }
}

export async function syncToGitHub<T>(
  type: SyncDataType,
  data: T
): Promise<{ ok: boolean; savedAt?: string; error?: string }> {
  const endpoint = `${API_BASE}/${type}`;
  const method = "POST";
  const t0 = Date.now();
  try {
    console.log("Sending admin secret:", import.meta.env.VITE_ADMIN_SECRET);
    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": import.meta.env.VITE_ADMIN_SECRET,
      },
      body: JSON.stringify(data),
    });
    const latencyMs = Date.now() - t0;
    const { json, error, rawText, contentType } = await safeJson(res);

    if (error) {
      recordDiagnostic({
        timestamp: new Date().toISOString(),
        type,
        direction: "write",
        httpStatus: res.status,
        ok: false,
        latencyMs,
        error,
        responsePreview: error,
        endpoint,
        method,
        contentType,
        responseBodyPreview: rawText.slice(0, 200),
      });
      return { ok: false, error };
    }

    if (!res.ok) {
      const msg = (json?.["error"] as string) ?? `HTTP ${res.status}`;
      recordDiagnostic({
        timestamp: new Date().toISOString(),
        type,
        direction: "write",
        httpStatus: res.status,
        ok: false,
        latencyMs,
        error: msg,
        endpoint,
        method,
        contentType,
        responseBodyPreview: rawText.slice(0, 200),
      });
      return { ok: false, error: msg };
    }

    const savedAt = (json?.["savedAt"] as string) ?? new Date().toISOString();
    recordDiagnostic({
      timestamp: new Date().toISOString(),
      type,
      direction: "write",
      httpStatus: res.status,
      ok: true,
      latencyMs,
      endpoint,
      method,
      contentType,
    });
    return { ok: true, savedAt };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const msg = err instanceof Error ? err.message : "Network error";
    recordDiagnostic({
      timestamp: new Date().toISOString(),
      type,
      direction: "write",
      httpStatus: null,
      ok: false,
      latencyMs,
      error: msg,
      endpoint,
      method,
      contentType: null,
    });
    return { ok: false, error: msg };
  }
}

export interface ConnectionTestResult {
  ok: boolean;
  tokenPresent: boolean;
  repoReachable: boolean;
  writeAccess: boolean;
  latencyMs: number;
  httpStatus: number | null;
  error?: string;
}

export async function testGitHubConnection(): Promise<ConnectionTestResult> {
  const t0 = Date.now();
  let httpStatus: number | null = null;

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: { "Cache-Control": "no-cache" },
    });
    httpStatus = res.status;
    const latencyMs = Date.now() - t0;
    const { json, error } = await safeJson(res);

    if (error) {
      return { ok: false, tokenPresent: false, repoReachable: false, writeAccess: false, latencyMs, httpStatus, error };
    }

    if (!res.ok) {
      const msg = (json?.["error"] as string) ?? `HTTP ${res.status}`;
      return { ok: false, tokenPresent: false, repoReachable: res.status !== 502, writeAccess: false, latencyMs, httpStatus, error: msg };
    }

    console.log("Sending admin secret:", import.meta.env.VITE_ADMIN_SECRET);
    const writeRes = await fetch(`${API_BASE}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": import.meta.env.VITE_ADMIN_SECRET,
      },
      body: JSON.stringify({ _connectionTest: true, _savedAt: new Date().toISOString() }),
    });
    const writeLatency = Date.now() - t0;
    const { json: writeJson, error: writeError } = await safeJson(writeRes);
    const writeOk = !writeError && writeRes.ok && !!writeJson?.["ok"];

    return {
      ok: true,
      tokenPresent: true,
      repoReachable: true,
      writeAccess: writeOk,
      latencyMs: writeLatency,
      httpStatus: writeRes.status,
      error: writeError ?? (!writeOk ? (writeJson?.["error"] as string | undefined) : undefined),
    };
  } catch (err) {
    return {
      ok: false,
      tokenPresent: false,
      repoReachable: false,
      writeAccess: false,
      latencyMs: Date.now() - t0,
      httpStatus,
      error: err instanceof Error ? err.message : "Network error",
    };
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
