import { useMemo, useState } from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import {
  runIntegrityCheck,
  rebuildChildrenArrays,
  repairMissingLineageRoots,
  recomputeAllGenerations,
  repairSpouseBacklinks,
} from "@/lib/familyTree";
import { detectPotentialDuplicates } from "@/hooks/useFamilyStore";
import { MergeMembersDialog } from "@/components/MergeMembersDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  CheckCircle2, RefreshCw, Download, Users, GitBranch,
  Fingerprint, Calendar, User, ChevronDown, ChevronUp,
  GitMerge, Tag, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { FamilyMember } from "@/types/family";

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

function ordinalGen(n: number): string {
  if (n === 1) return "1st Generation";
  if (n === 2) return "2nd Generation";
  if (n === 3) return "3rd Generation";
  return `${n}th Generation`;
}

function SeverityIcon({ s }: { s: Severity }) {
  if (s === "critical") return <ShieldX className="w-5 h-5 text-red-500 shrink-0" />;
  if (s === "warning")  return <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />;
  if (s === "info")     return <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />;
  return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />;
}

function SeverityBadge({ s }: { s: Severity }) {
  const cls = s === "critical"
    ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400"
    : s === "warning"
    ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400"
    : s === "info"
    ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400"
    : "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400";
  const label = s === "critical" ? "Critical" : s === "warning" ? "Warning" : s === "info" ? "Info" : "OK";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

function HealthCard({ item }: { item: HealthItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={[
      "rounded-lg border p-4 transition-colors",
      item.severity === "critical" ? "border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-800/50"  :
      item.severity === "warning"  ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800/50" :
      item.severity === "info"     ? "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800/50"   :
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
  const { members, isLoaded, importMembers, mergeMember, undoLastAction } = useFamilyStore();
  const { isAdmin } = useAdminMode();
  const [, setLocation] = useLocation();
  const [repairing, setRepairing] = useState<string | null>(null);
  const [mergePair, setMergePair] = useState<{ memberA: FamilyMember; memberB: FamilyMember } | null>(null);

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

  // New checks
  const noBranchMembers = useMemo(
    () => members.filter(m => !m.mainFamilyBranch && !m.isArchived),
    [members]
  );

  const suspiciousAges = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return members.filter(m => {
      if (!m.birthday || m.isArchived) return false;
      const birthYear = new Date(m.birthday).getFullYear();
      const age = currentYear - birthYear;
      return birthYear < 1900 || age > 115;
    });
  }, [members]);

  const genStringMismatches = useMemo(
    () => members.filter(m =>
      m.generationNumber &&
      m.generation &&
      m.generation !== ordinalGen(m.generationNumber)
    ),
    [members]
  );

  const disconnectedRoots = useMemo(
    () => members.filter(m =>
      !m.isArchived &&
      !m.fatherId && !m.motherId &&
      (m.generationNumber ?? 1) > 1
    ),
    [members]
  );

  const relationshipConflicts = useMemo(
    () => members.filter(m =>
      !m.isArchived && (
        (m.fatherId && m.fatherId === m.motherId) ||
        (m.fatherId && m.fatherId === m.spouseId) ||
        (m.motherId && m.motherId === m.spouseId)
      )
    ),
    [members]
  );

  // Duplicate detection with full member objects
  const duplicatePairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: Array<{
      idA: string; idB: string;
      nameA: string; nameB: string;
      reasons: string[];
    }> = [];
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
          pairs.push({ idA: m.id, idB: d.id, nameA: m.fullName, nameB: d.fullName, reasons });
        }
      });
    });
    return pairs;
  }, [members]);

  // Repairs

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

  const rebuildEntireTree = () => {
    setRepairing("tree");
    try {
      let fixed = rebuildChildrenArrays(members);
      fixed = repairMissingLineageRoots(fixed);
      fixed = recomputeAllGenerations(fixed);
      fixed = repairSpouseBacklinks(fixed);
      importMembers(fixed);
      toast.success("Tree rebuilt — children, lineage, generations, and spouse backlinks repaired");
    } catch {
      toast.error("Rebuild failed");
    }
    setRepairing(null);
  };

  const fixGenStrings = () => {
    const fixed = members.map(m => {
      if (m.generationNumber && m.generation && m.generation !== ordinalGen(m.generationNumber)) {
        return { ...m, generation: ordinalGen(m.generationNumber), updatedAt: new Date().toISOString() };
      }
      return m;
    });
    importMembers(fixed);
    toast.success(`Fixed ${genStringMismatches.length} generation label${genStringMismatches.length !== 1 ? "s" : ""}`);
  };

  const handleMerge = (winnerId: string, loserId: string, fieldOverrides: Partial<FamilyMember>) => {
    const result = mergeMember(winnerId, loserId, fieldOverrides);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Members merged successfully", {
        action: {
          label: "Undo",
          onClick: () => {
            undoLastAction();
            toast.success("Merge undone");
          },
        },
      });
      setMergePair(null);
    }
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
      description: "Members sharing the same name, phone, or birthday. Use the Merge tool below to consolidate.",
      severity: duplicatePairs.length > 0 ? "warning" : "ok",
      count: duplicatePairs.length,
      details: duplicatePairs.map(p => `"${p.nameA}" ↔ "${p.nameB}" — ${p.reasons.join(", ")}`),
    },
    {
      id: "noBranch",
      label: "Members Without Family Branch",
      description: "Members with no mainFamilyBranch assigned. Assign a branch for better organisation.",
      severity: noBranchMembers.length > members.filter(m => !m.isArchived).length * 0.4 ? "warning" : "info",
      count: noBranchMembers.length,
      details: noBranchMembers.slice(0, 20).map(m => `${m.fullName} (${m.memberId ?? m.id})`),
    },
    {
      id: "suspiciousAge",
      label: "Suspicious Birthdates",
      description: "Members born before 1900 or with age over 115 years. Verify these dates.",
      severity: suspiciousAges.length > 0 ? "warning" : "ok",
      count: suspiciousAges.length,
      details: suspiciousAges.map(m => {
        const year = new Date(m.birthday!).getFullYear();
        return `${m.fullName} — born ${year}`;
      }),
    },
    {
      id: "genStringMismatch",
      label: "Generation Label Mismatches",
      description: "Members where the generation string doesn't match their generation number.",
      severity: genStringMismatches.length > 0 ? "warning" : "ok",
      count: genStringMismatches.length,
      details: genStringMismatches.map(m =>
        `${m.fullName}: has "${m.generation}", expected "${ordinalGen(m.generationNumber!)}"`
      ),
      repair: fixGenStrings,
      repairLabel: "Fix All Labels",
    },
    {
      id: "disconnectedRoots",
      label: "Disconnected Sub-tree Roots",
      description: "Members in generation 2+ with no parent links. They become isolated roots in the tree, disconnected from the main lineage.",
      severity: disconnectedRoots.length > 0 ? "warning" : "ok",
      count: disconnectedRoots.length,
      details: disconnectedRoots.map(m =>
        `${m.fullName} (Gen ${m.generationNumber ?? "?"}) — no father or mother linked`
      ),
    },
    {
      id: "relationshipConflicts",
      label: "Relationship Conflicts",
      description: "Members where the same person appears as both father and mother, or simultaneously as a parent and spouse. These must be manually corrected.",
      severity: relationshipConflicts.length > 0 ? "critical" : "ok",
      count: relationshipConflicts.length,
      details: relationshipConflicts.map(m => {
        const conflicts: string[] = [];
        if (m.fatherId && m.fatherId === m.motherId) conflicts.push("same person as father and mother");
        if (m.fatherId && m.fatherId === m.spouseId) conflicts.push("father is also listed as spouse");
        if (m.motherId && m.motherId === m.spouseId) conflicts.push("mother is also listed as spouse");
        return `${m.fullName}: ${conflicts.join("; ")}`;
      }),
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
      details: archivedMembers.map(m =>
        `${m.fullName} — archived ${m.archivedAt ? new Date(m.archivedAt).toLocaleDateString() : "date unknown"}`
      ),
    },
  ];

  const criticalCount = healthItems.filter(i => i.severity === "critical" && i.count > 0).length;
  const warningCount  = healthItems.filter(i => i.severity === "warning"  && i.count > 0).length;
  const okCount       = healthItems.filter(i => i.severity === "ok").length;

  const exportReport = () => {
    const exportData = {
      generatedAt: new Date().toISOString(),
      totalMembers: members.length,
      summary: { criticalCount, warningCount, okItems: okCount },
      items: healthItems.map(i => ({
        id: i.id, label: i.label, severity: i.severity, count: i.count, details: i.details,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
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
            Integrity report for {members.length} members · {healthItems.length} checks.
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

      {/* Merge Duplicates section */}
      {duplicatePairs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-amber-600" />
              Merge Duplicate Members
            </CardTitle>
            <CardDescription>
              Review each suspected duplicate pair and merge them if they represent the same person.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {duplicatePairs.map((pair, i) => {
              const memberA = members.find(m => m.id === pair.idA);
              const memberB = members.find(m => m.id === pair.idB);
              if (!memberA || !memberB) return null;
              return (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {pair.nameA} <span className="text-muted-foreground font-normal">↔</span> {pair.nameB}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pair.reasons.map((r, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMergePair({ memberA, memberB })}
                    className="gap-1.5 shrink-0 border-amber-300 hover:bg-amber-50 dark:border-amber-700"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    Merge
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">Quick Actions</CardTitle>
          <CardDescription>Fix issues or navigate to related pages.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="default"
            size="sm"
            onClick={rebuildEntireTree}
            disabled={repairing === "tree"}
            className="gap-2 bg-amber-700 hover:bg-amber-800 text-white"
          >
            <RefreshCw className={`w-4 h-4 ${repairing === "tree" ? "animate-spin" : ""}`} />
            Rebuild Tree
          </Button>
          <Button variant="outline" size="sm" onClick={repairChildren} disabled={repairing === "children"} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Rebuild Children Arrays
          </Button>
          <Button variant="outline" size="sm" onClick={repairLineage} disabled={repairing === "lineage"} className="gap-2">
            <GitBranch className="w-4 h-4" />
            Repair Lineage Roots
          </Button>
          {genStringMismatches.length > 0 && (
            <Button variant="outline" size="sm" onClick={fixGenStrings} className="gap-2">
              <Tag className="w-4 h-4" />
              Fix Generation Labels ({genStringMismatches.length})
            </Button>
          )}
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

      {/* Merge dialog */}
      {mergePair && (
        <MergeMembersDialog
          open={true}
          onClose={() => setMergePair(null)}
          memberA={mergePair.memberA}
          memberB={mergePair.memberB}
          onMerge={handleMerge}
        />
      )}
    </div>
  );
}
