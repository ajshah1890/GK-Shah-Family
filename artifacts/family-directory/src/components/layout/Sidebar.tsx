import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Settings, Network, FileSpreadsheet,
  Lock, GitMerge, BarChart2, Shield, Search, Camera, Database, Info, CalendarDays,
  UserCircle2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminMode } from "@/hooks/useAdminMode";
import { useCurrentMember } from "@/contexts/CurrentMemberContext";
import { MemberAvatar } from "@/components/ProfileSelectModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

const navItems = [
  { name: "Dashboard",     href: "/",              icon: LayoutDashboard },
  { name: "Members",       href: "/members",        icon: Users },
  { name: "Events",        href: "/events",         icon: CalendarDays },
  { name: "Moments",       href: "/moments",        icon: Camera },
  { name: "Family Tree",   href: "/family-tree",    icon: Network },
  { name: "Relationships", href: "/relationships",  icon: GitMerge },
  { name: "Statistics",    href: "/statistics",     icon: BarChart2 },
  { name: "Import",        href: "/import",         icon: FileSpreadsheet },
  { name: "About",         href: "/about",          icon: Info },
  { name: "Settings",      href: "/settings",       icon: Settings },
];

const adminNavItems = [
  { name: "Data Health",    href: "/data-health",    icon: Shield },
  { name: "Debug Storage",  href: "/debug-storage",  icon: Database },
];

export function Sidebar() {
  const [location] = useLocation();
  const { isAdmin, login, logout } = useAdminMode();
  const { currentMember, isGuest, openProfileSelector } = useCurrentMember();
  const [password, setPassword] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

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
    const e = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
    document.dispatchEvent(e);
  };

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3 border-b border-border">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-xl shrink-0">
          S
        </div>
        <h1 className="font-serif font-bold text-lg leading-tight">
          G K Shah <br /> Directory
        </h1>
      </div>

      {/* Global search hint */}
      <div className="px-4 pt-3 pb-1">
        <button
          onClick={openPalette}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-muted/60 hover:bg-muted border border-border text-xs text-muted-foreground transition-colors group"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <span className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <kbd className="font-mono bg-background border border-border rounded px-1 text-[9px]">⌘</kbd>
            <kbd className="font-mono bg-background border border-border rounded px-1 text-[9px]">K</kbd>
          </span>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors text-sm",
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
            <div className="pt-3 pb-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-4">Admin</p>
            </div>
            {adminNavItems.map((item) => {
              const isActive = location === item.href || location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors text-sm",
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

      {/* ── Profile chip ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border">
        <button
          onClick={openProfileSelector}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sidebar-accent transition-colors text-left group"
        >
          {currentMember ? (
            <MemberAvatar member={currentMember} size="sm" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <UserCircle2 className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight">
              {currentMember ? currentMember.fullName : "Guest"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {currentMember
                ? [currentMember.generation, currentMember.city].filter(Boolean).join(" · ") || "Switch profile"
                : "Select your profile"}
            </p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* ── Admin login / logout ──────────────────────────────────────────────── */}
      <div className="px-4 pb-4 border-t border-border pt-3">
        {isAdmin ? (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-primary font-medium">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Admin Mode ON
            </div>
            <Button variant="ghost" size="sm" onClick={() => { logout(); toast.info("Admin mode disabled"); }}>
              Logout
            </Button>
          </div>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm">
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
                  onChange={e => setPassword(e.target.value)}
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
    </aside>
  );
}
