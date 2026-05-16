import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FamilyMember } from "@/types/family";
import { format, differenceInDays } from "date-fns";
import { Gift, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { WhatsAppWishButton } from "@/components/WhatsAppWishButton";

interface UpcomingFamilyEventsProps {
  members: FamilyMember[];
}

type EventType = "birthday" | "anniversary";
type FilterTab = "all" | "birthday" | "anniversary";

interface UpcomingEvent {
  member: FamilyMember;
  type: EventType;
  displayName: string;
  date: Date;
  daysUntil: number;
}

/**
 * Timezone-safe date part extractor.
 * Works for "YYYY-MM-DD", "YYYY-MM-DDTHH:MM:SS.sssZ", etc.
 * Returns month as 0-indexed.
 */
function parseDateParts(
  raw: string
): { month: number; day: number } | null {
  if (!raw || typeof raw !== "string") return null;
  const clean = raw.trim().slice(0, 10);
  if (clean.length < 10 || clean[4] !== "-" || clean[7] !== "-") return null;
  const month = parseInt(clean.slice(5, 7), 10) - 1;
  const day   = parseInt(clean.slice(8, 10), 10);
  if (
    isNaN(month) || isNaN(day) ||
    month < 0 || month > 11 ||
    day < 1 || day > 31
  ) return null;
  return { month, day };
}

/**
 * Build the next calendar occurrence of a (month, day) pair from today.
 * Returns the Date and how many days away it is.
 * Returns null when month/day would produce an invalid date (e.g. Feb 30).
 */
function nextOccurrence(
  month: number,
  day: number,
  todayYear: number,
  todayMidnight: Date
): { date: Date; daysUntil: number } | null {
  let next = new Date(todayYear, month, day);
  // Invalid date guard (e.g. Feb 30 → March 1 in JS — check day didn't shift)
  if (next.getDate() !== day) return null;
  if (next < todayMidnight) {
    next = new Date(todayYear + 1, month, day);
    if (next.getDate() !== day) return null;
  }
  const daysUntil = differenceInDays(next, todayMidnight);
  return { date: next, daysUntil };
}

function buildUpcomingEvents(members: FamilyMember[]): UpcomingEvent[] {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayYear  = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay   = now.getDate();

  const events: UpcomingEvent[] = [];
  const seenAnniversaryKeys = new Set<string>();

  for (const m of members) {
    // ── Birthdays ────────────────────────────────────────────────────────────
    if (m.birthday) {
      const parts = parseDateParts(m.birthday);
      if (parts) {
        // Skip today (TodaysEvents handles today)
        if (parts.month === todayMonth && parts.day === todayDay) continue;
        const occ = nextOccurrence(parts.month, parts.day, todayYear, todayMidnight);
        if (occ && occ.daysUntil > 0) {
          events.push({
            member: m,
            type: "birthday",
            displayName: m.fullName,
            date: occ.date,
            daysUntil: occ.daysUntil,
          });
        }
      }
    }

    // ── Anniversaries ────────────────────────────────────────────────────────
    if (m.anniversary) {
      const parts = parseDateParts(m.anniversary);
      if (parts) {
        // Dedup: sort both names alphabetically so (A,B) === (B,A)
        const spouseName = (m.spouseName ?? "").trim();
        const coupleKey =
          [m.fullName.trim(), spouseName]
            .map(n => n.toLowerCase())
            .sort()
            .join("|") +
          "|" +
          m.anniversary.slice(0, 10);

        if (seenAnniversaryKeys.has(coupleKey)) continue;
        seenAnniversaryKeys.add(coupleKey);

        // Skip today (TodaysEvents handles today)
        if (parts.month === todayMonth && parts.day === todayDay) continue;
        const occ = nextOccurrence(parts.month, parts.day, todayYear, todayMidnight);
        if (occ && occ.daysUntil > 0) {
          const displayName = spouseName
            ? `${m.fullName} & ${spouseName}`
            : m.fullName;
          events.push({
            member: m,
            type: "anniversary",
            displayName,
            date: occ.date,
            daysUntil: occ.daysUntil,
          });
        }
      }
    }
  }

  return events.sort((a, b) => a.daysUntil - b.daysUntil);
}

const TAB_LABELS: Record<FilterTab, string> = {
  all: "All",
  birthday: "Birthdays",
  anniversary: "Anniversaries",
};

export function UpcomingFamilyEvents({ members }: UpcomingFamilyEventsProps) {
  const [tab, setTab] = useState<FilterTab>("all");

  const LIMIT = 10;

  const allEvents = useMemo(() => buildUpcomingEvents(members), [members]);

  const { events, totalFiltered } = useMemo(() => {
    const filtered =
      tab === "all" ? allEvents : allEvents.filter(e => e.type === tab);
    return {
      events: filtered.slice(0, LIMIT),
      totalFiltered: filtered.length,
    };
  }, [allEvents, tab]);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <CalendarIcon className="w-5 h-5 text-primary" />
            Upcoming Events
          </CardTitle>
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {(["all", "birthday", "anniversary"] as FilterTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "text-xs px-2.5 py-1 rounded-md transition-all font-medium",
                  tab === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[140px] p-6 text-center text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CalendarIcon className="w-6 h-6 opacity-20" />
            </div>
            <p className="text-sm">
              No upcoming{" "}
              {tab === "all" ? "events" : TAB_LABELS[tab].toLowerCase()}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event, i) => (
              <li
                key={`${event.member.id}-${event.type}-${i}`}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-accent/40 transition-colors"
              >
                <Link
                  href={`/members/${event.member.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  {/* Countdown pill */}
                  <div
                    className={[
                      "shrink-0 text-center w-11 rounded-lg py-1",
                      event.type === "birthday"
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                        : "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300",
                    ].join(" ")}
                  >
                    <p className="text-xs font-bold leading-tight">
                      {event.daysUntil}
                    </p>
                    <p className="text-[9px] font-medium leading-tight">
                      {event.daysUntil === 1 ? "day" : "days"}
                    </p>
                  </div>

                  {/* Name + type + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {event.displayName}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {event.type === "birthday" ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          <Gift className="w-2.5 h-2.5" />
                          Birthday
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-400">
                          <CalendarIcon className="w-2.5 h-2.5" />
                          Anniversary
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        · {format(event.date, "MMM d")}
                      </span>
                    </div>
                  </div>
                </Link>
                <WhatsAppWishButton member={event.member} type={event.type} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <div className="px-4 py-2.5 border-t border-border flex items-center justify-between shrink-0">
        <span className="text-xs text-muted-foreground">
          {totalFiltered > LIMIT
            ? `Showing ${events.length} of ${totalFiltered}`
            : `${events.length} event${events.length !== 1 ? "s" : ""} upcoming`}
        </span>
        <Link href="/events">
          <button className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View All Events <ArrowRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
    </Card>
  );
}
