import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, Network, BarChart2, GitMerge,
  Settings, FileSpreadsheet, PlusCircle, Shield,
  Copy, Clock, Hash, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { FamilyMember } from "@/types/family";

const RECENT_KEY = "gkshah_recent_searches";
const MAX_RECENT = 6;

interface QuickAction {
  label: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Dashboard",             icon: LayoutDashboard, path: "/" },
  { label: "Members Directory",     icon: Users,           path: "/members" },
  { label: "Family Tree",           icon: Network,         path: "/family-tree" },
  { label: "Relationship Explorer", icon: GitMerge,        path: "/relationships" },
  { label: "Statistics & Insights", icon: BarChart2,       path: "/statistics" },
  { label: "Import Members",        icon: FileSpreadsheet, path: "/import" },
  { label: "Settings",              icon: Settings,        path: "/settings" },
  { label: "Add New Member",        icon: PlusCircle,      path: "/members/new", adminOnly: true },
  { label: "Data Health",           icon: Shield,          path: "/data-health", adminOnly: true },
];

// ─── Simple scoring for fuzzy match ──────────────────────────────────────────

function matchScore(m: FamilyMember, q: string): number {
  const lq = q.toLowerCase();
  let score = 0;
  if (m.fullName.toLowerCase().startsWith(lq)) score += 10;
  else if (m.fullName.toLowerCase().includes(lq)) score += 6;
  if (m.city?.toLowerCase().includes(lq)) score += 3;
  if (m.profession?.toLowerCase().includes(lq)) score += 2;
  if (m.mainFamilyBranch?.toLowerCase().includes(lq)) score += 2;
  if (m.memberId?.toLowerCase().includes(lq)) score += 4;
  if (m.company?.toLowerCase().includes(lq)) score += 1;
  return score;
}

// ─── Highlight matching text ──────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-sm px-0 font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const { members } = useFamilyStore();
  const { isAdmin } = useAdminMode();

  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
    catch { return []; }
  });

  // Cmd+K / Ctrl+K global listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Reset query when palette closes
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const addRecent = useCallback((label: string) => {
    setRecent(prev => {
      const next = [label, ...prev.filter(r => r !== label)].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const go = useCallback((path: string, label?: string) => {
    setOpen(false);
    setLocation(path);
    if (label) addRecent(label);
  }, [setLocation, addRecent]);

  const copyMemberId = useCallback((memberId: string, name: string) => {
    navigator.clipboard?.writeText(memberId).catch(() => {});
    toast.success(`Copied ${memberId} (${name})`);
    setOpen(false);
  }, []);

  // Filtered + ranked members
  const filteredMembers = useMemo(() => {
    if (!query.trim()) {
      // No query: show recent matches first, then first 8 alphabetically
      const recentMembers = recent
        .map(r => members.find(m => m.fullName === r))
        .filter((m): m is FamilyMember => !!m)
        .slice(0, 4);
      const recentIds = new Set(recentMembers.map(m => m.id));
      const rest = members.filter(m => !recentIds.has(m.id)).slice(0, 6);
      return [...recentMembers, ...rest];
    }
    return members
      .map(m => ({ m, score: matchScore(m, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(({ m }) => m);
  }, [members, query, recent]);

  const visibleActions = QUICK_ACTIONS.filter(a => {
    if (a.adminOnly && !isAdmin) return false;
    if (!query.trim()) return true;
    return a.label.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search members, navigate pages…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[440px]">
          <CommandEmpty>
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-foreground">No results for "{query}"</p>
              <p className="text-xs text-muted-foreground mt-1">Try searching by name, city, profession, or Member ID</p>
            </div>
          </CommandEmpty>

          {/* Navigation */}
          {visibleActions.length > 0 && (
            <CommandGroup heading="Navigation">
              {visibleActions.map(a => (
                <CommandItem
                  key={a.path}
                  value={a.label}
                  onSelect={() => go(a.path, a.label)}
                >
                  <a.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Highlight text={a.label} query={query} />
                  <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {visibleActions.length > 0 && filteredMembers.length > 0 && (
            <CommandSeparator />
          )}

          {/* Members */}
          {filteredMembers.length > 0 && (
            <CommandGroup heading={query ? `Members (${filteredMembers.length} match${filteredMembers.length !== 1 ? "es" : ""})` : "Members"}>
              {filteredMembers.map(m => (
                <CommandItem
                  key={m.id}
                  value={`${m.fullName} ${m.city ?? ""} ${m.profession ?? ""} ${m.memberId ?? ""} ${m.mainFamilyBranch ?? ""}`}
                  onSelect={() => go(`/members/${m.id}`, m.fullName)}
                  className="flex items-center gap-2.5 group"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-serif font-bold shrink-0 overflow-hidden">
                    {m.photo ? (
                      <img src={m.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      m.fullName.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      <Highlight text={m.fullName} query={query} />
                    </div>
                    {(m.city || m.generation) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[m.generation, m.city].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {m.memberId && (
                      <button
                        className="hidden group-data-[selected=true]:flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded border border-border hover:border-primary transition-colors"
                        onClick={e => { e.stopPropagation(); copyMemberId(m.memberId!, m.fullName); }}
                        title="Copy Member ID"
                      >
                        <Hash className="w-2.5 h-2.5" />
                        {m.memberId}
                      </button>
                    )}
                    <button
                      className="hidden group-data-[selected=true]:flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded border border-border hover:border-primary transition-colors whitespace-nowrap"
                      onClick={e => { e.stopPropagation(); go(`/relationships?from=${m.id}`, `Relationship: ${m.fullName}`); }}
                      title="Find relationship"
                    >
                      <GitMerge className="w-2.5 h-2.5" />
                      Relate
                    </button>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Recent searches (when no query) */}
          {!query && recent.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Recent">
                {recent.map((r) => {
                  const member = members.find(m => m.fullName === r);
                  const action = QUICK_ACTIONS.find(a => a.label === r);
                  if (!member && !action) return null;
                  return (
                    <CommandItem
                      key={r}
                      value={`recent:${r}`}
                      onSelect={() => member ? go(`/members/${member.id}`, r) : action ? go(action.path, r) : undefined}
                    >
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{r}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>

        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="font-mono bg-background border border-border rounded px-1">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="font-mono bg-background border border-border rounded px-1">↵</kbd> open</span>
            <span className="flex items-center gap-1"><kbd className="font-mono bg-background border border-border rounded px-1">esc</kbd> close</span>
          </div>
          <CommandShortcut className="text-[10px]">
            {members.length} members
          </CommandShortcut>
        </div>
      </CommandDialog>
    </>
  );
}
