import { Card, CardContent } from "@/components/ui/card";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAboutContent, FamilyValue } from "@/hooks/useAboutContent";
import { useAdminMode } from "@/hooks/useAdminMode";
import { useMemo, useEffect, useState } from "react";
import { Link } from "wouter";
import { Users, Globe, GitBranch, Heart, BookOpen, Camera, Pencil, X, Check, Plus, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function About() {
  const { members, isLoaded } = useFamilyStore();
  const { isAdmin } = useAdminMode();
  const { content, load, update, reset } = useAboutContent();
  const [editing, setEditing] = useState<string | null>(null); // which section is being edited
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [valuesDraft, setValuesDraft] = useState<FamilyValue[]>([]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    if (!isLoaded || members.length === 0) return null;
    const countries = new Set(members.map(m => m.country).filter(Boolean));
    const cities    = new Set(members.map(m => m.city).filter(Boolean));
    const generations = new Set(members.map(m => m.generationNumber).filter(n => n && n > 0));
    return {
      total:       members.length,
      countries:   countries.size,
      cities:      cities.size,
      generations: generations.size,
    };
  }, [members, isLoaded]);

  const startEdit = (section: string) => {
    setEditing(section);
    if (section === "story") {
      setDraft({ story1: content.story1, story2: content.story2, founderInfo: content.founderInfo, motto: content.motto });
    } else if (section === "values") {
      setValuesDraft(content.values.map(v => ({ ...v })));
    } else if (section === "dir") {
      setDraft({ dirDesc: content.dirDesc });
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft({});
    setValuesDraft([]);
  };

  const saveStory = () => {
    update({ story1: draft.story1, story2: draft.story2, founderInfo: draft.founderInfo, motto: draft.motto });
    toast.success("Story updated");
    cancelEdit();
  };

  const saveValues = () => {
    update({ values: valuesDraft.filter(v => v.title.trim()) });
    toast.success("Values updated");
    cancelEdit();
  };

  const saveDir = () => {
    update({ dirDesc: draft.dirDesc });
    toast.success("Description updated");
    cancelEdit();
  };

  const handleReset = () => {
    if (!confirm("Reset all About page content to defaults?")) return;
    reset();
    toast.success("Content reset to defaults");
  };

  const EditBtn = ({ section }: { section: string }) =>
    isAdmin ? (
      <button
        onClick={() => startEdit(section)}
        className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Edit section"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    ) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="text-center pt-4">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-4xl mx-auto mb-4 shadow-md">
          S
        </div>
        <h1 className="text-4xl font-serif font-bold tracking-tight">G K Shah Family</h1>
        <p className="text-muted-foreground mt-2 text-lg">A chronicle of roots, branches, and bonds</p>
        {content.motto && (
          <p className="italic text-sm text-primary mt-2">"{content.motto}"</p>
        )}
        {isAdmin && (
          <button
            onClick={handleReset}
            className="mt-3 flex items-center gap-1.5 mx-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset to defaults
          </button>
        )}
      </div>

      {/* ── Live stats ─────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: stats.total,       label: "Members",     color: "text-primary" },
            { value: stats.generations, label: "Generations", color: "text-blue-600 dark:text-blue-400" },
            { value: stats.countries,   label: "Countries",   color: "text-green-600 dark:text-green-400" },
            { value: stats.cities,      label: "Cities",      color: "text-amber-600 dark:text-amber-400" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-serif font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Our Story ──────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-serif font-semibold">Our Story</h2>
            <EditBtn section="story" />
          </div>

          {editing === "story" ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Founder / Patriarch</label>
                <Input
                  value={draft.founderInfo ?? ""}
                  onChange={e => setDraft(d => ({ ...d, founderInfo: e.target.value }))}
                  placeholder="e.g. Shri G K Shah — Patriarch & Visionary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Family Motto</label>
                <Input
                  value={draft.motto ?? ""}
                  onChange={e => setDraft(d => ({ ...d, motto: e.target.value }))}
                  placeholder="e.g. Roots that hold, branches that grow."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Paragraph 1</label>
                <Textarea
                  rows={4}
                  value={draft.story1 ?? ""}
                  onChange={e => setDraft(d => ({ ...d, story1: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Paragraph 2</label>
                <Textarea
                  rows={4}
                  value={draft.story2 ?? ""}
                  onChange={e => setDraft(d => ({ ...d, story2: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveStory} className="gap-1.5"><Check className="w-3.5 h-3.5" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1.5"><X className="w-3.5 h-3.5" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              {content.founderInfo && (
                <p className="text-sm font-semibold text-primary">{content.founderInfo}</p>
              )}
              <p className="text-muted-foreground leading-relaxed">{content.story1}</p>
              <p className="text-muted-foreground leading-relaxed">{content.story2}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Family Values ──────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-serif font-semibold">Family Values</h2>
            <EditBtn section="values" />
          </div>

          {editing === "values" ? (
            <div className="space-y-3">
              {valuesDraft.map((v, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Value name"
                      value={v.title}
                      onChange={e => setValuesDraft(arr => arr.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                    />
                    <Input
                      placeholder="Description"
                      value={v.desc}
                      onChange={e => setValuesDraft(arr => arr.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))}
                    />
                  </div>
                  <button
                    onClick={() => setValuesDraft(arr => arr.filter((_, j) => j !== i))}
                    className="p-1.5 mt-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setValuesDraft(arr => [...arr, { title: "", desc: "" }])}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                <Plus className="w-3 h-3" /> Add value
              </button>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={saveValues} className="gap-1.5"><Check className="w-3.5 h-3.5" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1.5"><X className="w-3.5 h-3.5" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {content.values.map(v => (
                <div key={v.title} className="bg-muted/40 rounded-lg p-4">
                  <p className="font-semibold font-serif text-foreground mb-1">{v.title}</p>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── About This Directory ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-serif font-semibold">About This Directory</h2>
            <EditBtn section="dir" />
          </div>

          {editing === "dir" ? (
            <div className="space-y-3">
              <Textarea
                rows={5}
                value={draft.dirDesc ?? ""}
                onChange={e => setDraft(d => ({ ...d, dirDesc: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveDir} className="gap-1.5"><Check className="w-3.5 h-3.5" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1.5"><X className="w-3.5 h-3.5" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground leading-relaxed">{content.dirDesc}</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  { icon: Users,     text: "Browse and search the full family directory with smart multi-field search" },
                  { icon: GitBranch, text: "Explore the interactive family tree and discover kinship between any two members" },
                  { icon: Camera,    text: "Capture and preserve special family moments with the Moments journal" },
                  { icon: Heart,     text: "Never miss a birthday or anniversary with the dashboard's upcoming reminders" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-2">
                    <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Quick navigation ───────────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">Ready to explore?</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/members">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
              <Users className="w-4 h-4" /> Browse Members
            </span>
          </Link>
          <Link href="/family-tree">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border text-sm font-medium hover:bg-accent transition-colors cursor-pointer">
              <GitBranch className="w-4 h-4" /> Family Tree
            </span>
          </Link>
          <Link href="/events">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border text-sm font-medium hover:bg-accent transition-colors cursor-pointer">
              <Heart className="w-4 h-4" /> Family Events
            </span>
          </Link>
          <Link href="/statistics">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border text-sm font-medium hover:bg-accent transition-colors cursor-pointer">
              <Globe className="w-4 h-4" /> Insights
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
