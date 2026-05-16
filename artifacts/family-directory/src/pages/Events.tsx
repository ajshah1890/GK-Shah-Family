import { useState, useMemo, useEffect, useCallback } from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useCustomEventsStore } from "@/hooks/useCustomEventsStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import { CustomEvent, getCategoryMeta } from "@/types/customEvent";
import {
  parseDateParts, parseDateFullParts, coupleKey, MONTH_NAMES, MONTH_NAMES_SHORT,
} from "@/lib/eventUtils";
import { CustomEventDialog } from "@/components/events/CustomEventDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Gift, Calendar, CalendarDays, ChevronLeft, ChevronRight,
  Plus, Search, MapPin, Pencil, Trash2, RefreshCw,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type EventFilter = "all" | "birthday" | "anniversary" | "custom";

interface UnifiedEvent {
  key: string;
  type: "birthday" | "anniversary" | "custom";
  day: number;
  month: number;
  year: number | null; // null = recurring / yearly
  label: string;
  sublabel?: string;
  memberId?: string;
  customEvent?: CustomEvent;
}

const FILTER_LABELS: Record<EventFilter, string> = {
  all: "All",
  birthday: "Birthdays",
  anniversary: "Anniversaries",
  custom: "Custom",
};

function parseDateParts2(raw: string) { return parseDateParts(raw); }

export default function Events() {
  const [location] = useLocation();
  const { members } = useFamilyStore();
  const { events: customEvents, load, isLoaded, deleteEvent } = useCustomEventsStore();
  const { isAdmin } = useAdminMode();

  const today = new Date();
  const initialMonth = (() => {
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    const m = parseInt(params.get("month") ?? "", 10);
    return isNaN(m) ? today.getMonth() : m;
  })();

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear]   = useState(today.getFullYear());
  const [filter, setFilter]               = useState<EventFilter>("all");
  const [search, setSearch]               = useState("");
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editEvent, setEditEvent]         = useState<CustomEvent | undefined>(undefined);

  useEffect(() => { load(); }, [load]);

  const prevMonth = useCallback(() => {
    setSelectedMonth(m => {
      if (m === 0) { setSelectedYear(y => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setSelectedMonth(m => {
      if (m === 11) { setSelectedYear(y => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // Build the unified list for the selected month/year
  const allItems = useMemo<UnifiedEvent[]>(() => {
    const result: UnifiedEvent[] = [];
    const seenAnniversaries = new Set<string>();

    // Birthdays
    for (const m of members) {
      if (!m.birthday) continue;
      const p = parseDateParts2(m.birthday);
      if (!p || p.month !== selectedMonth) continue;
      result.push({
        key: `bd-${m.id}`,
        type: "birthday",
        day: p.day,
        month: p.month,
        year: null,
        label: m.fullName,
        memberId: m.id,
      });
    }

    // Anniversaries (deduplicated)
    for (const m of members) {
      if (!m.anniversary) continue;
      const p = parseDateParts2(m.anniversary);
      if (!p || p.month !== selectedMonth) continue;
      const spouse = (m.spouseName ?? "").trim();
      const ck = coupleKey(m.fullName, spouse, m.anniversary);
      if (seenAnniversaries.has(ck)) continue;
      seenAnniversaries.add(ck);
      result.push({
        key: `ann-${m.id}`,
        type: "anniversary",
        day: p.day,
        month: p.month,
        year: null,
        label: spouse ? `${m.fullName} & ${spouse}` : m.fullName,
        memberId: m.id,
      });
    }

    // Custom events
    for (const ev of customEvents) {
      if (ev.recurring) {
        const p = parseDateParts(ev.date);
        if (!p || p.month !== selectedMonth) continue;
        result.push({
          key: `custom-${ev.id}`,
          type: "custom",
          day: p.day,
          month: p.month,
          year: null,
          label: ev.title,
          sublabel: ev.location,
          customEvent: ev,
        });
      } else {
        const p = parseDateFullParts(ev.date);
        if (!p || p.month !== selectedMonth || p.year !== selectedYear) continue;
        result.push({
          key: `custom-${ev.id}`,
          type: "custom",
          day: p.day,
          month: p.month,
          year: p.year,
          label: ev.title,
          sublabel: ev.location,
          customEvent: ev,
        });
      }
    }

    return result.sort((a, b) => a.day - b.day);
  }, [members, customEvents, selectedMonth, selectedYear]);

  const filtered = useMemo(() => {
    let items = filter === "all" ? allItems : allItems.filter(i => i.type === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(i => i.label.toLowerCase().includes(q) || (i.sublabel ?? "").toLowerCase().includes(q));
    }
    return items;
  }, [allItems, filter, search]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<number, UnifiedEvent[]>();
    for (const item of filtered) {
      if (!map.has(item.day)) map.set(item.day, []);
      map.get(item.day)!.push(item);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    deleteEvent(id);
    toast.success("Event deleted");
  };

  const handleEdit = (ev: CustomEvent) => {
    setEditEvent(ev);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditEvent(undefined);
  };

  const isThisMonth =
    selectedMonth === today.getMonth() && selectedYear === today.getFullYear();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Family Events</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Birthdays, anniversaries, and family milestones
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => { setEditEvent(undefined); setDialogOpen(true); }}
            className="gap-2 rounded-full"
          >
            <Plus className="w-4 h-4" />
            Add Custom Event
          </Button>
        )}
      </div>

      {/* ── Month navigator ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-serif font-semibold text-lg px-3 min-w-[140px] text-center">
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {!isThisMonth && (
          <button
            onClick={() => { setSelectedMonth(today.getMonth()); setSelectedYear(today.getFullYear()); }}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            <RefreshCw className="w-3 h-3" /> This month
          </button>
        )}

        {/* Mini month picker */}
        <div className="flex items-center gap-1 flex-wrap ml-auto">
          {MONTH_NAMES_SHORT.map((name, i) => (
            <button
              key={i}
              onClick={() => setSelectedMonth(i)}
              className={[
                "text-xs px-2 py-1 rounded-md font-medium transition-colors",
                selectedMonth === i
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search + filters ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search events…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          {(["all", "birthday", "anniversary", "custom"] as EventFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "text-xs px-2.5 py-1 rounded-md transition-all font-medium",
                filter === f
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Event count summary ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="w-4 h-4" />
        <span>
          {filtered.length} event{filtered.length !== 1 ? "s" : ""} in{" "}
          <strong className="text-foreground">{MONTH_NAMES[selectedMonth]}</strong>
          {!isThisMonth && ` ${selectedYear}`}
        </span>
      </div>

      {/* ── Event list ─────────────────────────────────────────────────────── */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Calendar className="w-12 h-12 opacity-20 mb-3" />
          <p className="font-medium">
            No {filter === "all" ? "events" : FILTER_LABELS[filter].toLowerCase()} in {MONTH_NAMES[selectedMonth]}
            {!isThisMonth && ` ${selectedYear}`}
          </p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-2 text-xs text-primary hover:underline">
              Clear search
            </button>
          )}
          {isAdmin && !search && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => { setEditEvent(undefined); setDialogOpen(true); }}
            >
              <Plus className="w-4 h-4" /> Add a custom event
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, dayItems]) => {
            const isToday =
              isThisMonth && day === today.getDate();
            return (
              <div key={day} className="group">
                {/* Day header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className={[
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                    isToday
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-foreground",
                  ].join(" ")}>
                    {day}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {MONTH_NAMES[selectedMonth]} {day}
                      {isToday && (
                        <span className="ml-2 text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          Today
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {dayItems.length} event{dayItems.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Events on this day */}
                <div className="ml-13 space-y-2 pl-4 border-l-2 border-border ml-[52px]">
                  {dayItems.map(item => (
                    <EventCard
                      key={item.key}
                      item={item}
                      isAdmin={isAdmin}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Custom event dialog ───────────────────────────────────────────── */}
      <CustomEventDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        event={editEvent}
      />
    </div>
  );
}

interface EventCardProps {
  item: UnifiedEvent;
  isAdmin: boolean;
  onEdit: (ev: CustomEvent) => void;
  onDelete: (id: string, title: string) => void;
}

function EventCard({ item, isAdmin, onEdit, onDelete }: EventCardProps) {
  const TypeBadge = () => {
    if (item.type === "birthday") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
          <Gift className="w-2.5 h-2.5" /> Birthday
        </span>
      );
    }
    if (item.type === "anniversary") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300">
          <Calendar className="w-2.5 h-2.5" /> Anniversary
        </span>
      );
    }
    const meta = getCategoryMeta(item.customEvent!.category);
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.color}`}>
        {meta.emoji} {meta.label}
      </span>
    );
  };

  const inner = (
    <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-start justify-between gap-3 hover:border-primary/30 hover:shadow-sm transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <TypeBadge />
          {item.customEvent?.recurring && (
            <span className="text-[10px] text-muted-foreground">· repeats yearly</span>
          )}
        </div>
        <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
        {item.customEvent?.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {item.customEvent.description}
          </p>
        )}
        {item.sublabel && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="w-3 h-3" />
            {item.sublabel}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {item.memberId && (
          <Link href={`/members/${item.memberId}`}>
            <button className="text-xs text-primary hover:underline font-medium">
              Profile →
            </button>
          </Link>
        )}
        {isAdmin && item.customEvent && (
          <>
            <button
              onClick={() => onEdit(item.customEvent!)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(item.customEvent!.id, item.label)}
              className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return inner;
}
