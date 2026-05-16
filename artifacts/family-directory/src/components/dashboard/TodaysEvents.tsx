import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FamilyMember } from "@/types/family";
import { parseISO, format } from "date-fns";
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

export function TodaysEvents({ members }: TodaysEventsProps) {
  const today = new Date();
  const mm = today.getMonth();
  const dd = today.getDate();

  const events = useMemo<TodayEvent[]>(() => {
    const result: TodayEvent[] = [];
    for (const m of members) {
      if (m.birthday) {
        try {
          const d = parseISO(m.birthday);
          if (d.getMonth() === mm && d.getDate() === dd) {
            result.push({
              member: m,
              type: "birthday",
              displayName: m.fullName,
              dateLabel: format(d, "MMMM d"),
            });
          }
        } catch {}
      }
      if (m.anniversary) {
        try {
          const d = parseISO(m.anniversary);
          if (d.getMonth() === mm && d.getDate() === dd) {
            const name = m.spouseName
              ? `${m.fullName} & ${m.spouseName}`
              : m.fullName;
            result.push({
              member: m,
              type: "anniversary",
              displayName: name,
              dateLabel: format(d, "MMMM d"),
            });
          }
        } catch {}
      }
    }
    return result;
  }, [members, mm, dd]);

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
