import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FamilyMember } from "@/types/family";
import {
  parseISO,
  format,
  differenceInDays,
  isBefore,
  addYears,
} from "date-fns";
import { Gift, Calendar as CalendarIcon } from "lucide-react";
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

function buildUpcomingEvents(members: FamilyMember[]): UpcomingEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events: UpcomingEvent[] = [];

  for (const m of members) {
    for (const type of ["birthday", "anniversary"] as EventType[]) {
      const raw = m[type];
      if (!raw) continue;
      try {
        const d = parseISO(raw);
        let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
        if (isBefore(next, today)) next = addYears(next, 1);
        const daysUntil = differenceInDays(next, today);
        if (daysUntil === 0) continue; // today's events handled by TodaysEvents card
        const displayName =
          type === "anniversary" && m.spouseName
            ? `${m.fullName} & ${m.spouseName}`
            : m.fullName;
        events.push({ member: m, type, displayName, date: next, daysUntil });
      } catch {}
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

  const allEvents = useMemo(() => buildUpcomingEvents(members), [members]);

  const events = useMemo(() => {
    const filtered =
      tab === "all" ? allEvents : allEvents.filter((e) => e.type === tab);
    return filtered.slice(0, 15);
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
            {(["all", "birthday", "anniversary"] as FilterTab[]).map((t) => (
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
              {tab === "all"
                ? "events"
                : TAB_LABELS[tab].toLowerCase()}{" "}
              in the next 30 days
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
    </Card>
  );
}
