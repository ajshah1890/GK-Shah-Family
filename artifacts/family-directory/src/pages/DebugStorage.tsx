import { useState, useEffect, useCallback } from "react";
import { useAdminMode } from "@/hooks/useAdminMode";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database, HardDrive, Cloud, RefreshCw, Trash2,
  AlertTriangle, CheckCircle2, Info,
} from "lucide-react";
import { toast } from "sonner";
import { hardResetAllData, clearLocalDataOnly, POST_RESET_FLAG } from "@/lib/hardReset";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LsEntry { key: string; bytes: number; preview: string; sensitive: boolean }
interface IdbEntry { name: string; status: "exists" | "unknown" }
interface GithubStatus { members: number | null; moments: number | null; fetchedAt: string | null; error: string | null }

const SENSITIVE_KEYS = new Set(["gkshah_admin_password", "gkshah_admin_mode"]);
const KNOWN_IDB = ["gkshah_photos", "gkshah_moment_photos"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readLocalStorage(): LsEntry[] {
  const result: LsEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (!key.startsWith("gkshah_") && key !== POST_RESET_FLAG) continue;
      const raw = localStorage.getItem(key) ?? "";
      const sensitive = SENSITIVE_KEYS.has(key);
      result.push({
        key,
        bytes: new Blob([raw]).size,
        preview: sensitive ? "••••••••" : raw.length > 120 ? raw.slice(0, 120) + "…" : raw,
        sensitive,
      });
    }
  } catch {
    // noop
  }
  return result.sort((a, b) => a.key.localeCompare(b.key));
}

function parseMemberCount(lsEntries: LsEntry[]): number {
  const entry = lsEntries.find(e => e.key === "gkshah_family_members");
  if (!entry) return 0;
  try {
    const raw = localStorage.getItem("gkshah_family_members");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : (parsed?.members?.length ?? 0);
  } catch { return 0; }
}

function parseMomentsCount(lsEntries: LsEntry[]): number {
  const entry = lsEntries.find(e => e.key === "gkshah_moments");
  if (!entry) return 0;
  try {
    const raw = localStorage.getItem("gkshah_moments");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch { return 0; }
}

async function fetchGithubStatus(): Promise<GithubStatus> {
  try {
    const [rm, rmo] = await Promise.allSettled([
      fetch("/api/data/members", { headers: { "Cache-Control": "no-cache" } }),
      fetch("/api/data/moments", { headers: { "Cache-Control": "no-cache" } }),
    ]);

    let membersCount: number | null = null;
    let momentsCount: number | null = null;
    let err: string | null = null;

    if (rm.status === "fulfilled" && rm.value.ok) {
      const j = await rm.value.json() as { data?: { members?: unknown[] } | unknown[] };
      const raw = j.data;
      membersCount = Array.isArray(raw) ? raw.length : ((raw as { members?: unknown[] })?.members?.length ?? 0);
    } else {
      err = rm.status === "rejected" ? "Network error" : `HTTP ${rm.value.status}`;
    }

    if (rmo.status === "fulfilled" && rmo.value.ok) {
      const j = await rmo.value.json() as { data?: unknown[] };
      momentsCount = Array.isArray(j.data) ? j.data.length : 0;
    }

    return { members: membersCount, moments: momentsCount, fetchedAt: new Date().toLocaleTimeString(), error: err };
  } catch (e) {
    return { members: null, moments: null, fetchedAt: null, error: String(e) };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DebugStorage() {
  const { isAdmin } = useAdminMode();
  const [lsEntries, setLsEntries] = useState<LsEntry[]>([]);
  const [idbEntries] = useState<IdbEntry[]>(KNOWN_IDB.map(name => ({ name, status: "unknown" as const })));
  const [github, setGithub] = useState<GithubStatus | null>(null);
  const [isFetchingGitHub, setIsFetchingGitHub] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const refresh = useCallback(() => {
    setLsEntries(readLocalStorage());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fetchGitHub = useCallback(async () => {
    setIsFetchingGitHub(true);
    const status = await fetchGithubStatus();
    setGithub(status);
    setIsFetchingGitHub(false);
  }, []);

  const handleClearLocal = useCallback(() => {
    const { lsKeys, idbDbs } = clearLocalDataOnly();
    toast.success(`Cleared ${lsKeys.length} localStorage key(s) and scheduled ${idbDbs.length} IndexedDB delete(s). Reload to see effect.`);
    refresh();
  }, [refresh]);

  const handleHardReset = useCallback(async () => {
    setIsResetting(true);
    try {
      await hardResetAllData();
    } catch {
      toast.error("Hard reset threw an error — check console");
      setIsResetting(false);
    }
  }, []);

  const memberCount = parseMemberCount(lsEntries);
  const momentsCount = parseMomentsCount(lsEntries);
  const totalLsBytes = lsEntries.reduce((s, e) => s + e.bytes, 0);
  const postResetFlagSet = lsEntries.some(e => e.key === POST_RESET_FLAG);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight flex items-center gap-2">
          <Database className="w-7 h-7 text-primary" />
          Storage Debug
        </h1>
        <p className="text-muted-foreground mt-1">
          Live view of all persistence layers. This page is for diagnostic use only.
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
          <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Admin login required to use reset actions. Read-only view is available below.
          </p>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Members (local)" value={memberCount} icon={<CheckCircle2 className="w-4 h-4" />} ok={memberCount === 0} />
        <SummaryCard label="Moments (local)" value={momentsCount} icon={<CheckCircle2 className="w-4 h-4" />} ok={momentsCount === 0} />
        <SummaryCard label="localStorage keys" value={lsEntries.length} icon={<HardDrive className="w-4 h-4" />} />
        <SummaryCard label="Total size" value={`${(totalLsBytes / 1024).toFixed(1)} KB`} icon={<HardDrive className="w-4 h-4" />} />
      </div>

      {postResetFlagSet && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-blue-800 dark:text-blue-200 font-medium">
            Post-reset flag is active — GitHub data will be ignored on next full reload.
          </p>
        </div>
      )}

      {/* ── localStorage ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-serif flex items-center gap-2">
                <HardDrive className="w-4 h-4" /> localStorage
              </CardTitle>
              <CardDescription>{lsEntries.length} gkshah_* key(s) · {(totalLsBytes / 1024).toFixed(1)} KB total</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={refresh} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lsEntries.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground italic">No gkshah_* keys found — storage is clean.</p>
          ) : (
            <div className="overflow-y-auto max-h-[360px] divide-y divide-border">
              {lsEntries.map(entry => (
                <div key={entry.key} className="px-5 py-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{entry.key}</code>
                    <Badge variant="outline" className="text-[10px]">{(entry.bytes / 1024).toFixed(1)} KB</Badge>
                    {entry.sensitive && <Badge variant="secondary" className="text-[10px]">sensitive</Badge>}
                    {entry.key === POST_RESET_FLAG && <Badge className="text-[10px] bg-blue-500">reset-flag</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono break-all leading-relaxed">{entry.preview}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── IndexedDB ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif flex items-center gap-2">
            <Database className="w-4 h-4" /> IndexedDB Databases
          </CardTitle>
          <CardDescription>
            IDB existence cannot be queried synchronously — status shown after a delete attempt during reset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {idbEntries.map(entry => (
              <div key={entry.name} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                <code className="text-xs font-mono">{entry.name}</code>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  {entry.status}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            To verify deletion: open DevTools → Application → IndexedDB and check for these databases.
          </p>
        </CardContent>
      </Card>

      {/* ── GitHub ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-serif flex items-center gap-2">
                <Cloud className="w-4 h-4" /> GitHub JSON
              </CardTitle>
              <CardDescription>Fetch live counts from the shared repository</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchGitHub} disabled={isFetchingGitHub} className="gap-1.5">
              {isFetchingGitHub ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Fetch
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {github === null ? (
            <p className="text-sm text-muted-foreground">Click Fetch to check GitHub data counts.</p>
          ) : github.error ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Error: {github.error}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">Members (GitHub)</p>
                <p className={`text-2xl font-bold tabular-nums mt-1 ${github.members === 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {github.members ?? "—"}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">Moments (GitHub)</p>
                <p className={`text-2xl font-bold tabular-nums mt-1 ${github.moments === 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {github.moments ?? "—"}
                </p>
              </div>
            </div>
          )}
          {github?.fetchedAt && (
            <p className="text-xs text-muted-foreground mt-2">Fetched at {github.fetchedAt}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      {isAdmin && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Reset Actions
            </CardTitle>
            <CardDescription>
              Use these to diagnose ghost-member issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border">
              <div>
                <p className="text-sm font-semibold">Clear local data only</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Wipes localStorage + schedules IndexedDB deletion. Does NOT clear GitHub. Page reloads.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleClearLocal} className="shrink-0">
                Clear Local
              </Button>
            </div>

            <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
              <div>
                <p className="text-sm font-semibold">Full hard reset</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clears localStorage + IndexedDB + GitHub JSON. Sets post-reset flag. Hard-reloads.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleHardReset}
                disabled={isResetting}
                className="shrink-0 gap-1.5"
              >
                {isResetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isResetting ? "Resetting…" : "Hard Reset"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, ok }: { label: string; value: string | number; icon: React.ReactNode; ok?: boolean }) {
  const color = ok === true ? "text-green-600 dark:text-green-400" : ok === false ? "text-destructive" : "text-foreground";
  return (
    <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
