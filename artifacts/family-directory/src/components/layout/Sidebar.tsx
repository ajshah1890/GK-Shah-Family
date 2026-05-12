import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Settings, Network, FileSpreadsheet, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminMode } from "@/hooks/useAdminMode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Family Tree", href: "/family-tree", icon: Network },
  { name: "Import", href: "/import", icon: FileSpreadsheet },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { isAdmin, login, logout } = useAdminMode();
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

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3 border-b border-border">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-xl">
          S
        </div>
        <h1 className="font-serif font-bold text-lg leading-tight">
          G K Shah <br /> Directory
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        {isAdmin ? (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-primary font-medium">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Admin Mode ON
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              logout();
              toast.info("Admin mode disabled");
            }}>
              Logout
            </Button>
          </div>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Lock className="w-4 h-4" />
                Admin Login
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Admin Login</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleLogin} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Input 
                    type="password" 
                    placeholder="Enter admin password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </div>
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
