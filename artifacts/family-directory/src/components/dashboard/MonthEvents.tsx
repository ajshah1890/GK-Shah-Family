import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FamilyMember } from "@/types/family";
import { CustomEvent, getCategoryMeta } from "@/types/customEvent";
import { useCustomEventsStore } from "@/hooks/useCustomEventsStore";
import { parseDateParts, parseDateFullParts, coupleKey, MONTH_NAMES } from "@/lib/eventUtils";
import { Gift, Calendar, CalendarDays, Plus, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useAdminMode } from "@/hooks/useAdminMode";

interface MonthEventsProps {
  members: FamilyMember[];
}

type MonthFilter = "all" | "birthday" | "anniversary" | "custom";

interface MonthEventItem {
  key: string;
  type: "birthday" | "anniversary" | "custom";
  day: number;
  label: string;
  sublabel?: string;
  memberId?: string;
  customEvent?: CustomEvent;
}

const FILTER_LABELS: Record<MonthFilter, string> = {
  all: "All",
  birthday: "Birthdays",
  anniversary: "Anniversaries",
  custom: "Custom",
};

export function MonthEvents({ members }: MonthEventsProps) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-indexed
  const { events: customEvents, load, isLoaded } = useCustomEventsStore();
  const { isAdmin } = useAdminMode();
  const [filter, setFilter] = useState<MonthFilter>("all");

  useEffect(() => { load(); }, [load]);

  const items = useMemo<MonthEventItem[]>(() => {
    const result: MonthEventItem[] = [];
    const seenAnniversaries = new Set<string>();

    // ── Birthdays ────────────────────────────────────────────────────────────
    for (const m of members) {
      if (!m.birthday) continue;
      const parts = parseDateParts(m.birthday);
      if (!parts || parts.month !== selectedMonth) continue;
      result.push({
        key: `bd-${m.id}`,
        type: "birthday",
        day: parts.day,
        label: m.fullName,
        sublabel: `Birthday`,
        memberId: m.id,
      });
    }

    // ── Anniversaries (deduplicated) ─────────────────────────────────────────
    for (const m of members) {
      if (!m.anniversary) continue;
      const parts = parseDateParts(m.anniversary);
      if (!parts || parts.month !== selectedMonth) continue;
      const spouse = (m.spouseName ?? "").trim();
      const ck = coupleKey(m.fullName, spouse, m.anniversary);
      if (seenAnniversaries.has(ck)) continue;
      seenAnniversaries.add(ck);
      result.push({
        key: `ann-${m.id}`,
        type: "anniversary",
        day: parts.day,
        label: spouse ? `${m.fullName} & ${spouse}` : m.fullName,
        sublabel: "Anniversary",
        memberId: m.id,
      });
    }

    // ── Custom events ────────────────────────────────────────────────────────
    const thisYear = today.getFullYear();
    for (const ev of customEvents) {
      if (ev.recurring) {
        const parts = parseDateParts(ev.date);
        if (!parts || parts.month !== selectedMonth) continue;
        result.push({
          key: `custom-${ev.id}`,
          type: "custom",
          day: parts.day,
          label: ev.title,
          sublabel: ev.location,
          customEvent: ev,
        });
      } else {
        const parts = parseDateFullParts(ev.date);
        if (!parts || parts.month !== selectedMonth) continue;
        if (parts.year !== thisYear) continue;
        result.push({
          key: `custom-${ev.id}`,
          type: "custom",
          day: parts.day,
          label: ev.title,
          sublabel: ev.location,
          customEvent: ev,
        });
      }
    }

    return result.sort((a, b) => a.day - b.day);
  }, [members, customEvents, selectedMonth, today]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(i => i.type === filter);
  }, [items, filter]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<number, MonthEventItem[]>();
    for (const item of filtered) {
      if (!map.has(item.day)) map.set(item.day, []);
      map.get(item.day)!.push(item);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <CalendarDays className="w-5 h-5 text-primary" />
            Events by Month
          </CardTitle>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/events">
                <button className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
                  <Plus className="w-3 h-3" /> Add Event
                </button>
              </Link>
            )}
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 mt-2 w-fit">
          {(["all", "birthday", "anniversary", "custom"] as MonthFilter[]).map(f => (
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
      </CardHeader>

      <CardContent className="p-0 max-h-80 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[120px] p-6 text-center text-muted-foreground">
            <Calendar className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-sm">
              No {filter === "all" ? "events" : FILTER_LABELS[filter].toLowerCase()} in {MONTH_NAMES[selectedMonth]}
            </p>
            {isAdmin && filter !== "birthday" && filter !== "anniversary" && (
              <Link href="/events">
                <button className="mt-3 text-xs text-primary hover:underline font-medium">
                  + Add a custom event
                </button>
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {grouped.map(([day, dayItems]) => (
              <li key={day}>
                {/* Date header */}
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 sticky top-0">
                  <span className="text-xs font-bold text-primary">
                    {MONTH_NAMES[selectedMonth].slice(0, 3)} {day}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    — {dayItems.length} event{dayItems.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {dayItems.map(item => (
                  <EventRow key={item.key} item={item} />
                ))}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {grouped.length > 0 && (
        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""} in {MONTH_NAMES[selectedMonth]}
          </span>
          <Link href={`/events?month=${selectedMonth}`}>
            <button className="text-xs text-primary hover:underline font-medium">
              View full calendar →
            </button>
          </Link>
        </div>
      )}
    </Card>
  );
}

function EventRow({ item }: { item: MonthEventItem }) {
  const TypeBadge = () => {
    if (item.type === "birthday") {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
          <Gift className="w-2.5 h-2.5" /> Birthday
        </span>
      );
    }
    if (item.type === "anniversary") {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300">
          <Calendar className="w-2.5 h-2.5" /> Anniversary
        </span>
      );
    }
    const meta = getCategoryMeta(item.customEvent!.category);
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.color}`}>
        <span>{meta.emoji}</span> {meta.label}
      </span>
    );
  };

  const inner = (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground">{item.label}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <TypeBadge />
          {item.customEvent?.location && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <MapPin className="w-2.5 h-2.5" />{item.customEvent.location}
            </span>
          )}
          {item.customEvent?.recurring && (
            <span className="text-[10px] text-muted-foreground">· yearly</span>
          )}
        </div>
      </div>
    </div>
  );

  if (item.memberId) {
    return <Link href={`/members/${item.memberId}`}>{inner}</Link>;
  }
  return inner;
}
