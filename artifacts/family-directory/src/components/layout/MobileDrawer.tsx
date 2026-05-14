import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Camera, Network, GitMerge, BarChart2,
  FileSpreadsheet, Settings, Shield, X, Lock, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminMode } from "@/hooks/useAdminMode";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const navItems = [
  { name: "Dashboard",     href: "/",             icon: LayoutDashboard },
  { name: "Members",       href: "/members",       icon: Users },
  { name: "Moments",       href: "/moments",       icon: Camera },
  { name: "Family Tree",   href: "/family-tree",   icon: Network },
  { name: "Relationships", href: "/relationships", icon: GitMerge },
  { name: "Statistics",    href: "/statistics",    icon: BarChart2 },
  { name: "Import",        href: "/import",        icon: FileSpreadsheet },
  { name: "Settings",      href: "/settings",      icon: Settings },
];

const adminNavItems = [
  { name: "Data Health", href: "/data-health", icon: Shield },
];

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const [location] = useLocation();
  const { isAdmin, login, logout } = useAdminMode();
  const [password, setPassword] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    onClose();
  }, [location]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      setDialogOpen(false);
      setPassword("");
      toast.success("Admin mode enabled");
    } else {
      toast.error("Incorrect password");
    }
  };

  const openPalette = () => {
    onClose();
    setTimeout(() => {
      const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
      document.dispatchEvent(ev);
    }, 300);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] md:hidden transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "fixed left-0 top-0 h-full w-[280px] bg-sidebar border-r border-border shadow-2xl",
          "z-[61] md:hidden flex flex-col",
          "transition-transform duration-300 ease-in-out will-change-transform",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-base shrink-0">
            S
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif font-bold text-sm leading-tight truncate">G K Shah</p>
            <p className="text-[10px] text-muted-foreground">Family Directory</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search hint */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <button
            onClick={openPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-muted/60 hover:bg-muted border border-border text-xs text-muted-foreground transition-colors"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <span className="font-mono opacity-50 text-[10px]">⌘K</span>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-3">
                  Admin
                </p>
              </div>
              {adminNavItems.map((item) => {
                const isActive =
                  location === item.href || location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Admin login / logout footer */}
        <div className="px-4 py-4 border-t border-border shrink-0">
          {isAdmin ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1 py-0.5">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs font-semibold text-primary">Admin Mode Active</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground text-xs h-8"
                onClick={() => {
                  logout();
                  toast.info("Admin mode disabled");
                }}
              >
                Sign out of Admin
              </Button>
            </div>
          ) : (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
                >
                  <Lock className="w-4 h-4" />
                  Admin Login
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Admin Login</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleLogin} className="space-y-4 py-4">
                  <Input
                    type="password"
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end">
                    <Button type="submit">Login</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </>
  );
}
