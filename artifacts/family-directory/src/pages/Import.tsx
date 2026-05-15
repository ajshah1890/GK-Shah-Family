import { useState, useRef } from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileSpreadsheet, Upload, Download, ArrowRight, CheckCircle2,
  AlertTriangle, AlertCircle, Info, ChevronLeft, RefreshCw,
  Users, Link2, LinkIcon, SkipForward, Copy, CircleX, GitFork,
} from "lucide-react";
import { toast } from "sonner";
import { FamilyMember } from "@/types/family";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { MEMBER_SCHEMA, IMPORT_ALIAS_MAP, EXPORT_COLUMNS } from "@/lib/memberSchema";
import { runImport, ImportResult, ImportOptions, WarnType } from "@/lib/importEngine";

// ─── helpers ─────────────────────────────────────────────────────────────────

const DUPE_IMPORT_KEY = "gkshah_last_import";

function autoMap(rawHeaders: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  rawHeaders.forEach(h => {
    const key = IMPORT_ALIAS_MAP[h.toLowerCase().trim()];
    if (key) result[h] = key;
  });
  return result;
}

function buildExportRow(m: FamilyMember): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const { key, label } of EXPORT_COLUMNS) {
    const val = m[key];
    if (key === "childrenNames" && Array.isArray(val)) {
      row[label] = (val as string[]).join(", ");
    } else {
      row[label] = val ?? "";
    }
  }
  return row;
}

interface WarnMeta { icon: React.ReactNode; color: string; label: string }
function warnMeta(type: WarnType): WarnMeta {
  switch (type) {
    case "circular_ancestry": return { icon: <CircleX className="w-3.5 h-3.5" />, color: "text-destructive", label: "Circular ancestry" };
    case "duplicate_in_file": return { icon: <Copy className="w-3.5 h-3.5" />, color: "text-orange-600 dark:text-orange-400", label: "Duplicate in file" };
    case "duplicate_in_store": return { icon: <Copy className="w-3.5 h-3.5" />, color: "text-yellow-600 dark:text-yellow-400", label: "Already in directory" };
    case "missing_father": return { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-orange-600 dark:text-orange-400", label: "Missing father" };
    case "missing_mother": return { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-orange-600 dark:text-orange-400", label: "Missing mother" };
    case "unresolved_spouse": return { icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-yellow-600 dark:text-yellow-400", label: "Unresolved spouse" };
    case "orphan": return { icon: <Info className="w-3.5 h-3.5" />, color: "text-muted-foreground", label: "Isolated member" };
    case "self_reference": return { icon: <CircleX className="w-3.5 h-3.5" />, color: "text-destructive", label: "Self-reference" };
  }
}

// ─── component ────────────────────────────────────────────────────────────────

type Step = "upload" | "mapping" | "preview";

export default function Import() {
  const { members, importMembers } = useFamilyStore();
  const { isAdmin } = useAdminMode();

  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update">("skip");
  const [replaceAll, setReplaceAll] = useState(false);
  const [recomputeGenerations, setRecomputeGenerations] = useState(false);
  const [analysis, setAnalysis] = useState<ImportResult | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dupeImportWarning, setDupeImportWarning] = useState(false);

  const csvFileRef = useRef<HTMLInputElement>(null);
  const excelFileRef = useRef<HTMLInputElement>(null);

  // ── File parsing ────────────────────────────────────────────────────────────

  const processFile = (rawHeaders: string[], rawRows: unknown[][], name: string) => {
    setHeaders(rawHeaders);
    setMapping(autoMap(rawHeaders));
    setRows(rawRows);
    setFileName(name);

    // Duplicate-import detection
    const fingerprint = `${name}::${rawRows.length}`;
    const last = localStorage.getItem(DUPE_IMPORT_KEY);
    setDupeImportWarning(last === fingerprint);

    setStep("mapping");
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length < 2) { toast.error("File is empty"); return; }
        processFile(data[0], data.slice(1), file.name);
      },
      error: (err) => toast.error(`CSV parse error: ${err.message}`),
    });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
        if (data.length < 2) { toast.error("File is empty"); return; }
        processFile(data[0] as string[], data.slice(1) as unknown[][], file.name);
      } catch {
        toast.error("Could not read Excel file");
      }
    };
    reader.readAsBinaryString(file);
  };

  const cancelImport = () => {
    setStep("upload");
    setHeaders([]); setRows([]); setMapping({}); setFileName("");
    setAnalysis(null); setReplaceAll(false); setDupeImportWarning(false);
    if (csvFileRef.current) csvFileRef.current.value = "";
    if (excelFileRef.current) excelFileRef.current.value = "";
  };

  // ── Analysis (dry run) ──────────────────────────────────────────────────────

  const runAnalysis = () => {
    if (!Object.values(mapping).includes("fullName")) {
      toast.error("Map at least one column to 'Full Name'");
      return;
    }
    setIsAnalysing(true);
    setTimeout(() => {
      try {
        const opts: ImportOptions = { duplicateMode, replaceAll, dryRun: true, recomputeGenerations };
        const result = runImport(rows, headers, mapping, members, opts);
        setAnalysis(result);
        setStep("preview");
      } catch (err) {
        toast.error(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsAnalysing(false);
      }
    }, 50); // yield to render spinner
  };

  // ── Execute import ──────────────────────────────────────────────────────────

  const executeImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      try {
        const opts: ImportOptions = { duplicateMode, replaceAll, dryRun: false, recomputeGenerations };
        const result = runImport(rows, headers, mapping, members, opts);

        importMembers(result.members);

        // Record fingerprint to detect duplicate imports next time
        localStorage.setItem(DUPE_IMPORT_KEY, `${fileName}::${rows.length}`);

        const { newMembers, updatedMembers, skippedMembers, resolvedByID, resolvedByName } = result.stats;
        const parts: string[] = [];
        if (newMembers > 0) parts.push(`${newMembers} added`);
        if (updatedMembers > 0) parts.push(`${updatedMembers} updated`);
        if (skippedMembers > 0) parts.push(`${skippedMembers} skipped`);
        const totalLinked = resolvedByID + resolvedByName;
        if (totalLinked > 0) parts.push(`${totalLinked} relationships linked`);
        toast.success(`Import complete: ${parts.join(", ") || "nothing changed"}`);

        cancelImport();
      } catch (err) {
        toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        setIsImporting(false);
      }
    }, 50);
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const data = members.map(buildExportRow);
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gkshah-directory-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  const exportExcel = () => {
    const data = members.map(buildExportRow);
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = EXPORT_COLUMNS.map(({ label }) => ({ wch: Math.max(label.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Directory");
    XLSX.writeFile(wb, `gkshah-directory-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Exported to Excel");
  };

  // ── Access guard ────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4">
        <h2 className="text-2xl font-bold font-serif mb-4">Access Denied</h2>
        <p className="text-muted-foreground">Admin login required to import or export data.</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Data Import & Export</h1>
        <p className="text-muted-foreground mt-1">
          Bulk manage family directory data. Export includes all {EXPORT_COLUMNS.length} fields.
        </p>
      </div>

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <Tabs defaultValue="excel" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="excel">Import Excel</TabsTrigger>
            <TabsTrigger value="csv">Import CSV</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="excel" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Import from Excel (.xlsx)</CardTitle>
                <CardDescription>
                  First row must be column headers. Columns are auto-matched to member fields.
                  Use <strong>Father Name</strong> / <strong>Mother Name</strong> columns for automatic tree linking.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-xl m-6 bg-muted/20">
                <FileSpreadsheet className="w-12 h-12 text-green-600 mb-4 opacity-60" />
                <h3 className="text-lg font-medium mb-2">Choose an Excel file</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  Use the exported template for guaranteed column matching.
                </p>
                <input type="file" accept=".xlsx,.xls" className="hidden" ref={excelFileRef} onChange={handleExcelUpload} />
                <Button onClick={() => excelFileRef.current?.click()} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <Upload className="w-4 h-4" /> Choose Excel File
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="csv" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Import from CSV</CardTitle>
                <CardDescription>
                  UTF-8 encoded, comma-separated. First row = headers.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-xl m-6 bg-muted/20">
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Choose a CSV file</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  UTF-8 encoded, comma-separated. First row = headers.
                </p>
                <input type="file" accept=".csv" className="hidden" ref={csvFileRef} onChange={handleCSVUpload} />
                <Button onClick={() => csvFileRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" /> Choose CSV File
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Export Directory Data</CardTitle>
                <CardDescription>
                  Downloads all {members.length} members with {EXPORT_COLUMNS.length} fields each.
                  Photos are excluded (too large for spreadsheets).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={exportExcel} variant="outline" className="flex-1 py-8 h-auto gap-3 flex-col text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-900 dark:hover:bg-green-950">
                    <Download className="w-6 h-6" />
                    <span>Download as Excel</span>
                    <span className="text-xs text-muted-foreground font-normal">Best for editing & re-importing</span>
                  </Button>
                  <Button onClick={exportCSV} variant="outline" className="flex-1 py-8 h-auto gap-3 flex-col">
                    <Download className="w-6 h-6" />
                    <span>Download as CSV</span>
                    <span className="text-xs text-muted-foreground font-normal">Best for sharing / backup</span>
                  </Button>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Exported columns ({EXPORT_COLUMNS.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {EXPORT_COLUMNS.map(c => (
                      <span key={c.key} className="text-[10px] bg-card border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ── Step 2: Column mapping ── */}
      {step === "mapping" && (
        <Card className="animate-in fade-in zoom-in-95">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="font-serif">Map Columns</CardTitle>
                <CardDescription className="mt-1">
                  <span className="font-medium text-foreground">{fileName}</span>
                  {" · "}{rows.length} rows · {Object.values(mapping).filter(Boolean).length} of {headers.length} columns auto-matched
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelImport} className="shrink-0">
                Cancel
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Duplicate import warning */}
            {dupeImportWarning && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-sm">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-yellow-800 dark:text-yellow-200">
                  This file was imported before. Check for duplicate entries in the preview.
                </p>
              </div>
            )}

            {/* Relationship ID guidance */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
              <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-blue-900 dark:text-blue-200">
                  Map relationship ID columns for accurate family tree linking
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  For the most accurate relationships, map these columns if your file has them:
                  <span className="font-semibold"> Member ID</span> (unique per person),
                  <span className="font-semibold"> Father ID</span>,
                  <span className="font-semibold"> Mother ID</span>, and
                  <span className="font-semibold"> Spouse ID</span>.
                  These override name-based fuzzy matching.
                  Use <span className="font-semibold">Father Name / Mother Name</span> as fallback only.
                  Preferred date format: <span className="font-mono font-semibold">YYYY-MM-DD</span> (e.g. 2000-09-18).
                </p>
              </div>
            </div>

            {/* Mapping grid */}
            <div className="bg-muted/30 p-4 rounded-lg border border-border">
              <h4 className="font-medium mb-4 flex items-center gap-2 text-sm">
                <ArrowRight className="w-4 h-4 text-primary" />
                Match your file's columns to member fields
              </h4>
              <div className="overflow-y-auto max-h-[50vh]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {headers.map(header => (
                    <div key={header} className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium truncate" title={header}>{header}</label>
                      <Select
                        value={mapping[header] || "skip"}
                        onValueChange={val =>
                          setMapping(prev => ({ ...prev, [header]: val === "skip" ? "" : val }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Skip column" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-[260px] overflow-y-auto">
                          <SelectItem value="skip" className="text-muted-foreground italic">
                            Skip this column
                          </SelectItem>
                          {MEMBER_SCHEMA.filter(f => f.key?.trim()).map(f => (
                            <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview table */}
            <div>
              <h4 className="font-medium mb-3 text-sm">Preview (first 3 rows)</h4>
              <div className="rounded-md border overflow-x-auto -mx-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={i} className="whitespace-nowrap">
                          <div className="font-bold text-foreground text-xs">{h}</div>
                          <div className="text-[10px] text-primary font-medium mt-0.5">
                            {mapping[h]
                              ? `→ ${MEMBER_SCHEMA.find(f => f.key === mapping[h])?.label ?? mapping[h]}`
                              : <span className="text-muted-foreground italic">skipped</span>}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 3).map((row, ri) => (
                      <TableRow key={ri}>
                        {headers.map((_, ci) => (
                          <TableCell key={ci} className="max-w-[140px] truncate text-xs text-muted-foreground">
                            {String((row as unknown[])[ci] ?? "-")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Duplicate handling</p>
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  {(["skip", "update"] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setDuplicateMode(mode)}
                      className={[
                        "flex-1 px-3 py-2 transition-colors capitalize",
                        duplicateMode === mode
                          ? "bg-primary text-primary-foreground font-medium"
                          : "bg-card text-muted-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      {mode === "skip" ? "Skip duplicates" : "Overwrite duplicates"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {duplicateMode === "skip" ? "Existing members are preserved" : "Existing member data will be overwritten"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Replace existing data</p>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/30 transition-colors">
                  <Checkbox
                    checked={replaceAll}
                    onCheckedChange={(v) => setReplaceAll(Boolean(v))}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium leading-tight">Replace all existing members</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Discard current directory and replace with this file entirely.
                    </p>
                  </div>
                </label>
                {replaceAll && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    All {members.length} existing member{members.length !== 1 ? "s" : ""} will be removed.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Generation numbers</p>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/30 transition-colors">
                  <Checkbox
                    checked={recomputeGenerations}
                    onCheckedChange={(v) => setRecomputeGenerations(Boolean(v))}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium leading-tight">Recompute generation numbers</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Overwrite Excel generation values by recomputing from the tree structure.
                      Leave unchecked to preserve imported values.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 border-t pt-5">
            <Button variant="outline" onClick={cancelImport} className="gap-2 sm:w-auto w-full">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              onClick={runAnalysis}
              disabled={isAnalysing || !Object.values(mapping).includes("fullName")}
              className="gap-2 sm:w-auto w-full"
            >
              {isAnalysing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analysing…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Analyse {rows.length} Row{rows.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── Step 3: Validation preview ── */}
      {step === "preview" && analysis && (
        <div className="space-y-5 animate-in fade-in zoom-in-95">
          {/* Stats grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Import Preview — Dry Run
              </CardTitle>
              <CardDescription>
                Review what will happen before committing. Nothing has been saved yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Row counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={<Users className="w-4 h-4" />} label="Total rows" value={analysis.stats.totalRows} />
                <StatCard icon={<CheckCircle2 className="w-4 h-4 text-green-600" />} label="Valid rows" value={analysis.stats.validRows} color="green" />
                <StatCard icon={<Copy className="w-4 h-4 text-yellow-600" />} label="Dupes in file" value={analysis.stats.duplicatesInFile} color={analysis.stats.duplicatesInFile > 0 ? "yellow" : undefined} />
                <StatCard icon={<Info className="w-4 h-4 text-muted-foreground" />} label="Isolated nodes" value={analysis.stats.isolatedNodes} color={analysis.stats.isolatedNodes > 0 ? "yellow" : undefined} />
              </div>

              {/* Import action counts */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                <StatCard icon={<CheckCircle2 className="w-4 h-4 text-green-600" />} label="Will be added" value={analysis.stats.newMembers} color="green" />
                <StatCard icon={<RefreshCw className="w-4 h-4 text-blue-600" />} label="Will be updated" value={analysis.stats.updatedMembers} color="blue" />
                <StatCard icon={<SkipForward className="w-4 h-4 text-muted-foreground" />} label="Will be skipped" value={analysis.stats.skippedMembers} />
              </div>

              {/* Relationship resolution breakdown */}
              <div className="mt-3 rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2 bg-muted/40 border-b border-border">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relationship Resolution</p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border">
                  <div className="flex flex-col items-center gap-0.5 py-3 px-2">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
                      <Link2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">By ID</span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">{analysis.stats.resolvedByID}</p>
                    <p className="text-[10px] text-muted-foreground">Excel / store IDs</p>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 py-3 px-2">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                      <GitFork className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">By Name</span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{analysis.stats.resolvedByName}</p>
                    <p className="text-[10px] text-muted-foreground">fuzzy name fallback</p>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 py-3 px-2">
                    <div className={`flex items-center gap-1.5 mb-1 ${analysis.stats.unresolvedCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">Unresolved</span>
                    </div>
                    <p className={`text-2xl font-bold tabular-nums ${analysis.stats.unresolvedCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>{analysis.stats.unresolvedCount}</p>
                    <p className="text-[10px] text-muted-foreground">not found anywhere</p>
                  </div>
                </div>
              </div>

              {analysis.stats.unresolvedCount > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-sm">
                  <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                  <p className="text-orange-800 dark:text-orange-200">
                    <strong>{analysis.stats.unresolvedCount}</strong> relationship{analysis.stats.unresolvedCount !== 1 ? "s" : ""} could not be resolved.
                    Check that Father ID / Mother ID / Spouse ID values exist in this file or the current directory.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warnings */}
          {analysis.warnings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  Warnings & Notes
                  <Badge variant="secondary" className="ml-auto">{analysis.warnings.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-y-auto max-h-[300px] divide-y divide-border">
                  {analysis.warnings.map((w, i) => {
                    const meta = warnMeta(w.type);
                    return (
                      <div key={i} className="flex items-start gap-3 px-5 py-3">
                        <span className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>
                              {meta.label}
                            </span>
                            <span className="text-sm font-medium truncate">{w.memberName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{w.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {analysis.warnings.length === 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">No issues found</p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  All relationships resolved cleanly. The import looks ready to go.
                </p>
              </div>
            </div>
          )}

          {/* Options reminder */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1.5">
              Duplicates: {duplicateMode === "skip" ? "Skip" : "Overwrite"}
            </Badge>
            {recomputeGenerations && (
              <Badge variant="outline" className="gap-1.5 border-blue-400 text-blue-700 dark:text-blue-300">
                <RefreshCw className="w-3 h-3" /> Recomputing generations
              </Badge>
            )}
            {replaceAll && (
              <Badge variant="destructive" className="gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Replace all existing data
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setStep("mapping")} className="gap-2 sm:w-auto w-full" disabled={isImporting}>
              <ChevronLeft className="w-4 h-4" /> Back to Mapping
            </Button>
            <Button
              onClick={executeImport}
              disabled={isImporting || analysis.stats.validRows === 0}
              className="gap-2 sm:ml-auto sm:w-auto w-full"
            >
              {isImporting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Importing…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Execute Import ({analysis.stats.newMembers + analysis.stats.updatedMembers} changes)</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: "green" | "blue" | "yellow" | "red";
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorMap: Record<string, string> = {
    green: "text-green-700 dark:text-green-400",
    blue: "text-blue-700 dark:text-blue-400",
    yellow: "text-yellow-700 dark:text-yellow-400",
    red: "text-red-700 dark:text-red-400",
  };
  const colorClass = (color ? colorMap[color] : undefined) ?? "text-foreground";

  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <p className={`text-2xl font-bold tabular-nums ${colorClass}`}>{value}</p>
    </div>
  );
}
