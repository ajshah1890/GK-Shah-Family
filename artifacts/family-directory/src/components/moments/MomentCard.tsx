import { useEffect, useState } from "react";
import { Moment } from "@/types/moments";
import { EVENT_TYPE_COLORS, EVENT_TYPE_EMOJIS } from "@/types/moments";
import { FamilyMember } from "@/types/family";
import { getMomentPhoto } from "@/lib/momentsRepository";
import { MapPin, Calendar, Heart, Images } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface MomentCardProps {
  moment: Moment;
  members: FamilyMember[];
  onToggleFavorite?: (id: string) => void;
  className?: string;
}

function CoverPhoto({ photoKey }: { photoKey?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!photoKey) return;
    getMomentPhoto(photoKey).then(setSrc);
  }, [photoKey]);

  if (!photoKey) {
    return (
      <div className="w-full h-48 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/30 dark:to-orange-900/30 flex items-center justify-center">
        <Images className="w-10 h-10 text-amber-300/60" />
      </div>
    );
  }

  return (
    <div className="w-full h-48 bg-muted overflow-hidden relative">
      {!loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      {src && (
        <img
          src={src}
          alt=""
          className={cn(
            "w-full h-full object-cover transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setLoaded(true)}
          loading="lazy"
        />
      )}
    </div>
  );
}

export function MomentCard({ moment, members, onToggleFavorite, className }: MomentCardProps) {
  const [, setLocation] = useLocation();
  const taggedMembers = members.filter((m) => moment.taggedMemberIds.includes(m.id));
  const colorClass = EVENT_TYPE_COLORS[moment.eventType] ?? EVENT_TYPE_COLORS.Other;
  const emoji = EVENT_TYPE_EMOJIS[moment.eventType] ?? "📸";

  return (
    <div
      className={cn(
        "group bg-card border border-border rounded-xl overflow-hidden cursor-pointer",
        "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200",
        "break-inside-avoid mb-4",
        className
      )}
      onClick={() => setLocation(`/moments/${moment.id}`)}
    >
      <CoverPhoto photoKey={moment.photoKeys[0]} />

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", colorClass)}>
            <span>{emoji}</span>
            {moment.eventType}
          </span>
          <button
            className={cn(
              "shrink-0 p-1 rounded-full transition-colors",
              moment.favorite
                ? "text-rose-500"
                : "text-muted-foreground/40 hover:text-rose-400"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(moment.id);
            }}
            aria-label={moment.favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("w-4 h-4", moment.favorite && "fill-current")} />
          </button>
        </div>

        {moment.caption && (
          <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
            {moment.caption}
          </p>
        )}

        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{format(parseISO(moment.eventDate), "d MMM yyyy")}</span>
            {moment.photoKeys.length > 1 && (
              <span className="ml-auto flex items-center gap-0.5 text-muted-foreground/60">
                <Images className="w-3 h-3" />
                {moment.photoKeys.length}
              </span>
            )}
          </div>
          {moment.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{moment.location}</span>
            </div>
          )}
        </div>

        {taggedMembers.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap pt-0.5">
            {taggedMembers.slice(0, 4).map((m) => (
              <div
                key={m.id}
                title={m.fullName}
                className="w-6 h-6 rounded-full bg-primary/10 border border-border flex items-center justify-center text-[9px] font-bold text-primary"
              >
                {m.fullName.charAt(0)}
              </div>
            ))}
            {taggedMembers.length > 4 && (
              <span className="text-[10px] text-muted-foreground">
                +{taggedMembers.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
