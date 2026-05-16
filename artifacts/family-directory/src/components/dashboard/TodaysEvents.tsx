import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FamilyMember } from "@/types/family";
import { Gift, Calendar as CalendarIcon, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { WhatsAppWishButton } from "@/components/WhatsAppWishButton";
import { useMemo } from "react";

interface TodaysEventsProps {
  members: FamilyMember[];
}

interface TodayEvent {
  member: FamilyMember;
  type: "birthday" | "anniversary";
  displayName: string;
  dateLabel: string;
}

/**
 * Safely extract { month (0-indexed), day } from any date string without
 * going through the Date constructor — avoids UTC-vs-local timezone shifts
 * that turn "2000-05-16T00:00:00.000Z" into May 15 in UTC+5:30.
 */
function parseDateParts(raw: string): { month: number; day: number } | null {
  if (!raw || typeof raw !== "string") return null;
  const clean = raw.trim().slice(0, 10); // grab "YYYY-MM-DD"
  if (clean.length < 10 || clean[4] !== "-" || clean[7] !== "-") return null;
  const month = parseInt(clean.slice(5, 7), 10) - 1; // 0-indexed
  const day   = parseInt(clean.slice(8, 10), 10);
  if (
    isNaN(month) || isNaN(day) ||
    month < 0 || month > 11 ||
    day < 1 || day > 31
  ) return null;
  return { month, day };
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function TodaysEvents({ members }: TodaysEventsProps) {
  const today = new Date();
  const todayMonth = today.getMonth(); // 0-indexed
  const todayDay   = today.getDate();

  const events = useMemo<TodayEvent[]>(() => {
    const result: TodayEvent[] = [];
    let bdCount = 0, annCount = 0, skipped = 0;

    // Dedup anniversaries: key = sorted(name, spouseName) + dateStr
    const seenAnniversaryKeys = new Set<string>();

    for (const m of members) {
      // ── Birthdays ──────────────────────────────────────────────────────────
      if (m.birthday) {
        const parts = parseDateParts(m.birthday);
        if (parts) {
          bdCount++;
          if (parts.month === todayMonth && parts.day === todayDay) {
            result.push({
              member: m,
              type: "birthday",
              displayName: m.fullName,
              dateLabel: `${MONTH_NAMES[parts.month]} ${parts.day}`,
            });
          }
        } else {
          skipped++;
        }
      }

      // ── Anniversaries ──────────────────────────────────────────────────────
      if (m.anniversary) {
        const parts = parseDateParts(m.anniversary);
        if (parts) {
          annCount++;
          // Dedup: alphabetically sort both names so A+B == B+A
          const spouseName = (m.spouseName ?? "").trim();
          const coupleKey = [m.fullName.trim(), spouseName]
            .map(n => n.toLowerCase())
            .sort()
            .join("|") + "|" + m.anniversary.slice(0, 10);

          if (seenAnniversaryKeys.has(coupleKey)) continue;
          seenAnniversaryKeys.add(coupleKey);

          if (parts.month === todayMonth && parts.day === todayDay) {
            const displayName = spouseName
              ? `${m.fullName} & ${spouseName}`
              : m.fullName;
            result.push({
              member: m,
              type: "anniversary",
              displayName,
              dateLabel: `${MONTH_NAMES[parts.month]} ${parts.day}`,
            });
          }
        } else {
          skipped++;
        }
      }
    }

    return result;
  }, [members, todayMonth, todayDay]);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="flex items-center gap-2 text-lg font-serif">
          <Sparkles className="w-5 h-5 text-primary" />
          Today's Events
          {events.length > 0 && (
            <span className="ml-auto text-xs font-normal bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              {events.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[140px] p-6 text-center text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CalendarIcon className="w-6 h-6 opacity-20" />
            </div>
            <p className="text-sm">No family events today</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event, i) => (
              <li
                key={`${event.member.id}-${event.type}-${i}`}
                className="flex items-center gap-2 px-4 py-3 hover:bg-accent/40 transition-colors"
              >
                <Link
                  href={`/members/${event.member.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0 border border-border">
                    {event.member.photo && !event.member.photo.startsWith("idb:") ? (
                      <img
                        src={event.member.photo}
                        alt={event.member.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                        {event.member.fullName.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {event.displayName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {event.type === "birthday" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                          <Gift className="w-2.5 h-2.5" /> Birthday
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300">
                          <CalendarIcon className="w-2.5 h-2.5" /> Anniversary
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {event.dateLabel}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-white bg-primary px-2 py-1 rounded-full shrink-0">
                    Today!
                  </span>
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
