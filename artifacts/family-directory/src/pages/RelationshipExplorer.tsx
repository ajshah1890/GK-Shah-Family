import { useState, useMemo } from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { FamilyMember } from "@/types/family";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, RefreshCw, Users, GitBranch, ChevronDown } from "lucide-react";
import { calculateRelationship } from "@/lib/relationships";

// ─── Member selector with search ──────────────────────────────────────────────

function MemberSelector({
  value,
  onChange,
  members,
  placeholder,
  excludeId,
}: {
  value: string;
  onChange: (id: string) => void;
  members: FamilyMember[];
  placeholder: string;
  excludeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members
      .filter(m => m.id !== excludeId && (!q || m.fullName.toLowerCase().includes(q) || (m.city || "").toLowerCase().includes(q)))
      .sort((a, b) => (a.generationNumber ?? 99) - (b.generationNumber ?? 99) || a.fullName.localeCompare(b.fullName))
      .slice(0, 12);
  }, [members, search, excludeId]);

  const selected = members.find(m => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-auto py-3 px-4 font-normal"
        >
          {selected ? (
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-serif font-bold shrink-0">
                {selected.fullName.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-sm">{selected.fullName}</p>
                <p className="text-xs text-muted-foreground">{[selected.generation, selected.city].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <Input
          autoFocus
          placeholder="Search by name or city…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2 h-8"
        />
        <div className="max-h-[260px] overflow-y-auto space-y-0.5">
          {filtered.map(m => (
            <div
              key={m.id}
              className={[
                "flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent transition-colors",
                m.id === value ? "bg-primary/10" : "",
              ].join(" ")}
              onClick={() => { onChange(m.id); setOpen(false); setSearch(""); }}
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-serif font-bold text-xs shrink-0">
                {m.fullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[m.generation, m.city].filter(Boolean).join(" · ")}
                </p>
              </div>
              {m.memberId && (
                <span className="text-[9px] text-muted-foreground font-mono shrink-0 ml-auto">{m.memberId}</span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No members found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Path display ─────────────────────────────────────────────────────────────

function PathCard({ member, label }: { member: FamilyMember; label?: string }) {
  return (
    <Link href={`/members/${member.id}`}>
      <div className="flex flex-col items-center gap-1 cursor-pointer group">
        {label && (
          <span className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</span>
        )}
        <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-serif font-bold group-hover:border-primary transition-colors overflow-hidden shrink-0">
          {member.photo ? (
            <img src={member.photo} alt={member.fullName} className="w-full h-full object-cover" />
          ) : member.fullName.charAt(0)}
        </div>
        <p className="text-[10px] font-semibold text-center max-w-[72px] leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {member.fullName}
        </p>
        {member.generationNumber && (
          <span className="text-[8px] text-muted-foreground">Gen {member.generationNumber}</span>
        )}
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RelationshipExplorer() {
  const { members, isLoaded } = useFamilyStore();
  const [memberAId, setMemberAId] = useState("");
  const [memberBId, setMemberBId] = useState("");

  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const result = useMemo(() => {
    if (!memberAId || !memberBId || memberAId === memberBId) return null;
    const a = memberMap.get(memberAId);
    const b = memberMap.get(memberBId);
    if (!a || !b) return null;
    return calculateRelationship(a, b, members);
  }, [memberAId, memberBId, members, memberMap]);

  const memberA = memberAId ? memberMap.get(memberAId) : null;
  const memberB = memberBId ? memberMap.get(memberBId) : null;

  const reset = () => { setMemberAId(""); setMemberBId(""); };

  if (!isLoaded) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Relationship Explorer</h1>
        <p className="text-muted-foreground mt-1">
          Find out exactly how any two family members are related.
        </p>
      </div>

      {/* Selector row */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First member</label>
              <MemberSelector
                value={memberAId}
                onChange={setMemberAId}
                members={members}
                placeholder="Select a member…"
                excludeId={memberBId}
              />
            </div>
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Second member</label>
              <MemberSelector
                value={memberBId}
                onChange={setMemberBId}
                members={members}
                placeholder="Select a member…"
                excludeId={memberAId}
              />
            </div>
          </div>
          {(memberAId || memberBId) && (
            <div className="flex justify-end mt-4">
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5" />
                Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Same person error */}
      {memberAId && memberBId && memberAId === memberBId && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4 text-sm text-amber-700 dark:text-amber-400">
            Please select two different members.
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {memberA && memberB && memberAId !== memberBId && (
        <>
          {result ? (
            <div className="space-y-4">
              {/* Headline result */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-3 flex-wrap mb-3">
                    <span className="font-semibold text-lg">{memberA.fullName}</span>
                    <span className="text-muted-foreground">is</span>
                    <Badge className="text-sm px-3 py-1 font-semibold">{memberB.fullName}'s</Badge>
                  </div>
                  <p className="text-4xl font-serif font-bold text-primary mb-2">{result.label}</p>
                  {result.depthA > 0 && result.depthB > 0 && (
                    <p className="text-sm text-muted-foreground">
                      via <span className="font-medium text-foreground">{result.commonAncestor.fullName}</span>
                    </p>
                  )}
                  <div className="mt-4 pt-4 border-t border-primary/10 text-sm text-muted-foreground">
                    Conversely: <span className="font-medium text-foreground">{memberB.fullName}</span> is{" "}
                    <span className="font-medium text-primary">{memberA.fullName}'s {result.reversedLabel}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Visual path */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-primary" />
                    Connection Path
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-6">
                  <div className="overflow-x-auto pb-2">
                    <div className="flex items-center gap-2 min-w-max">
                      {/* Path up: A → common ancestor */}
                      {result.path.pathUp.map((m, i) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <PathCard
                            member={m}
                            label={
                              i === 0 ? "Start" :
                              i === result.path.pathUp.length - 1 && result.path.pathDown.length > 0 ? "Common Ancestor" :
                              undefined
                            }
                          />
                          {(i < result.path.pathUp.length - 1 || result.path.pathDown.length > 0) && (
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      ))}
                      {/* Path down: common ancestor → B */}
                      {result.path.pathDown.map((m, i) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <PathCard
                            member={m}
                            label={i === result.path.pathDown.length - 1 ? "End" : undefined}
                          />
                          {i < result.path.pathDown.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xl font-bold font-serif text-primary">{result.depthA}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">steps from {memberA.fullName.split(' ')[0]}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xl font-bold font-serif text-primary">{result.depthA + result.depthB}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">total steps apart</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xl font-bold font-serif text-primary">{result.depthB}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">steps from {memberB.fullName.split(' ')[0]}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <GitBranch className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-semibold text-muted-foreground">No relationship found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {memberA.fullName} and {memberB.fullName} don't share a common ancestor in the directory yet. Try linking their family trees via parent/father fields.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Prompt */}
      {!memberAId && !memberBId && (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Select two family members above</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              The explorer will calculate their exact kinship — uncle, 2nd cousin, great-grandchild, and more.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
