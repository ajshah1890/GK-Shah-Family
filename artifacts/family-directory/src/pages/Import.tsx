import { useState, useRef } from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Upload, Download, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { FamilyMember } from "@/types/family";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// Mapping hints
const MAPPING_HINTS: Record<string, keyof FamilyMember> = {
  'full name': 'fullName',
  'fullname': 'fullName',
  'name': 'fullName',
  'first name': 'fullName',
  'photo': 'photo',
  'photo url': 'photo',
  'gender': 'gender',
  'generation': 'generation',
  'birthday': 'birthday',
  'date of birth': 'birthday',
  'dob': 'birthday',
  'anniversary': 'anniversary',
  'wedding date': 'anniversary',
  'address': 'address',
  'maps link': 'mapsLink',
  'google maps': 'mapsLink',
  'city': 'city',
  'country': 'country',
  'native place': 'nativePlace',
  'native': 'nativePlace',
  'hometown': 'nativePlace',
  'phone': 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'whatsapp': 'whatsapp',
  'whatsapp number': 'whatsapp',
  'email': 'email',
  'website': 'personalWebsite',
  'personal website': 'personalWebsite',
  'linkedin': 'linkedIn',
  'instagram': 'instagram',
  'profession': 'profession',
  'job': 'profession',
  'occupation': 'profession',
  'company': 'company',
  'current company': 'company',
  'previous company': 'previousCompany',
  'business name': 'businessName',
  'education': 'education',
  'blood group': 'bloodGroup',
  'blood': 'bloodGroup',
  'main branch': 'mainFamilyBranch',
  'main family branch': 'mainFamilyBranch',
  'sub branch': 'subFamilyBranch',
  'sub family branch': 'subFamilyBranch',
  'spouse': 'spouseName',
  'spouse name': 'spouseName',
  'children': 'childrenNames',
  'children names': 'childrenNames',
  'hobbies': 'hobbies',
  'skills': 'skills',
  'languages': 'languagesSpoken',
  'languages spoken': 'languagesSpoken',
  'emergency contact': 'emergencyContact',
  'notes': 'notes'
};

const FAMILY_MEMBER_FIELDS: { key: keyof FamilyMember, label: string }[] = [
  { key: 'fullName', label: 'Full Name (Required)' },
  { key: 'gender', label: 'Gender' },
  { key: 'generation', label: 'Generation' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'anniversary', label: 'Anniversary' },
  { key: 'phone', label: 'Phone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'nativePlace', label: 'Native Place' },
  { key: 'address', label: 'Address' },
  { key: 'mapsLink', label: 'Maps Link' },
  { key: 'mainFamilyBranch', label: 'Main Branch' },
  { key: 'subFamilyBranch', label: 'Sub Branch' },
  { key: 'spouseName', label: 'Spouse Name' },
  { key: 'childrenNames', label: 'Children (Comma separated)' },
  { key: 'profession', label: 'Profession' },
  { key: 'company', label: 'Company' },
  { key: 'businessName', label: 'Business Name' },
  { key: 'education', label: 'Education' },
  { key: 'bloodGroup', label: 'Blood Group' },
  { key: 'hobbies', label: 'Hobbies' },
  { key: 'skills', label: 'Skills' },
  { key: 'notes', label: 'Notes' },
];

export default function Import() {
  const { members, importMembers } = useFamilyStore();
  const { isAdmin } = useAdminMode();
  
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [fileName, setFileName] = useState("");
  
  const csvFileRef = useRef<HTMLInputElement>(null);
  const excelFileRef = useRef<HTMLInputElement>(null);

  const processHeaders = (rawHeaders: string[]) => {
    const initialMapping: Record<string, string> = {};
    rawHeaders.forEach(h => {
      const lowerH = h.toLowerCase().trim();
      const match = MAPPING_HINTS[lowerH];
      if (match) {
        initialMapping[h] = match;
      }
    });
    setHeaders(rawHeaders);
    setMapping(initialMapping);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const rawHeaders = results.data[0] as string[];
          const rawRows = results.data.slice(1) as any[][];
          processHeaders(rawHeaders);
          setRows(rawRows);
          setStep(2);
        } else {
          toast.error("File appears to be empty");
        }
      },
      error: (error) => {
        toast.error(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (data.length > 0) {
          const rawHeaders = data[0] as string[];
          const rawRows = data.slice(1);
          processHeaders(rawHeaders);
          setRows(rawRows);
          setStep(2);
        } else {
          toast.error("File appears to be empty");
        }
      } catch (err) {
        toast.error("Error parsing Excel file");
      }
    };
    reader.readAsBinaryString(file);
  };

  const executeImport = () => {
    // Need at least fullName mapped
    if (!Object.values(mapping).includes('fullName')) {
      toast.error("You must map at least one column to 'Full Name'");
      return;
    }

    const newMembersList: FamilyMember[] = [];
    const existingMembers = [...members];
    let addedCount = 0;
    let skippedCount = 0;

    rows.forEach(row => {
      const memberData: any = {
        id: crypto.randomUUID(),
        addedAt: new Date().toISOString()
      };

      let hasName = false;

      headers.forEach((header, index) => {
        const mappedField = mapping[header];
        if (mappedField && row[index] !== undefined && row[index] !== "") {
          if (mappedField === 'fullName') hasName = true;
          
          if (mappedField === 'childrenNames') {
            memberData[mappedField] = String(row[index]).split(',').map(s => s.trim()).filter(Boolean);
          } else {
            memberData[mappedField] = String(row[index]).trim();
          }
        }
      });

      if (hasName) {
        // Check if member already exists
        const exists = existingMembers.some(m => m.fullName.toLowerCase() === memberData.fullName.toLowerCase());
        if (exists) {
          skippedCount++;
        } else {
          newMembersList.push(memberData as FamilyMember);
          addedCount++;
        }
      }
    });

    if (newMembersList.length > 0) {
      importMembers([...existingMembers, ...newMembersList]);
    }

    toast.success(`Import complete! Added ${addedCount} members. Skipped ${skippedCount} duplicates.`);
    setStep(1);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setFileName("");
    if (csvFileRef.current) csvFileRef.current.value = '';
    if (excelFileRef.current) excelFileRef.current.value = '';
  };

  const cancelImport = () => {
    setStep(1);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setFileName("");
    if (csvFileRef.current) csvFileRef.current.value = '';
    if (excelFileRef.current) excelFileRef.current.value = '';
  };

  const exportCSV = () => {
    const formattedData = members.map(m => ({
      ...m,
      childrenNames: m.childrenNames ? m.childrenNames.join(', ') : ''
    }));
    const csv = Papa.unparse(formattedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gkshah-directory-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success("Exported to CSV");
  };

  const exportExcel = () => {
    const formattedData = members.map(m => ({
      ...m,
      childrenNames: m.childrenNames ? m.childrenNames.join(', ') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Directory");
    XLSX.writeFile(wb, `gkshah-directory-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Exported to Excel");
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4">
        <h2 className="text-2xl font-bold font-serif mb-4">Access Denied</h2>
        <p className="text-muted-foreground">You need admin access to import or export member data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Data Import & Export</h1>
        <p className="text-muted-foreground mt-1">Bulk manage family directory data.</p>
      </div>

      {step === 1 ? (
        <Tabs defaultValue="csv" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="csv">Import CSV</TabsTrigger>
            <TabsTrigger value="excel">Import Excel</TabsTrigger>
            <TabsTrigger value="export">Export Data</TabsTrigger>
          </TabsList>
          
          <TabsContent value="csv" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Import from CSV</CardTitle>
                <CardDescription>Upload a comma-separated values file to import multiple members at once.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-xl m-6 bg-muted/20">
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select a CSV File</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  The first row should contain your column headers. We'll help you map them in the next step.
                </p>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={csvFileRef} 
                  onChange={handleCSVUpload} 
                />
                <Button onClick={() => csvFileRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Choose CSV File
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="excel" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Import from Excel</CardTitle>
                <CardDescription>Upload an .xlsx file. Only the first sheet will be imported.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-xl m-6 bg-muted/20">
                <FileSpreadsheet className="w-12 h-12 text-green-600 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select an Excel File</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  The first row should contain your column headers. We'll help you map them in the next step.
                </p>
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                  ref={excelFileRef} 
                  onChange={handleExcelUpload} 
                />
                <Button onClick={() => excelFileRef.current?.click()} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <Upload className="w-4 h-4" />
                  Choose Excel File
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Export Directory Data</CardTitle>
                <CardDescription>Download your entire family directory to use in other spreadsheet programs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button onClick={exportCSV} variant="outline" className="flex-1 py-8 h-auto gap-3 flex-col">
                    <Download className="w-6 h-6" />
                    <span>Download as CSV</span>
                  </Button>
                  <Button onClick={exportExcel} variant="outline" className="flex-1 py-8 h-auto gap-3 flex-col text-green-600 border-green-200 hover:bg-green-50">
                    <Download className="w-6 h-6" />
                    <span>Download as Excel</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="animate-in fade-in zoom-in-95">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-serif">Map Columns</CardTitle>
                <CardDescription>File: {fileName} • {rows.length} records found</CardDescription>
              </div>
              <Button variant="ghost" onClick={cancelImport}>Cancel</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="bg-muted/30 p-4 rounded-lg border border-border">
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
                Match your file's columns to the directory fields
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {headers.map((header) => (
                  <div key={header} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium truncate" title={header}>{header}</label>
                    <Select 
                      value={mapping[header] || "skip"} 
                      onValueChange={(val) => {
                        setMapping(prev => ({
                          ...prev,
                          [header]: val === "skip" ? "" : val
                        }));
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Skip column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip" className="text-muted-foreground italic">Skip this column</SelectItem>
                        {FAMILY_MEMBER_FIELDS.map(f => (
                          <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Data Preview (First 3 rows)</h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((header, i) => (
                        <TableHead key={i} className="whitespace-nowrap">
                          <div>
                            <div className="font-bold text-foreground">{header}</div>
                            <div className="text-xs text-primary font-medium mt-1">
                              {mapping[header] ? `→ ${mapping[header]}` : <span className="text-muted-foreground italic">Skipped</span>}
                            </div>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 3).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {headers.map((_, colIndex) => (
                          <TableCell key={colIndex} className="max-w-[150px] truncate text-muted-foreground">
                            {row[colIndex] || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              Existing members with the exact same name will be skipped.
            </p>
            <Button onClick={executeImport} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Import {rows.length} Members
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
