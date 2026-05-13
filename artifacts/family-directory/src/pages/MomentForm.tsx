import { useState, useRef, useCallback } from "react";
import { useMomentsStore } from "@/hooks/useMomentsStore";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import { compressImage, estimateSizeKB } from "@/lib/imageCompression";
import { EVENT_TYPES, EventType } from "@/types/moments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Upload, X, Heart, ChevronLeft, ChevronRight, Loader2, ImagePlus, Search,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PendingPhoto {
  preview: string;
  sizeKB: number;
}

export default function MomentForm() {
  const [, setLocation] = useLocation();
  const { createMoment } = useMomentsStore();
  const { members } = useFamilyStore();
  const { isAdmin } = useAdminMode();

  const [caption, setCaption] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventType, setEventType] = useState<EventType>("Other");
  const [location, setLocation2] = useState("");
  const [branch, setBranch] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [taggedMemberIds, setTaggedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const branches = Array.from(new Set(members.map((m) => m.mainFamilyBranch).filter(Boolean) as string[])).sort();

  const filteredMembers = members.filter(
    (m) => !m.isArchived && m.fullName.toLowerCase().includes(memberSearch.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground text-sm">You need admin access to create moments.</p>
        <Button variant="outline" onClick={() => setLocation("/moments")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Moments
        </Button>
      </div>
    );
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (pendingPhotos.length + files.length > 20) {
      toast.error("Maximum 20 photos per moment");
      return;
    }
    setCompressing(true);
    try {
      const compressed = await Promise.all(
        files.map((f) => compressImage(f, { maxWidth: 1600, quality: 0.72 }))
      );
      const newPhotos: PendingPhoto[] = compressed.map((preview) => ({
        preview,
        sizeKB: estimateSizeKB(preview),
      }));
      setPendingPhotos((prev) => [...prev, ...newPhotos]);
    } catch (err) {
      toast.error("Failed to process some images");
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [pendingPhotos.length]);

  const removePhoto = (idx: number) => {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const movePhoto = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= pendingPhotos.length) return;
    setPendingPhotos((prev) => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const toggleMember = (id: string) => {
    setTaggedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDate) { toast.error("Event date is required"); return; }
    setSaving(true);
    try {
      await createMoment({
        caption,
        photoDataUrls: pendingPhotos.map((p) => p.preview),
        taggedMemberIds,
        eventDate,
        location: location2 || undefined,
        branch: branch || undefined,
        eventType,
        favorite,
      });
      toast.success("Memory saved to your family archive!");
      setLocation("/moments");
    } catch (err) {
      toast.error("Failed to save moment");
    } finally {
      setSaving(false);
    }
  };

  const location2 = location;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400 pb-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/moments")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-serif font-bold">New Moment</h1>
          <p className="text-muted-foreground text-sm">Add a memory to the family archive</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Photos</Label>

              {pendingPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  {pendingPhotos.map((photo, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden aspect-square bg-muted">
                      <img
                        src={photo.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="absolute bottom-1.5 left-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => movePhoto(idx, -1)}
                            className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                        )}
                        {idx < pendingPhotos.length - 1 && (
                          <button
                            type="button"
                            onClick={() => movePhoto(idx, 1)}
                            className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 text-[9px] text-white/70 bg-black/40 rounded px-1">
                        {photo.sizeKB}KB
                      </div>
                      {idx === 0 && (
                        <div className="absolute top-1.5 left-1.5 text-[9px] text-white bg-primary/80 rounded px-1 font-medium">
                          Cover
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className={cn(
                  "w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 transition-colors",
                  compressing ? "opacity-60 cursor-not-allowed" : "hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
                )}
              >
                {compressing ? (
                  <>
                    <Loader2 className="w-7 h-7 text-muted-foreground animate-spin" />
                    <span className="text-sm text-muted-foreground">Compressing…</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-7 h-7 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {pendingPhotos.length > 0 ? "Add more photos" : "Upload photos"}
                    </span>
                    <span className="text-xs text-muted-foreground/60">Auto-compressed · Stored locally</span>
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                placeholder="Share the story behind this memory…"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eventDate">Date *</Label>
                <Input
                  id="eventDate"
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Mumbai, India"
                  value={location2}
                  onChange={(e) => setLocation2(e.target.value)}
                />
              </div>
              {branches.length > 0 && (
                <div className="space-y-2">
                  <Label>Family Branch</Label>
                  <Select value={branch || "__none__"} onValueChange={(v) => setBranch(v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {branches.filter((b) => b?.trim()).map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFavorite((f) => !f)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors",
                  favorite
                    ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Heart className={cn("w-3.5 h-3.5", favorite && "fill-current")} />
                {favorite ? "Favorited" : "Add to Favorites"}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <Label>Tag Family Members</Label>
            {taggedMemberIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {taggedMemberIds.map((id) => {
                  const m = members.find((mb) => mb.id === id);
                  if (!m) return null;
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {m.fullName.split(" ")[0]}
                      <button
                        type="button"
                        onClick={() => toggleMember(id)}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search members…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5 -mx-1">
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-left transition-colors",
                    taggedMemberIds.includes(m.id)
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    taggedMemberIds.includes(m.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {m.fullName.charAt(0)}
                  </div>
                  <span className="flex-1 truncate">{m.fullName}</span>
                  {m.generation && (
                    <span className="text-xs text-muted-foreground shrink-0">{m.generation}</span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setLocation("/moments")}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={saving || compressing}>
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              "Save Memory"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
