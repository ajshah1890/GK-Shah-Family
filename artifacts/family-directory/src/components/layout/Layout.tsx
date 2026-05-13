import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "@/components/CommandPalette";
import { Search } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-[100dvh] w-full bg-background text-foreground">
      <CommandPalette />
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pb-[72px] md:pb-0 relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center gap-3 p-4 border-b border-border bg-card sticky top-0 z-40">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-sm">
            S
          </div>
          <h1 className="font-serif font-bold text-lg flex-1">G K Shah Directory</h1>
          <MobileSearchButton />
        </div>
        
        <div className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

function MobileSearchButton() {
  return (
    <button
      className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      onClick={() => {
        const e = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
        document.dispatchEvent(e);
      }}
      aria-label="Open search"
    >
      <Search className="w-4 h-4" />
    </button>
  );
}
