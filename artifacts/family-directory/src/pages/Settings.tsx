import { useFamilyStore, GITHUB_HYDRATION_DISABLED_KEY } from "@/hooks/useFamilyStore";
import { useTheme } from "@/hooks/useTheme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Download, Upload, Info, FileSpreadsheet, Shield,
  Camera, Database, AlertTriangle, CheckCircle2,
  Clock, Archive, History, Trash2, ChevronDown, ChevronUp,
  CloudUpload, RefreshCw, Wifi, WifiOff, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, useMemo, useCallback } from "react";
import { useAdminMode } from "@/hooks/useAdminMode";
import { Link } from "wouter";
import { readAuditLog, clearAuditLog, AuditEntry, AuditAction } from "@/lib/auditLog";
import { photoRepository } from "@/lib/repository";
import { loadMoments } from "@/lib/momentsRepository";
import { FamilyMember } from "@/types/family";
import { syncToGitHub, testGitHubConnection, getAllDiagnostics, type ConnectionTestResult, type SyncDiagnostic } from "@/hooks/useGitHubSync";
import { hardResetAllData } from "@/lib/hardReset";
import { useMomentsStore } from "@/hooks/useMomentsStore";

interface RestorePreview {
  members: FamilyMember[];
  auditLog: AuditEntry[];
  version: number;
  exportedAt?: string;
}

type SyncState = "idle" | "syncing" | "success" | "error";

export default function Settings() {
  const { members, importMembers } = useFamilyStore();
  const { moments } = useMomentsStore();
  const { theme } = useTheme();
  const { changePassword, isAdmin } = useAdminMode();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<"idle" | "running" | "done">("idle");
  const [migrationResult, setMigrationResult] = useState<{ migrated: number; skipped: number } | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[] | null>(null);
  const [auditExpanded, setAuditExpanded] = useState<Record<string, boolean>>({});

  const [membersSyncState, setMembersSyncState] = useState<SyncState>("idle");
  const [momentsSyncState, setMomentsSyncState] = useState<SyncState>("idle");
  const [membersSavedAt, setMembersSavedAt] = useState<string | null>(null);
  const [momentsSavedAt, setMomentsSavedAt] = useState<string | null>(null);
  const [membersSyncError, setMembersSyncError] = useState<string | null>(null);
  const [momentsSyncError, setMomentsSyncError] = useState<string | null>(null);

  const [connTestState, setConnTestState] = useState<"idle" | "testing" | "done">("idle");
  const [connTestResult, setConnTestResult] = useState<ConnectionTestResult | null>(null);
  const [syncDiagnostics, setSyncDiagnostics] = useState<SyncDiagnostic[]>([]);
  const [githubHydrationDisabled, setGithubHydrationDisabled] = useState(
    () => !!localStorage.getItem(GITHUB_HYDRATION_DISABLED_KEY)
  );
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleTestConnection = useCallback(async () => {
    setConnTestState("testing");
    const result = await testGitHubConnection();
    setConnTestResult(result);
    setConnTestState("done");
  }, []);

  const handleShowDiagnostics = useCallback(() => {
    setSyncDiagnostics(getAllDiagnostics());
    setShowDiagnostics(true);
  }, []);

  const handleSyncMembers = useCallback(async () => {
    if (!isAdmin) return;
    setMembersSyncState("syncing");
    setMembersSyncError(null);
    const payload = { version: 2, members };
    const result = await syncToGitHub("members", payload);
    if (result.ok) {
      setMembersSyncState("success");
      setMembersSavedAt(result.savedAt ?? new Date().toISOString());
      toast.success(`Members synced to GitHub — ${members.length} records`);
    } else {
      setMembersSyncState("error");
      setMembersSyncError(result.error ?? "Unknown error");
      toast.error(`Sync failed: ${result.error}`);
    }
  }, [isAdmin, members]);

  const handleSyncMoments = useCallback(async () => {
    if (!isAdmin) return;
    setMomentsSyncState("syncing");
    setMomentsSyncError(null);
    const result = await syncToGitHub("moments", moments);
    if (result.ok) {
      setMomentsSyncState("success");
      setMomentsSavedAt(result.savedAt ?? new Date().toISOString());
      toast.success(`Moments synced to GitHub — ${moments.length} records`);
    } else {
      setMomentsSyncState("error");
      setMomentsSyncError(result.error ?? "Unknown error");
      toast.error(`Sync failed: ${result.error}`);
    }
  }, [isAdmin, moments]);

  const handleSyncAll = useCallback(async () => {
    await handleSyncMembers();
    await handleSyncMoments();
  }, [handleSyncMembers, handleSyncMoments]);

  // ── Reset database ────────────────────────────────────────────────────────

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = useCallback(async () => {
    if (resetConfirmText !== "RESET" || !isAdmin) return;
    setIsResetting(true);
    try {
      // Delegates to the centralized hard-reset module which:
      //   1. Saves admin credentials
      //   2. Wipes all gkshah_* localStorage + sessionStorage
      //   3. Sets post-reset flag (blocks GitHub restore on next load)
      //   4. Deletes IndexedDB databases (photos + moment photos)
      //   5. Clears GitHub JSON (members / moments / settings)
      //   6. Hard-reloads — we never reach the line below
      await hardResetAllData();
    } catch {
      toast.error("Reset failed. Please try again.");
      setIsResetting(false);
    }
  }, [resetConfirmText, isAdmin]);

  const inlinePhotoCount = useMemo(
    () => members.filter(m => m.photo?.startsWith("data:")).length,
    [members]
  );

  const inlinePhotoBytesKB = useMemo(
    () => Math.round(
      members.reduce((sum, m) => sum + (m.photo?.startsWith("data:") ? m.photo.length : 0), 0) / 1024
    ),
    [members]
  );

  const toggleTheme = () => {
    if (theme === "dark") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  };

  // ── Full backup export ────────────────────────────────────────────────────

  const handleFullExport = () => {
    const now = new Date().toISOString();
    const moments = loadMoments();
    const backup = {
      version: 2,
      exportedAt: now,
      memberCount: members.length,
      members,
      auditLog: readAuditLog(),
      moments,
      meta: {
        appName: "G K Shah Family Chronicle",
        appVersion: "2.2",
      },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gkshah-backup-${now.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    localStorage.setItem("gkshah_last_backup_at", now);
    toast.success(`Full backup exported — ${members.length} members, ${moments.length} moments`);
  };

  // ── Restore preview ───────────────────────────────────────────────────────

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        let parsedMembers: FamilyMember[] = [];
        let parsedAuditLog: AuditEntry[] = [];
        let version = 1;
        let exportedAt: string | undefined;

        if (Array.isArray(parsed)) {
          parsedMembers = parsed;
        } else if (parsed.members && Array.isArray(parsed.members)) {
          parsedMembers = parsed.members;
          parsedAuditLog = Array.isArray(parsed.auditLog) ? parsed.auditLog : [];
          version = parsed.version ?? 2;
          exportedAt = parsed.exportedAt;
        } else {
          toast.error("Invalid backup format. Expected members array or full backup.");
          return;
        }

        setRestorePreview({ members: parsedMembers, auditLog: parsedAuditLog, version, exportedAt });
      } catch {
        toast.error("Failed to parse file. Ensure it's a valid JSON backup.");
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const applyRestore = () => {
    if (!restorePreview) return;
    importMembers(restorePreview.members);
    toast.success(`Restored ${restorePreview.members.length} members successfully`);
    setRestorePreview(null);
  };

  // ── Photo migration ───────────────────────────────────────────────────────

  const handlePhotoMigration = async () => {
    if (inlinePhotoCount === 0) {
      toast.info("No inline photos to migrate — all photos are already in IndexedDB.");
      return;
    }
    setMigrationStatus("running");
    try {
      const result = await photoRepository.migrateFromInline(members);
      if (result.migrated > 0) {
        importMembers(result.cleanedMembers);
      }
      setMigrationResult({ migrated: result.migrated, skipped: result.skipped });
      setMigrationStatus("done");
      toast.success(`Migration complete: ${result.migrated} photo${result.migrated !== 1 ? "s" : ""} moved to IndexedDB`);
    } catch {
      toast.error("Photo migration failed. Please try again.");
      setMigrationStatus("idle");
    }
  };

  const loadAuditLog = () => setAuditEntries(readAuditLog());

  const handleClearAuditLog = () => {
    clearAuditLog();
    setAuditEntries([]);
    toast.success("Activity log cleared");
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    changePassword(newPassword);
    toast.success("Admin password changed successfully");
    setNewPassword("");
    setConfirmPassword("");
  };

  // ── Restore preview stats ─────────────────────────────────────────────────

  const restoreStats = useMemo(() => {
    if (!restorePreview) return null;
    const currentIds = new Set(members.map(m => m.id));
    const newMembers = restorePreview.members.filter(m => !currentIds.has(m.id));
    const updatedMembers = restorePreview.members.filter(m => currentIds.has(m.id));
    return { newCount: newMembers.length, updatedCount: updatedMembers.length };
  }, [restorePreview, members]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage app preferences and data.</p>
      </div>

      {/* GitHub Sync (admin only) */}
      {isAdmin && (
        <Card className="border-amber-200 dark:border-amber-800/40">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <CloudUpload className="w-5 h-5 text-amber-600" />
              GitHub Sync
            </CardTitle>
            <CardDescription>
              Push the latest data to the shared GitHub repository so everyone sees updates on their next visit.
              Photos stay on-device (IndexedDB) and are not synced.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Members row */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 min-w-0">
                {membersSyncState === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : membersSyncState === "error" ? (
                  <WifiOff className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <Wifi className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">Members</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {membersSyncState === "success" && membersSavedAt
                      ? `Last synced ${new Date(membersSavedAt).toLocaleTimeString()}`
                      : membersSyncState === "error"
                      ? membersSyncError ?? "Sync failed"
                      : `${members.length} members in local store`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncMembers}
                disabled={membersSyncState === "syncing"}
                className="shrink-0 gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${membersSyncState === "syncing" ? "animate-spin" : ""}`} />
                {membersSyncState === "syncing" ? "Syncing…" : "Sync"}
              </Button>
            </div>

            {/* Moments row */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 min-w-0">
                {momentsSyncState === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : momentsSyncState === "error" ? (
                  <WifiOff className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <Wifi className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">Moments</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {momentsSyncState === "success" && momentsSavedAt
                      ? `Last synced ${new Date(momentsSavedAt).toLocaleTimeString()}`
                      : momentsSyncState === "error"
                      ? momentsSyncError ?? "Sync failed"
                      : `${moments.length} moments in local store`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncMoments}
                disabled={momentsSyncState === "syncing"}
                className="shrink-0 gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${momentsSyncState === "syncing" ? "animate-spin" : ""}`} />
                {momentsSyncState === "syncing" ? "Syncing…" : "Sync"}
              </Button>
            </div>

            {/* Sync All */}
            <Button
              onClick={handleSyncAll}
              disabled={membersSyncState === "syncing" || momentsSyncState === "syncing"}
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <CloudUpload className="w-4 h-4" />
              {membersSyncState === "syncing" || momentsSyncState === "syncing"
                ? "Syncing…"
                : "Sync All Changes to GitHub"}
            </Button>

            {/* Test Connection */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">GitHub Connection</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={connTestState === "testing"}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <Wifi className={`w-3.5 h-3.5 ${connTestState === "testing" ? "animate-pulse" : ""}`} />
                    {connTestState === "testing" ? "Testing…" : "Test Connection"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleShowDiagnostics}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <History className="w-3.5 h-3.5" />
                    Logs
                  </Button>
                </div>
              </div>

              {connTestResult && connTestState === "done" && (
                <div className={`rounded-lg p-3 text-xs space-y-1.5 ${connTestResult.ok ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40" : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40"}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {connTestResult.ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      : <WifiOff className="w-3.5 h-3.5 text-red-500" />}
                    <span>{connTestResult.ok ? "Connection successful" : "Connection failed"}</span>
                    <span className="font-mono text-muted-foreground ml-auto">{connTestResult.latencyMs} ms</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                    <span>Token present</span>
                    <span className={connTestResult.tokenPresent ? "text-green-600" : "text-red-500"}>
                      {connTestResult.tokenPresent ? "✓ Yes" : "✗ No"}
                    </span>
                    <span>Repo reachable</span>
                    <span className={connTestResult.repoReachable ? "text-green-600" : "text-red-500"}>
                      {connTestResult.repoReachable ? "✓ Yes" : "✗ No"}
                    </span>
                    <span>Write access</span>
                    <span className={connTestResult.writeAccess ? "text-green-600" : "text-amber-600"}>
                      {connTestResult.writeAccess ? "✓ Yes" : "✗ No"}
                    </span>
                    {connTestResult.httpStatus && (
                      <>
                        <span>HTTP status</span>
                        <span className="font-mono">{connTestResult.httpStatus}</span>
                      </>
                    )}
                  </div>
                  {connTestResult.error && (
                    <p className="text-red-600 dark:text-red-400 font-mono text-[10px] break-all">{connTestResult.error}</p>
                  )}
                </div>
              )}

              {showDiagnostics && syncDiagnostics.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Recent sync attempts</p>
                    <button onClick={() => setShowDiagnostics(false)} className="text-xs text-muted-foreground hover:text-foreground">Hide</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {syncDiagnostics.map((d, i) => (
                      <div key={i} className={`rounded px-2 py-1.5 text-[10px] font-mono border ${d.ok ? "bg-green-50/50 border-green-200 dark:bg-green-950/10 dark:border-green-800/30" : "bg-red-50/50 border-red-200 dark:bg-red-950/10 dark:border-red-800/30"}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={d.ok ? "text-green-600" : "text-red-500"}>{d.ok ? "✓" : "✗"}</span>
                          <span className="font-semibold">{d.method ?? (d.direction === "write" ? "POST" : "GET")} {d.endpoint ?? `/api/data/${d.type}`}</span>
                          <span className="text-muted-foreground">HTTP {d.httpStatus ?? "—"}</span>
                          <span className="text-muted-foreground ml-auto">{d.latencyMs} ms</span>
                        </div>
                        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          <span>{new Date(d.timestamp).toLocaleTimeString()}</span>
                          {d.contentType != null && (
                            <span className={d.contentType?.includes("application/json") ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                              {d.contentType || "no content-type"}
                            </span>
                          )}
                          {d.error && <span className="text-red-500 break-all">{d.error}</span>}
                        </div>
                        {d.responseBodyPreview && !d.ok && (
                          <div className="mt-1 text-[9px] text-muted-foreground/70 truncate border-t border-current/10 pt-0.5">
                            {d.responseBodyPreview}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showDiagnostics && syncDiagnostics.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No sync attempts recorded yet. Sync members or moments to see diagnostics.</p>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Each sync creates a backup snapshot in the repository before overwriting. Family members will
                see your changes on their next app load. Photos are stored locally only.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Appearance</CardTitle>
          <CardDescription>Customize how the app looks on your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">Switch between light and dark themes.</p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      {/* Import Data */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Import Data</CardTitle>
          <CardDescription>Import contacts from CSV or Excel files.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/import">
            <Button className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Go to Import Page
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Data Health */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Data Health</CardTitle>
            <CardDescription>Run integrity checks, detect duplicates, and repair lineage data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/data-health">
              <Button className="gap-2" variant="outline">
                <Shield className="w-4 h-4" />
                Open Data Health Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Photo Migration (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Photo Storage Migration
            </CardTitle>
            <CardDescription>
              Move inline photos from localStorage to IndexedDB to free up storage and improve performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/60 rounded-lg p-3">
                <p className="text-2xl font-bold font-serif">{inlinePhotoCount}</p>
                <p className="text-xs text-muted-foreground">Inline photos in localStorage</p>
              </div>
              <div className="bg-muted/60 rounded-lg p-3">
                <p className="text-2xl font-bold font-serif">
                  {inlinePhotoBytesKB > 0 ? `~${inlinePhotoBytesKB} KB` : "0 KB"}
                </p>
                <p className="text-xs text-muted-foreground">Estimated storage used</p>
              </div>
            </div>

            {migrationStatus === "running" && (
              <div className="space-y-1.5">
                <Progress value={undefined} className="h-2 animate-pulse" />
                <p className="text-xs text-muted-foreground">Migrating photos to IndexedDB…</p>
              </div>
            )}

            {migrationStatus === "done" && migrationResult && (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {migrationResult.migrated} photo{migrationResult.migrated !== 1 ? "s" : ""} migrated
                  {migrationResult.skipped > 0 ? `, ${migrationResult.skipped} skipped` : ""}.
                </span>
              </div>
            )}

            <Button
              onClick={handlePhotoMigration}
              disabled={migrationStatus === "running" || inlinePhotoCount === 0}
              variant="outline"
              className="gap-2"
            >
              <Database className="w-4 h-4" />
              {migrationStatus === "running"
                ? "Migrating…"
                : migrationStatus === "done"
                ? "Migration Complete"
                : inlinePhotoCount === 0
                ? "No Photos to Migrate"
                : `Migrate ${inlinePhotoCount} Photo${inlinePhotoCount !== 1 ? "s" : ""} to IndexedDB`}
            </Button>

            <p className="text-xs text-muted-foreground">
              Photos already in IndexedDB (marked <code className="bg-muted px-1 rounded">idb:…</code>) are skipped automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Admin password */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Admin Access</CardTitle>
            <CardDescription>Change the master password used to manage the directory.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit">Change Password</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Full Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Archive className="w-5 h-5 text-primary" />
            Full Backup & Restore
          </CardTitle>
          <CardDescription>
            Export a complete backup including members, audit history, and metadata. Import to restore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleFullExport} className="flex-1 gap-2" variant="outline">
              <Download className="w-4 h-4" />
              Export Full Backup
            </Button>

            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImportFileSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 gap-2"
              variant="outline"
            >
              <Upload className="w-4 h-4" />
              Restore from Backup
            </Button>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg flex gap-3 text-sm text-muted-foreground items-start">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p>
              <strong>How data works:</strong> Changes are saved locally on this device first.
              Admins can push updates to the shared repository via Settings &gt; GitHub Sync — family members on other
              devices will see the latest data on their next visit. Photos stay on-device and are never synced.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-serif flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Activity Log
                </CardTitle>
                <CardDescription className="mt-1">
                  Audit trail of all create, update, delete, archive, and merge actions.
                </CardDescription>
              </div>
              <div className="flex gap-2 shrink-0">
                {auditEntries === null ? (
                  <Button variant="outline" size="sm" onClick={loadAuditLog} className="gap-2">
                    <History className="w-3.5 h-3.5" />
                    Load Log
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAuditLog}
                    disabled={auditEntries.length === 0}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {auditEntries !== null && (
            <CardContent className="space-y-2 pt-0">
              {auditEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {auditEntries.slice(0, 100).map((entry) => {
                    const expanded = auditExpanded[entry.id];
                    const changesCount = entry.changes ? Object.keys(entry.changes).length : 0;
                    const actionColors: Record<AuditAction, string> = {
                      create:    "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400",
                      update:    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
                      delete:    "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400",
                      archive:   "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400",
                      unarchive: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400",
                      merge:     "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400",
                    };
                    return (
                      <div key={entry.id} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${actionColors[entry.action]}`}>
                              {entry.action}
                            </span>
                            <span className="text-sm font-medium truncate">{entry.memberName}</span>
                            {entry.note && (
                              <span className="text-xs text-muted-foreground truncate">{entry.note}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(entry.timestamp).toLocaleDateString(undefined, {
                                month: "short", day: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                            {changesCount > 0 && (
                              <button
                                onClick={() => setAuditExpanded(p => ({ ...p, [entry.id]: !p[entry.id] }))}
                                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                              >
                                {changesCount} field{changesCount !== 1 ? "s" : ""}
                                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>
                        {expanded && entry.changes && (
                          <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                            {Object.entries(entry.changes).map(([field, { from, to }]) => (
                              <div key={field} className="text-[11px] font-mono grid grid-cols-[auto_1fr_1fr] gap-2 items-start">
                                <span className="text-muted-foreground font-sans font-medium">{field}:</span>
                                <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-1 rounded truncate">
                                  {from === undefined || from === null || from === "" ? <em className="opacity-50">empty</em> : String(from)}
                                </span>
                                <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-1 rounded truncate">
                                  {to === undefined || to === null || to === "" ? <em className="opacity-50">empty</em> : String(to)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {auditEntries.length > 100 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Showing 100 of {auditEntries.length} entries. Export full backup to see complete history.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Debug — Persistence Controls (admin only) */}
      {isAdmin && (
        <Card className="border-muted/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-sm flex items-center gap-2 text-muted-foreground">
              Debug — Persistence Controls
            </CardTitle>
            <CardDescription className="text-xs">
              Use to isolate data-disappearing issues. When GitHub hydration is disabled
              the app reads only from this device&rsquo;s localStorage, so you can confirm
              whether remote sync is overwriting local edits. Takes effect on next page load.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-muted bg-muted/20">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium">Disable GitHub hydration</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When ON, GitHub reads are skipped — only localStorage is used. Make an edit,
                  reload, and check if it persists. If it does, remote sync was the culprit.
                </p>
              </div>
              <Switch
                checked={githubHydrationDisabled}
                onCheckedChange={(v) => {
                  setGithubHydrationDisabled(v);
                  if (v) {
                    localStorage.setItem(GITHUB_HYDRATION_DISABLED_KEY, "1");
                    toast.info("GitHub hydration disabled — takes effect on next page load");
                  } else {
                    localStorage.removeItem(GITHUB_HYDRATION_DISABLED_KEY);
                    toast.info("GitHub hydration re-enabled — takes effect on next page load");
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone (admin only) */}
      {isAdmin && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions that permanently delete data. Use with caution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-semibold">Reset All Family Data</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clears all members, moments, photos, audit log, and relationship data from this
                  device and the shared GitHub repository. Admin password and theme are preserved.
                  The app will reload to a clean state ready for fresh import.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => { setResetConfirmText(""); setResetDialogOpen(true); }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center text-sm text-muted-foreground pt-4">
        <p>G K Shah Family Chronicle v2.1</p>
        <p>Built with care for the family.</p>
      </div>

      {/* Restore Preview Dialog */}
      <Dialog open={restorePreview !== null} onOpenChange={(o) => !o && setRestorePreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-600" />
              Restore Preview
            </DialogTitle>
            <DialogDescription>
              Review what will be imported before applying. This will replace all current members.
            </DialogDescription>
          </DialogHeader>

          {restorePreview && restoreStats && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/60 rounded-lg p-3">
                  <p className="text-2xl font-bold font-serif">{restorePreview.members.length}</p>
                  <p className="text-xs text-muted-foreground">Members in backup</p>
                </div>
                <div className="bg-muted/60 rounded-lg p-3">
                  <p className="text-2xl font-bold font-serif">{restorePreview.auditLog.length}</p>
                  <p className="text-xs text-muted-foreground">Audit log entries</p>
                </div>
                <div className="bg-muted/60 rounded-lg p-3">
                  <p className="text-2xl font-bold font-serif text-green-600">{restoreStats.newCount}</p>
                  <p className="text-xs text-muted-foreground">New members</p>
                </div>
                <div className="bg-muted/60 rounded-lg p-3">
                  <p className="text-2xl font-bold font-serif text-amber-600">{restoreStats.updatedCount}</p>
                  <p className="text-xs text-muted-foreground">Existing (will update)</p>
                </div>
              </div>

              {restorePreview.exportedAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Backup from {new Date(restorePreview.exportedAt).toLocaleString()}
                </div>
              )}

              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Restoring will <strong>replace all current members</strong> in this browser.
                  Export a backup of the current data first if you need to keep it.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRestorePreview(null)}>Cancel</Button>
            <Button onClick={applyRestore} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Upload className="w-4 h-4" />
              Apply Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Reset Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onOpenChange={(o) => { if (!isResetting) { setResetDialogOpen(o); setResetConfirmText(""); } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Reset All Family Data?
            </DialogTitle>
            <DialogDescription className="space-y-1 pt-1">
              This will permanently erase <strong>everything</strong> — members, moments, photos,
              audit log, relationship history, and GitHub repository data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1.5 text-sm">
              <p className="font-medium text-destructive">What will be deleted:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>All family members and relationship data</li>
                <li>All moments and photo metadata</li>
                <li>All member and moment photos (IndexedDB)</li>
                <li>Audit log and activity history</li>
                <li>GitHub repository data (members.json, moments.json)</li>
              </ul>
              <p className="font-medium text-green-700 dark:text-green-400 pt-1">What is kept:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>Admin password and login session</li>
                <li>App theme (light / dark)</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type <code className="bg-muted px-1.5 py-0.5 rounded text-destructive font-bold">RESET</code> to confirm
              </label>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                placeholder="Type RESET here"
                disabled={isResetting}
                className="font-mono border-destructive/40 focus-visible:ring-destructive/40"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setResetDialogOpen(false); setResetConfirmText(""); }}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetConfirmText !== "RESET" || isResetting}
              className="gap-2"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Resetting…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Reset Everything
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
