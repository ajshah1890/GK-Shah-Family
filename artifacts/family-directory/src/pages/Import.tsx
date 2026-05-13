import { useState, useRef } from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileSpreadsheet, Upload, Download,
  ArrowRight, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { FamilyMember } from "@/types/family";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { MEMBER_SCHEMA, IMPORT_ALIAS_MAP, EXPORT_COLUMNS } from "@/lib/memberSchema";

// ─── helpers ─────────────────────────────────────────────────────────────────

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
    } else if (val !== undefined && val !== null && val !== "") {
      row[label] = val;
    } else {
      row[label] = "";
    }
  }
  return row;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Import() {
  const { members, importMembers } = useFamilyStore();
  const { isAdmin } = useAdminMode();

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [fileName, setFileName] = useState("");
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update">("skip");

  const csvFileRef = useRef<HTMLInputElement>(null);
  const excelFileRef = useRef<HTMLInputElement>(null);

  const processFile = (rawHeaders: string[], rawRows: unknown[][]) => {
    setHeaders(rawHeaders);
    setMapping(autoMap(rawHeaders));
    setRows(rawRows);
    setStep(2);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length < 2) { toast.error("File is empty"); return; }
        processFile(data[0], data.slice(1));
      },
      error: (err) => toast.error(`CSV parse error: ${err.message}`),
    });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
        if (data.length < 2) { toast.error("File is empty"); return; }
        processFile(data[0] as string[], data.slice(1) as unknown[][]);
      } catch {
        toast.error("Could not read Excel file");
      }
    };
    reader.readAsBinaryString(file);
  };

  const cancelImport = () => {
    setStep(1); setHeaders([]); setRows([]); setMapping({}); setFileName("");
    if (csvFileRef.current) csvFileRef.current.value = "";
    if (excelFileRef.current) excelFileRef.current.value = "";
  };

  const executeImport = () => {
    const nameField = Object.values(mapping).find(v => v === "fullName");
    if (!nameField) {
      toast.error("Map at least one column to 'Full Name'");
      return;
    }

    const existingByName = new Map(members.map(m => [m.fullName.toLowerCase(), m]));
    const toAdd: FamilyMember[] = [];
    const toUpdate: FamilyMember[] = [];
    const seenNames = new Set<string>();

    rows.forEach(row => {
      const arr = row as unknown[];
      const data: Record<string, unknown> = { id: crypto.randomUUID(), addedAt: new Date().toISOString() };
      headers.forEach((h, i) => {
        const field = mapping[h];
        if (!field || arr[i] === undefined || arr[i] === "") return;
        if (field === "childrenNames") {
          data[field] = String(arr[i]).split(",").map(s => s.trim()).filter(Boolean);
        } else if (field === "generationNumber" || field === "siblingOrder") {
          data[field] = Number(arr[i]) || undefined;
        } else {
          data[field] = String(arr[i]).trim();
        }
      });

      if (!data.fullName) return;
      const nameLower = String(data.fullName).toLowerCase();
      if (seenNames.has(nameLower)) return;
      seenNames.add(nameLower);

      const existing = existingByName.get(nameLower);
      if (existing) {
        if (duplicateMode === "update") {
          toUpdate.push({ ...existing, ...data, id: existing.id, addedAt: existing.addedAt } as unknown as FamilyMember);
        }
        // else skip
      } else {
        toAdd.push(data as unknown as FamilyMember);
      }
    });

    const merged = members.map(m => {
      const updated = toUpdate.find(u => u.id === m.id);
      return updated ?? m;
    });

    importMembers([...merged, ...toAdd]);

    const parts = [];
    if (toAdd.length > 0) parts.push(`${toAdd.length} added`);
    if (toUpdate.length > 0) parts.push(`${toUpdate.length} updated`);
    const skippedCount = rows.filter(r => {
      const arr = r as unknown[];
      const idx = headers.indexOf(Object.keys(mapping).find(k => mapping[k] === "fullName") ?? "");
      return idx >= 0 && arr[idx] && existingByName.has(String(arr[idx]).toLowerCase()) && duplicateMode === "skip";
    }).length;
    if (skippedCount > 0) parts.push(`${skippedCount} skipped`);

    toast.success(`Import complete: ${parts.join(", ") || "nothing changed"}`);
    cancelImport();
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

    // Auto column widths (rough)
    const colWidths = EXPORT_COLUMNS.map(({ label }) => ({
      wch: Math.max(label.length + 2, 14),
    }));
    ws["!cols"] = colWidths;

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

  // ── UI ──────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Data Import & Export</h1>
        <p className="text-muted-foreground mt-1">
          Bulk manage family directory data. Export includes all {EXPORT_COLUMNS.length} fields.
        </p>
      </div>

      {step === 1 ? (
        <Tabs defaultValue="excel" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="excel">Import Excel</TabsTrigger>
            <TabsTrigger value="csv">Import CSV</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          {/* ── Excel import ── */}
          <TabsContent value="excel" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Import from Excel (.xlsx)</CardTitle>
                <CardDescription>
                  First row must be column headers. Columns are auto-matched to member fields.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-xl m-6 bg-muted/20">
                <FileSpreadsheet className="w-12 h-12 text-green-600 mb-4 opacity-60" />
                <h3 className="text-lg font-medium mb-2">Choose an Excel file</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  Use the exported template for guaranteed column matching.
                </p>
                <input
                  type="file" accept=".xlsx,.xls" className="hidden"
                  ref={excelFileRef} onChange={handleExcelUpload}
                />
                <Button
                  onClick={() => excelFileRef.current?.click()}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Upload className="w-4 h-4" /> Choose Excel File
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CSV import ── */}
          <TabsContent value="csv" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Import from CSV</CardTitle>
                <CardDescription>
                  First row must be column headers. Columns are auto-matched to member fields.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-xl m-6 bg-muted/20">
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Choose a CSV file</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  UTF-8 encoded, comma-separated. First row = headers.
                </p>
                <input
                  type="file" accept=".csv" className="hidden"
                  ref={csvFileRef} onChange={handleCSVUpload}
                />
                <Button onClick={() => csvFileRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" /> Choose CSV File
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Export ── */}
          <TabsContent value="export" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Export Directory Data</CardTitle>
                <CardDescription>
                  Downloads all {members.length} members with {EXPORT_COLUMNS.length} fields each.
                  Photos are excluded (too large for spreadsheets). Relationship IDs are included.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={exportExcel}
                    variant="outline"
                    className="flex-1 py-8 h-auto gap-3 flex-col text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-900 dark:hover:bg-green-950"
                  >
                    <Download className="w-6 h-6" />
                    <span>Download as Excel</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Best for editing & re-importing
                    </span>
                  </Button>
                  <Button
                    onClick={exportCSV}
                    variant="outline"
                    className="flex-1 py-8 h-auto gap-3 flex-col"
                  >
                    <Download className="w-6 h-6" />
                    <span>Download as CSV</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Best for sharing / backup
                    </span>
                  </Button>
                </div>

                {/* Column reference */}
                <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Exported columns ({EXPORT_COLUMNS.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {EXPORT_COLUMNS.map(c => (
                      <span
                        key={c.key}
                        className="text-[10px] bg-card border border-border rounded px-1.5 py-0.5 text-muted-foreground"
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        /* ── Column mapping step ── */
        <Card className="animate-in fade-in zoom-in-95">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-serif">Map Columns</CardTitle>
                <CardDescription>
                  {fileName} · {rows.length} rows ·{" "}
                  {Object.values(mapping).filter(Boolean).length} of {headers.length} columns auto-matched
                </CardDescription>
              </div>
              <Button variant="ghost" onClick={cancelImport}>Cancel</Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Mapping grid */}
            <div className="bg-muted/30 p-4 rounded-lg border border-border">
              <h4 className="font-medium mb-4 flex items-center gap-2 text-sm">
                <ArrowRight className="w-4 h-4 text-primary" />
                Match your file's columns to member fields
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <SelectContent>
                        <SelectItem value="skip" className="text-muted-foreground italic">
                          Skip this column
                        </SelectItem>
                        {MEMBER_SCHEMA.map(f => (
                          <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <h4 className="font-medium mb-3 text-sm">Preview (first 3 rows)</h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={i} className="whitespace-nowrap">
                          <div className="font-bold text-foreground text-xs">{h}</div>
                          <div className="text-[10px] text-primary font-medium mt-0.5">
                            {mapping[h]
                              ? `→ ${MEMBER_SCHEMA.find(f => f.key === mapping[h])?.label ?? mapping[h]}`
                              : <span className="text-muted-foreground italic">skipped</span>
                            }
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
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 border-t pt-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Duplicates:</span>
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                <button
                  onClick={() => setDuplicateMode("skip")}
                  className={[
                    "px-3 py-1.5 transition-colors",
                    duplicateMode === "skip"
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  Skip
                </button>
                <button
                  onClick={() => setDuplicateMode("update")}
                  className={[
                    "px-3 py-1.5 transition-colors",
                    duplicateMode === "update"
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  Overwrite
                </button>
              </div>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {duplicateMode === "skip" ? "Existing members are preserved" : "Existing members will be overwritten"}
              </span>
            </div>
            <Button onClick={executeImport} className="gap-2 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              Import {rows.length} Member{rows.length !== 1 ? "s" : ""}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
