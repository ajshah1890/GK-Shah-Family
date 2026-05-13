import { useEffect, useState, useCallback, useRef } from "react";
import { Moment } from "@/types/moments";
import { getMomentPhoto } from "@/lib/momentsRepository";
import { FamilyMember } from "@/types/family";
import { EVENT_TYPE_EMOJIS } from "@/types/moments";
import { X, ChevronLeft, ChevronRight, Play, Pause, Maximize, Minimize } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface SlideshowModeProps {
  moments: Moment[];
  members: FamilyMember[];
  initialIndex?: number;
  onClose: () => void;
}

const AUTOPLAY_MS = 4000;

export function SlideshowMode({ moments, members, initialIndex = 0, onClose }: SlideshowModeProps) {
  const [index, setIndex] = useState(initialIndex);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = moments[index];

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % moments.length);
  }, [moments.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + moments.length) % moments.length);
  }, [moments.length]);

  useEffect(() => {
    if (!current) return;
    const keys = current.photoKeys;
    keys.forEach((key) => {
      if (!photos[key]) {
        getMomentPhoto(key).then((src) => {
          if (src) setPhotos((p) => ({ ...p, [key]: src }));
        });
      }
    });
  }, [current, photos]);

  useEffect(() => {
    if (moments[index + 1]) {
      const nextKeys = moments[index + 1].photoKeys;
      nextKeys.slice(0, 1).forEach((key) => {
        if (!photos[key]) {
          getMomentPhoto(key).then((src) => {
            if (src) setPhotos((p) => ({ ...p, [key]: src }));
          });
        }
      });
    }
  }, [index, moments, photos]);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(next, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, next]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") { e.preventDefault(); setIsPlaying((p) => !p); }
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onClose]);

  const handleMouseMove = useCallback(() => {
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (!current) return null;

  const coverSrc = photos[current.photoKeys[0]] ?? null;
  const taggedNames = members
    .filter((m) => current.taggedMemberIds.includes(m.id))
    .map((m) => m.fullName);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      onMouseMove={handleMouseMove}
    >
      <div
        key={current.id}
        className="absolute inset-0 transition-opacity duration-700 ease-in-out"
      >
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            {EVENT_TYPE_EMOJIS[current.eventType]}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />
      </div>

      <div className={cn(
        "absolute inset-0 transition-opacity duration-300 pointer-events-none",
        visible ? "opacity-100" : "opacity-0"
      )}>
        <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-6 text-white pointer-events-auto">
          <div className="max-w-2xl mx-auto space-y-2">
            {current.caption && (
              <p className="text-lg font-medium leading-snug drop-shadow">{current.caption}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span>{EVENT_TYPE_EMOJIS[current.eventType]} {current.eventType}</span>
              <span>·</span>
              <span>{format(parseISO(current.eventDate), "d MMM yyyy")}</span>
              {current.location && <><span>·</span><span>{current.location}</span></>}
            </div>
            {taggedNames.length > 0 && (
              <p className="text-xs text-white/60">with {taggedNames.join(", ")}</p>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? "Pause" : "Play"}
            </button>
            <div className="flex gap-1">
              {moments.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    i === index
                      ? "w-4 h-1.5 bg-white"
                      : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
