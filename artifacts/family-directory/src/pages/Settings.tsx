import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useTheme } from "@/hooks/useTheme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Download, Upload, Info } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

export default function Settings() {
  const { members, importMembers } = useFamilyStore();
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = () => {
    if (theme === "dark") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(members, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `gkshah-family-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
    
    toast.success("Family data exported successfully");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          importMembers(importedData);
          toast.success("Family data imported successfully");
        } else {
          toast.error("Invalid file format. Expected an array of family members.");
        }
      } catch (error) {
        toast.error("Failed to parse the file. Ensure it's a valid JSON.");
      }
      
      // Reset input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage app preferences and data.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Appearance</CardTitle>
          <CardDescription>Customize how the app looks on your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark themes.
              </p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Data Management</CardTitle>
          <CardDescription>Export your family data for backup, or import from a previous backup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleExport} className="flex-1 gap-2" variant="outline">
              <Download className="w-4 h-4" />
              Export Backup (JSON)
            </Button>
            
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImport} 
            />
            <Button onClick={() => fileInputRef.current?.click()} className="flex-1 gap-2" variant="outline">
              <Upload className="w-4 h-4" />
              Import Backup
            </Button>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg flex gap-3 text-sm text-muted-foreground items-start">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p>
              <strong>Privacy Note:</strong> This app runs entirely in your browser. No data is ever sent to a server. 
              Everything is stored locally on this device using localStorage. Clearing your browser data will delete the directory.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="text-center text-sm text-muted-foreground pt-4">
        <p>G K Shah Family Directory v1.0</p>
        <p>Built with care.</p>
      </div>
    </div>
  );
}
