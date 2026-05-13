import { useState, useMemo } from "react";
import { useMomentsStore } from "@/hooks/useMomentsStore";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import { MomentCard } from "@/components/moments/MomentCard";
import { SlideshowMode } from "@/components/moments/SlideshowMode";
import { EVENT_TYPES, EventType } from "@/types/moments";
import { Moment } from "@/types/moments";
import { FamilyMember } from "@/types/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Camera, Plus, Search, Heart, List, Grid3X3, Play, ChevronDown, ChevronRight, Filter,
} from "lucide-react";
import { useLocation } from "wouter";
import { parseISO, getYear, format } from "date-fns";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "timeline";

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
        <Camera className="w-9 h-9 text-amber-400" />
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-serif font-semibold">No memories yet</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Start building your family archive — every photo tells a story.
        </p>
      </div>
      {isAdmin && (
        <Button onClick={() => setLocation("/moments/new")} className="mt-2">
          <Plus className="w-4 h-4 mr-2" /> Create First Moment
        </Button>
      )}
    </div>
  );
}

function TimelineView({
  moments,
  members,
  onToggleFavorite,
}: {
  moments: Moment[];
  members: FamilyMember[];
  onToggleFavorite: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const byYear = useMemo(() => {
    const map = new Map<number, Moment[]>();
    moments.forEach((m) => {
      try {
        const yr = getYear(parseISO(m.eventDate));
        const list = map.get(yr) ?? [];
        list.push(m);
        map.set(yr, list);
      } catch { /* skip bad dates */ }
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, list]) => ({ year, list: list.sort((a, b) => b.eventDate.localeCompare(a.eventDate)) }));
  }, [moments]);

  const toggle = (year: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {byYear.map(({ year, list }) => {
        const isOpen = expanded.has(year);
        return (
          <div key={year} className="space-y-3">
            <button
              onClick={() => toggle(year)}
              className="flex items-center gap-3 w-full group"
            >
              <div className="flex-1 h-px bg-border group-hover:bg-primary/30 transition-colors" />
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                {year}
                <span className="text-xs text-primary/60 font-normal">{list.length}</span>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 h-px bg-border group-hover:bg-primary/30 transition-colors" />
            </button>

            {isOpen && (
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 pl-4 border-l-2 border-primary/20 ml-2">
                {list.map((m) => (
                  <MomentCard
                    key={m.id}
                    moment={m}
                    members={members}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Moments() {
  const [, setLocation] = useLocation();
  const { activeMoments, isLoaded, toggleFavorite } = useMomentsStore();
  const { members } = useFamilyStore();
  const { isAdmin } = useAdminMode();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [filterEventType, setFilterEventType] = useState<EventType | "all">("all");
  const [filterMemberId, setFilterMemberId] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const branches = useMemo(
    () => Array.from(new Set(members.map((m) => m.mainFamilyBranch).filter(Boolean) as string[])).sort(),
    [members]
  );

  const years = useMemo(() => {
    const ys = new Set<number>();
    activeMoments.forEach((m) => {
      try { ys.add(getYear(parseISO(m.eventDate))); } catch { /* skip */ }
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [activeMoments]);

  const filtered = useMemo(() => {
    let result = activeMoments;
    if (favoritesOnly) result = result.filter((m) => m.favorite);
    if (filterEventType !== "all") result = result.filter((m) => m.eventType === filterEventType);
    if (filterMemberId !== "all") result = result.filter((m) => m.taggedMemberIds.includes(filterMemberId));
    if (filterBranch !== "all") result = result.filter((m) => m.branch === filterBranch);
    if (filterYear !== "all") {
      result = result.filter((m) => {
        try { return String(getYear(parseISO(m.eventDate))) === filterYear; } catch { return false; }
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.caption.toLowerCase().includes(q) ||
          (m.location ?? "").toLowerCase().includes(q) ||
          members
            .filter((mb) => m.taggedMemberIds.includes(mb.id))
            .some((mb) => mb.fullName.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  }, [activeMoments, favoritesOnly, filterEventType, filterMemberId, filterBranch, filterYear, search, members]);

  const activeFilterCount = [
    filterEventType !== "all",
    filterMemberId !== "all",
    filterBranch !== "all",
    filterYear !== "all",
    favoritesOnly,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterEventType("all");
    setFilterMemberId("all");
    setFilterBranch("all");
    setFilterYear("all");
    setFavoritesOnly(false);
    setSearch("");
  };

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="columns-2 lg:columns-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 bg-muted rounded-xl mb-4 break-inside-avoid" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold">Family Moments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeMoments.length} {activeMoments.length === 1 ? "memory" : "memories"} in your family archive
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeMoments.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowSlideshow(true)}>
              <Play className="w-3.5 h-3.5 mr-1.5" /> Slideshow
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" onClick={() => setLocation("/moments/new")}>
              <Plus className="w-4 h-4 mr-1.5" /> Create Moment
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search captions, names, locations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-card"
            />
          </div>
          <div className="flex items-center border border-border rounded-md overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("px-3 py-2 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={cn("px-3 py-2 transition-colors", viewMode === "timeline" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

          <button
            onClick={() => setFavoritesOnly((f) => !f)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors",
              favoritesOnly
                ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <Heart className={cn("w-3 h-3", favoritesOnly && "fill-current")} />
            Favorites
          </button>

          <Select value={filterEventType} onValueChange={(v) => setFilterEventType(v as EventType | "all")}>
            <SelectTrigger className="h-7 text-xs w-auto px-3 border-border">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterMemberId} onValueChange={setFilterMemberId}>
            <SelectTrigger className="h-7 text-xs w-auto px-3 border-border">
              <SelectValue placeholder="Member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {members.filter((m) => m.id?.trim() && !m.isArchived).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {branches.length > 0 && (
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="h-7 text-xs w-auto px-3 border-border">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.filter((b) => b?.trim()).map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {years.length > 0 && (
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="h-7 text-xs w-auto px-3 border-border">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Clear ({activeFilterCount})
            </button>
          )}
        </div>

        {search.trim() || activeFilterCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {activeMoments.length} memories
          </p>
        ) : null}
      </div>

      {activeMoments.length === 0 ? (
        <EmptyState isAdmin={isAdmin} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No memories match your filters</p>
          <button onClick={clearFilters} className="text-sm text-primary hover:underline mt-2">
            Clear all filters
          </button>
        </div>
      ) : viewMode === "timeline" ? (
        <TimelineView moments={filtered} members={members} onToggleFavorite={toggleFavorite} />
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {filtered.map((m) => (
            <MomentCard
              key={m.id}
              moment={m}
              members={members}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}

      {showSlideshow && (
        <SlideshowMode
          moments={filtered.length > 0 ? filtered : activeMoments}
          members={members}
          onClose={() => setShowSlideshow(false)}
        />
      )}
    </div>
  );
}
