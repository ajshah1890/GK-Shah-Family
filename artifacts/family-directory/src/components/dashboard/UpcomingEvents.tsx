import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FamilyMember } from "@/types/family";
import { format, differenceInDays, parseISO, isBefore, addYears } from "date-fns";
import { Gift, Calendar as CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { WhatsAppWishButton } from "@/components/WhatsAppWishButton";

interface UpcomingEventsProps {
  members: FamilyMember[];
  type: 'birthday' | 'anniversary';
}

function getUpcomingEvents(members: FamilyMember[], type: 'birthday' | 'anniversary') {
  const today = new Date();

  return members
    .filter(m => m[type])
    .map(member => {
      const dateStr = member[type] as string;
      const date = parseISO(dateStr);
      let nextDate = new Date(today.getFullYear(), date.getMonth(), date.getDate());

      if (isBefore(nextDate, today) && differenceInDays(today, nextDate) > 0) {
        nextDate = addYears(nextDate, 1);
      }

      const daysUntil = differenceInDays(nextDate, today);

      return { member, date: nextDate, daysUntil };
    })
    .filter(event => event.daysUntil >= 0 && event.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function UpcomingEvents({ members, type }: UpcomingEventsProps) {
  const events = getUpcomingEvents(members, type);
  const title = type === 'birthday' ? 'Upcoming Birthdays' : 'Upcoming Anniversaries';
  const Icon = type === 'birthday' ? Gift : CalendarIcon;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="flex items-center gap-2 text-lg font-serif">
          <Icon className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Icon className="w-6 h-6 opacity-20" />
            </div>
            <p className="text-sm">No upcoming {type}s in the next 30 days.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event) => (
              <li key={event.member.id} className="flex items-center gap-2 px-4 py-3 hover:bg-accent/40 transition-colors">
                {/* Clickable area → member profile */}
                <Link
                  href={`/members/${event.member.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  {/* Avatar */}
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

                  {/* Name + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {event.member.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {format(event.date, "MMMM d")}
                    </p>
                  </div>

                  {/* Days pill */}
                  <div className="shrink-0 text-right">
                    {event.daysUntil === 0 ? (
                      <span className="text-xs font-bold text-white bg-primary px-2 py-1 rounded-full">
                        Today!
                      </span>
                    ) : event.daysUntil === 1 ? (
                      <span className="text-xs font-medium text-primary">Tomorrow</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        In {event.daysUntil}d
                      </span>
                    )}
                  </div>
                </Link>

                {/* WhatsApp wish button — outside Link so it doesn't navigate */}
                <WhatsAppWishButton member={event.member} type={type} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
