import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { MobileDrawer } from "./MobileDrawer";
import { CommandPalette } from "@/components/CommandPalette";
import { Menu, Search } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full bg-background text-foreground">
      <CommandPalette />
      <Sidebar />
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex-1 flex flex-col min-w-0 pb-[72px] md:pb-0 relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center gap-2 px-3 py-3 border-b border-border bg-card sticky top-0 z-40">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-xs shrink-0">
              S
            </div>
            <h1 className="font-serif font-bold text-base truncate">G K Shah Directory</h1>
          </div>
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
      className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
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
