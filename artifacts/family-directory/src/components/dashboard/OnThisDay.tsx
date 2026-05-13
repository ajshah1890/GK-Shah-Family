import { useMemo } from "react";
import { Moment } from "@/types/moments";
import { EVENT_TYPE_EMOJIS } from "@/types/moments";
import { FamilyMember } from "@/types/family";
import { format, parseISO, getMonth, getDate } from "date-fns";
import { Camera, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface OnThisDayProps {
  moments: Moment[];
  members: FamilyMember[];
}

export function OnThisDay({ moments, members }: OnThisDayProps) {
  const [, setLocation] = useLocation();
  const today = new Date();
  const todayMonth = getMonth(today);
  const todayDay = getDate(today);

  const matching = useMemo(() => {
    return moments
      .filter((m) => {
        if (m.archived) return false;
        try {
          const d = parseISO(m.eventDate);
          return getMonth(d) === todayMonth && getDate(d) === todayDay;
        } catch {
          return false;
        }
      })
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  }, [moments, todayMonth, todayDay]);

  if (matching.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <h3 className="font-serif font-semibold text-sm text-amber-900 dark:text-amber-200">
          On This Day
        </h3>
        <span className="text-xs text-amber-600/70 dark:text-amber-400/70 ml-auto">
          {format(today, "d MMMM")}
        </span>
      </div>

      <div className="space-y-2">
        {matching.slice(0, 3).map((moment) => {
          const year = parseISO(moment.eventDate).getFullYear();
          const yearsAgo = today.getFullYear() - year;
          const tagged = members
            .filter((m) => moment.taggedMemberIds.includes(m.id))
            .map((m) => m.fullName.split(" ")[0])
            .slice(0, 2)
            .join(", ");

          return (
            <button
              key={moment.id}
              onClick={() => setLocation(`/moments/${moment.id}`)}
              className="w-full text-left flex items-start gap-3 p-2 rounded-lg hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors group"
            >
              <span className="text-xl mt-0.5 shrink-0">{EVENT_TYPE_EMOJIS[moment.eventType]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {moment.caption || moment.eventType}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {yearsAgo === 0 ? "This year" : `${yearsAgo} year${yearsAgo !== 1 ? "s" : ""} ago`}
                  {tagged && ` · ${tagged}`}
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
            </button>
          );
        })}
      </div>

      {matching.length > 3 && (
        <button
          onClick={() => setLocation("/moments")}
          className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
        >
          +{matching.length - 3} more memories this day
        </button>
      )}
    </div>
  );
}
