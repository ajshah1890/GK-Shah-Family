import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useMomentsStore } from "@/hooks/useMomentsStore";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import { getMomentPhoto } from "@/lib/momentsRepository";
import { EVENT_TYPE_COLORS, EVENT_TYPE_EMOJIS } from "@/types/moments";
import { Moment } from "@/types/moments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Heart, MapPin, Calendar, ChevronLeft, ChevronRight, Trash2, Play, Users,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SlideshowMode } from "@/components/moments/SlideshowMode";
import { MomentCard } from "@/components/moments/MomentCard";

function PhotoCarousel({ photoKeys }: { photoKeys: string[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    photoKeys.forEach((key) => {
      if (!(key in photos)) {
        getMomentPhoto(key).then((src) =>
          setPhotos((p) => ({ ...p, [key]: src }))
        );
      }
    });
  }, [photoKeys, photos]);

  const prev = useCallback(() => {
    setCurrentIdx((i) => (i - 1 + photoKeys.length) % photoKeys.length);
  }, [photoKeys.length]);

  const next = useCallback(() => {
    setCurrentIdx((i) => (i + 1) % photoKeys.length);
  }, [photoKeys.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next]);

  if (!photoKeys.length) return null;

  const currentKey = photoKeys[currentIdx];
  const src = photos[currentKey];

  return (
    <div className="relative bg-black rounded-xl overflow-hidden select-none"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
        touchStartX.current = null;
      }}
    >
      <div className="aspect-[4/3] sm:aspect-video flex items-center justify-center">
        {src === undefined ? (
          <div className="w-full h-full bg-muted animate-pulse" />
        ) : src === null ? (
          <div className="w-full h-full flex items-center justify-center text-6xl bg-muted">
            {/* fallback */}📸
          </div>
        ) : (
          <img
            key={currentKey}
            src={src}
            alt=""
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {photoKeys.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photoKeys.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className={cn(
                  "rounded-full transition-all duration-200",
                  i === currentIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
                )}
              />
            ))}
          </div>
          <div className="absolute top-3 right-3 text-xs text-white/80 bg-black/40 rounded-full px-2 py-0.5">
            {currentIdx + 1} / {photoKeys.length}
          </div>
        </>
      )}
    </div>
  );
}

export default function MomentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getMoment, activeMoments, toggleFavorite, deleteMoment, isLoaded } = useMomentsStore();
  const { members } = useFamilyStore();
  const { isAdmin } = useAdminMode();
  const [showSlideshow, setShowSlideshow] = useState(false);

  if (!isLoaded) return <div className="animate-pulse space-y-4"><div className="h-80 bg-muted rounded-xl" /></div>;

  const moment = id ? getMoment(id) : undefined;

  if (!moment) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-2xl font-bold">Memory not found</h2>
        <Button onClick={() => setLocation("/moments")}>Back to Moments</Button>
      </div>
    );
  }

  const taggedMembers = members.filter((m) => moment.taggedMemberIds.includes(m.id));
  const colorClass = EVENT_TYPE_COLORS[moment.eventType] ?? EVENT_TYPE_COLORS.Other;
  const emoji = EVENT_TYPE_EMOJIS[moment.eventType] ?? "📸";

  const currentIndex = activeMoments.findIndex((m) => m.id === id);
  const prevMoment = currentIndex > 0 ? activeMoments[currentIndex - 1] : null;
  const nextMoment = currentIndex < activeMoments.length - 1 ? activeMoments[currentIndex + 1] : null;

  const related = activeMoments
    .filter(
      (m) =>
        m.id !== id &&
        (m.eventType === moment.eventType ||
          m.taggedMemberIds.some((tid) => moment.taggedMemberIds.includes(tid)))
    )
    .slice(0, 3);

  const handleDelete = async () => {
    await deleteMoment(moment.id);
    toast.success("Memory deleted");
    setLocation("/moments");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400 pb-20">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/moments")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {prevMoment && (
            <Button variant="outline" size="icon" onClick={() => setLocation(`/moments/${prevMoment.id}`)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          {nextMoment && (
            <Button variant="outline" size="icon" onClick={() => setLocation(`/moments/${nextMoment.id}`)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <PhotoCarousel photoKeys={moment.photoKeys} />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", colorClass)}>
              <span className="text-sm">{emoji}</span>
              {moment.eventType}
            </span>
            {moment.branch && (
              <Badge variant="outline" className="text-xs">{moment.branch}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {moment.photoKeys.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => setShowSlideshow(true)}>
                <Play className="w-3.5 h-3.5 mr-1" /> Slideshow
              </Button>
            )}
            <button
              onClick={() => toggleFavorite(moment.id)}
              className={cn(
                "p-2 rounded-full transition-colors",
                moment.favorite ? "text-rose-500" : "text-muted-foreground hover:text-rose-400"
              )}
            >
              <Heart className={cn("w-5 h-5", moment.favorite && "fill-current")} />
            </button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="p-2 rounded-full text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the moment and all its photos. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {format(parseISO(moment.eventDate), "d MMMM yyyy")}
          </div>
          {moment.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {moment.location}
            </div>
          )}
        </div>

        {moment.caption && (
          <p className="text-base leading-relaxed text-foreground">{moment.caption}</p>
        )}

        {taggedMembers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>Tagged</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {taggedMembers.map((m) => (
                <Link
                  key={m.id}
                  href={`/members/${m.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {m.fullName.charAt(0)}
                  </div>
                  <span className="text-sm">{m.fullName}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {related.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Related Memories</h3>
          <div className="columns-1 sm:columns-2 gap-4">
            {related.map((m) => (
              <MomentCard key={m.id} moment={m} members={members} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
        </div>
      )}

      {showSlideshow && (
        <SlideshowMode
          moments={[moment]}
          members={members}
          onClose={() => setShowSlideshow(false)}
        />
      )}
    </div>
  );
}
