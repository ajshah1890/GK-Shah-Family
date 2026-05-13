import { useFamilyStore } from "@/hooks/useFamilyStore";
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
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, useMemo } from "react";
import { useAdminMode } from "@/hooks/useAdminMode";
import { Link } from "wouter";
import { readAuditLog, clearAuditLog, AuditEntry, AuditAction } from "@/lib/auditLog";
import { photoRepository } from "@/lib/repository";
import { loadMoments } from "@/lib/momentsRepository";
import { FamilyMember } from "@/types/family";

interface RestorePreview {
  members: FamilyMember[];
  auditLog: AuditEntry[];
  version: number;
  exportedAt?: string;
}

export default function Settings() {
  const { members, importMembers } = useFamilyStore();
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
              <strong>Privacy Note:</strong> This app runs entirely in your browser. No data is ever sent to a server.
              Everything is stored locally on this device. Clearing your browser data will delete the directory.
              Export a backup regularly to avoid data loss.
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
    </div>
  );
}
