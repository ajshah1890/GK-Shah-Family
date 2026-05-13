import { useMemo, useState } from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import {
  runIntegrityCheck,
  rebuildChildrenArrays,
  repairMissingLineageRoots,
} from "@/lib/familyTree";
import { detectPotentialDuplicates } from "@/hooks/useFamilyStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  CheckCircle2, RefreshCw, Download, Users, GitBranch,
  Fingerprint, Calendar, User, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

type Severity = "critical" | "warning" | "info" | "ok";

interface HealthItem {
  id: string;
  label: string;
  description: string;
  severity: Severity;
  count: number;
  details?: string[];
  repair?: () => void;
  repairLabel?: string;
}

function SeverityIcon({ s }: { s: Severity }) {
  if (s === "critical") return <ShieldX className="w-5 h-5 text-red-500 shrink-0" />;
  if (s === "warning")  return <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />;
  if (s === "info")     return <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />;
  return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />;
}

function SeverityBadge({ s }: { s: Severity }) {
  const cls = s === "critical" ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400"
    : s === "warning" ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400"
    : s === "info" ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400"
    : "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400";
  const label = s === "critical" ? "Critical" : s === "warning" ? "Warning" : s === "info" ? "Info" : "OK";
  return <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}

function HealthCard({ item }: { item: HealthItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={[
      "rounded-lg border p-4 transition-colors",
      item.severity === "critical" ? "border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-800/50" :
      item.severity === "warning"  ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800/50" :
      item.severity === "info"     ? "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800/50" :
      "border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-800/50",
    ].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <SeverityIcon s={item.severity} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{item.label}</p>
              <SeverityBadge s={item.severity} />
              {item.count > 0 && (
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{item.count}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.repair && item.count > 0 && (
            <Button size="sm" variant="outline" onClick={item.repair} className="h-7 text-xs gap-1.5">
              <RefreshCw className="w-3 h-3" />
              {item.repairLabel ?? "Fix"}
            </Button>
          )}
          {item.details && item.details.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(e => !e)} className="h-7 w-7 p-0">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {expanded && item.details && item.details.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-1 max-h-40 overflow-y-auto">
          {item.details.map((d, i) => (
            <p key={i} className="text-xs text-muted-foreground font-mono bg-background/60 px-2 py-1 rounded">{d}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DataHealth() {
  const { members, isLoaded, importMembers } = useFamilyStore();
  const { isAdmin } = useAdminMode();
  const [, setLocation] = useLocation();
  const [repairing, setRepairing] = useState<string | null>(null);

  const report = useMemo(() => runIntegrityCheck(members), [members]);

  const missingGeneration = useMemo(
    () => members.filter(m => !m.generationNumber || m.generationNumber === 0),
    [members]
  );

  const missingBirthday = useMemo(
    () => members.filter(m => !m.birthday),
    [members]
  );

  const missingContact = useMemo(
    () => members.filter(m => !m.phone && !m.email),
    [members]
  );

  const missingMemberId = useMemo(
    () => members.filter(m => !m.memberId),
    [members]
  );

  const archivedMembers = useMemo(
    () => members.filter(m => m.isArchived),
    [members]
  );

  // Duplicate detection: sample check on all members
  const duplicatePairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: Array<{ a: string; b: string; reasons: string[] }> = [];
    members.forEach(m => {
      const dupes = detectPotentialDuplicates(
        { fullName: m.fullName, phone: m.phone, birthday: m.birthday },
        members,
        m.id
      );
      dupes.forEach(({ member: d, reasons }) => {
        const key = [m.id, d.id].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ a: m.fullName, b: d.fullName, reasons });
        }
      });
    });
    return pairs;
  }, [members]);

  const repairLineage = () => {
    setRepairing("lineage");
    try {
      const fixed = repairMissingLineageRoots(members);
      importMembers(fixed);
      toast.success("Lineage roots repaired successfully");
    } catch {
      toast.error("Repair failed");
    }
    setRepairing(null);
  };

  const repairChildren = () => {
    setRepairing("children");
    try {
      const fixed = rebuildChildrenArrays(members);
      importMembers(fixed);
      toast.success("Children arrays rebuilt successfully");
    } catch {
      toast.error("Repair failed");
    }
    setRepairing(null);
  };

  const healthItems: HealthItem[] = [
    {
      id: "circular",
      label: "Circular Ancestry Relationships",
      description: "Members whose ancestry chain forms a loop. These must be repaired manually.",
      severity: report.circularIds.length > 0 ? "critical" : "ok",
      count: report.circularIds.length,
      details: report.circularIds.map(id => {
        const m = members.find(x => x.id === id);
        return m ? `${m.fullName} (${m.memberId ?? id})` : id;
      }),
    },
    {
      id: "orphans",
      label: "Broken Parent/Spouse Links",
      description: "Members referencing parent or spouse IDs that no longer exist in the directory.",
      severity: report.orphans.length > 0 ? "critical" : "ok",
      count: report.orphans.length,
      details: report.orphans.map(o => {
        const parts = [o.member.fullName];
        if (o.missingFatherId) parts.push(`missing father: ${o.missingFatherId}`);
        if (o.missingMotherId) parts.push(`missing mother: ${o.missingMotherId}`);
        if (o.missingSpouseId) parts.push(`missing spouse: ${o.missingSpouseId}`);
        return parts.join(" — ");
      }),
    },
    {
      id: "lineage",
      label: "Missing Lineage Roots",
      description: "Members without a lineageRootId. These won't appear correctly in the tree.",
      severity: report.missingLineageCount > 0 ? "warning" : "ok",
      count: report.missingLineageCount,
      repair: repairLineage,
      repairLabel: repairing === "lineage" ? "Repairing…" : "Auto-repair",
    },
    {
      id: "children",
      label: "Children Arrays Consistency",
      description: "Rebuild childrenIds from fatherId/motherId references to ensure tree consistency.",
      severity: "info",
      count: members.filter(m => !m.childrenIds).length,
      repair: repairChildren,
      repairLabel: repairing === "children" ? "Rebuilding…" : "Rebuild",
    },
    {
      id: "duplicates",
      label: "Possible Duplicate Members",
      description: "Members sharing the same name, phone, or birthday. Review and merge if needed.",
      severity: duplicatePairs.length > 0 ? "warning" : "ok",
      count: duplicatePairs.length,
      details: duplicatePairs.map(p => `"${p.a}" ↔ "${p.b}" — ${p.reasons.join(", ")}`),
    },
    {
      id: "missingGen",
      label: "Missing Generation Numbers",
      description: "Members without a generationNumber. They may appear at the wrong position in the tree.",
      severity: missingGeneration.length > 0 ? "warning" : "ok",
      count: missingGeneration.length,
      details: missingGeneration.map(m => `${m.fullName} (${m.memberId ?? m.id})`),
    },
    {
      id: "missingBirthday",
      label: "Missing Birthdays",
      description: "Members without a birthday. They won't appear in the upcoming birthdays widget.",
      severity: missingBirthday.length > members.length * 0.5 ? "warning" : "info",
      count: missingBirthday.length,
    },
    {
      id: "missingContact",
      label: "Missing Contact Info",
      description: "Members without both phone and email. They can't be reached directly from their profile.",
      severity: missingContact.length > members.length * 0.5 ? "warning" : "info",
      count: missingContact.length,
      details: missingContact.slice(0, 20).map(m => `${m.fullName} (${m.generation ?? "unknown gen"})`),
    },
    {
      id: "missingMemberId",
      label: "Missing Member IDs",
      description: "Members without a permanent GK-Gx-xxxx Member ID. Should be auto-assigned on migration.",
      severity: missingMemberId.length > 0 ? "warning" : "ok",
      count: missingMemberId.length,
      details: missingMemberId.map(m => m.fullName),
    },
    {
      id: "archived",
      label: "Archived Members",
      description: "Members soft-deleted but still in storage. Review or permanently remove.",
      severity: archivedMembers.length > 0 ? "info" : "ok",
      count: archivedMembers.length,
      details: archivedMembers.map(m => `${m.fullName} — archived ${m.archivedAt ? new Date(m.archivedAt).toLocaleDateString() : "date unknown"}`),
    },
  ];

  const criticalCount = healthItems.filter(i => i.severity === "critical" && i.count > 0).length;
  const warningCount  = healthItems.filter(i => i.severity === "warning"  && i.count > 0).length;
  const okCount       = healthItems.filter(i => i.severity === "ok").length;

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      totalMembers: members.length,
      summary: { criticalCount, warningCount, okItems: okCount },
      items: healthItems.map(i => ({
        id: i.id, label: i.label, severity: i.severity, count: i.count, details: i.details,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gkshah-health-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Health report exported");
  };

  if (!isLoaded) return null;

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <ShieldX className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold font-serif">Admin Access Required</h2>
        <p className="text-muted-foreground mt-2">Log in as admin to view the Data Health dashboard.</p>
        <Button onClick={() => setLocation("/settings")} className="mt-4">Go to Settings</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Data Health</h1>
          <p className="text-muted-foreground mt-1">
            Integrity report for {members.length} members. Run periodic checks to keep lineage data clean.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportReport} className="gap-2 shrink-0">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={criticalCount > 0 ? "border-red-200 bg-red-50/50 dark:bg-red-950/10" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldX className={`w-7 h-7 shrink-0 ${criticalCount > 0 ? "text-red-500" : "text-muted-foreground/30"}`} />
            <div>
              <p className="text-2xl font-serif font-bold">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical issues</p>
            </div>
          </CardContent>
        </Card>
        <Card className={warningCount > 0 ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className={`w-7 h-7 shrink-0 ${warningCount > 0 ? "text-amber-500" : "text-muted-foreground/30"}`} />
            <div>
              <p className="text-2xl font-serif font-bold">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
          </CardContent>
        </Card>
        <Card className={okCount === healthItems.length ? "border-green-200 bg-green-50/50 dark:bg-green-950/10" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className={`w-7 h-7 shrink-0 ${okCount === healthItems.length ? "text-green-500" : "text-muted-foreground/30"}`} />
            <div>
              <p className="text-2xl font-serif font-bold">{okCount}/{healthItems.length}</p>
              <p className="text-xs text-muted-foreground">Checks passed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health items */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Integrity Checks</h2>
        {healthItems
          .sort((a, b) => {
            const order = { critical: 0, warning: 1, info: 2, ok: 3 };
            if (a.severity === b.severity) return b.count - a.count;
            return order[a.severity] - order[b.severity];
          })
          .map(item => <HealthCard key={item.id} item={item} />)
        }
      </div>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">Quick Actions</CardTitle>
          <CardDescription>Fix issues or navigate to related pages.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={repairChildren} disabled={repairing === "children"} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Rebuild Children Arrays
          </Button>
          <Button variant="outline" size="sm" onClick={repairLineage} disabled={repairing === "lineage"} className="gap-2">
            <GitBranch className="w-4 h-4" />
            Repair Lineage Roots
          </Button>
          <Link href="/members">
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="w-4 h-4" />
              Browse Members
            </Button>
          </Link>
          <Link href="/import">
            <Button variant="outline" size="sm" className="gap-2">
              <Fingerprint className="w-4 h-4" />
              Import / Merge Data
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
