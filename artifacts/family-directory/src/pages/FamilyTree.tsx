import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Heart, MapPin, Search } from "lucide-react";
import { Link } from "wouter";

export default function FamilyTree() {
  const { members, isLoaded } = useFamilyStore();
  const [view, setView] = useState<"branch" | "couples">("branch");
  const [zoom, setZoom] = useState(1);

  const branches = useMemo(() => {
    const map = new Map<string, typeof members>();
    members.forEach(m => {
      const b = m.mainFamilyBranch || "Unknown Branch";
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(m);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [members]);

  const couples = useMemo(() => {
    const pairs: { p1: typeof members[0], p2: typeof members[0] }[] = [];
    const seen = new Set<string>();
    
    members.forEach(m1 => {
      if (m1.spouseName && !seen.has(m1.id)) {
        const p2 = members.find(m2 => m2.fullName.toLowerCase() === m1.spouseName?.toLowerCase());
        if (p2) {
          pairs.push({ p1: m1, p2 });
          seen.add(m1.id);
          seen.add(p2.id);
        }
      }
    });
    return pairs;
  }, [members]);

  if (!isLoaded) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Family Tree</h1>
          <p className="text-muted-foreground mt-1">Visualize family branches and connections.</p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg">
          <Button 
            variant={view === "branch" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setView("branch")}
            className="text-xs"
          >
            By Branch
          </Button>
          <Button 
            variant={view === "couples" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setView("couples")}
            className="text-xs"
          >
            Couples View
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 sticky top-4 z-10 bg-background/80 backdrop-blur-sm p-2 rounded-xl border border-border w-max ml-auto">
        <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="flex items-center text-sm font-medium w-12 justify-center">{Math.round(zoom * 100)}%</span>
        <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      <div className="overflow-auto pb-20 pt-4 rounded-xl border border-border bg-card/50">
        <div 
          className="min-w-max p-8 transition-transform duration-200 origin-top-left flex flex-col gap-12"
          style={{ transform: `scale(${zoom})` }}
        >
          {view === "branch" ? (
            branches.length === 0 ? (
              <p className="text-muted-foreground text-center">No members found.</p>
            ) : (
              branches.map(([branchName, branchMembers]) => (
                <div key={branchName} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-serif font-bold text-primary">{branchName}</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {branchMembers.length} members
                    </span>
                  </div>
                  
                  <div className="flex gap-8 items-start">
                    {/* Simplified Layout: Just list members horizontally, if they have a spouse in the SAME branch, group them */}
                    {(() => {
                      const processed = new Set<string>();
                      const groups: { primary: typeof members[0], spouse?: typeof members[0], children: string[] }[] = [];
                      
                      branchMembers.forEach(m => {
                        if (processed.has(m.id)) return;
                        
                        let spouse: typeof members[0] | undefined;
                        if (m.spouseName) {
                          spouse = branchMembers.find(b => b.fullName.toLowerCase() === m.spouseName?.toLowerCase());
                        }
                        
                        processed.add(m.id);
                        if (spouse) processed.add(spouse.id);
                        
                        // collect all children mentioned by either parent
                        const childrenSet = new Set<string>();
                        m.childrenNames?.forEach(c => childrenSet.add(c));
                        spouse?.childrenNames?.forEach(c => childrenSet.add(c));
                        
                        groups.push({ primary: m, spouse, children: Array.from(childrenSet) });
                      });

                      return groups.map((g, i) => (
                        <div key={i} className="flex flex-col items-center gap-4">
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm">
                            <MemberNode member={g.primary} />
                            {g.spouse && (
                              <>
                                <Heart className="w-5 h-5 text-destructive animate-pulse" />
                                <MemberNode member={g.spouse} />
                              </>
                            )}
                          </div>
                          
                          {g.children.length > 0 && (
                            <div className="flex flex-col items-center">
                              <div className="w-px h-6 bg-border border-l border-dashed"></div>
                              <div className="flex gap-2 p-3 bg-muted/50 rounded-xl border border-border/50">
                                {g.children.map(childName => (
                                  <div key={childName} className="px-3 py-1 bg-background rounded-md text-sm border border-border font-medium shadow-sm">
                                    {childName}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {couples.length === 0 ? (
                <p className="text-muted-foreground text-center col-span-full">No couples found.</p>
              ) : (
                couples.map((c, i) => (
                  <div key={i} className="flex items-center gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm justify-center">
                    <MemberNode member={c.p1} />
                    <Heart className="w-6 h-6 text-destructive shrink-0" />
                    <MemberNode member={c.p2} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberNode({ member }: { member: any }) {
  return (
    <Link href={`/members/${member.id}`}>
      <div className="flex flex-col items-center gap-2 cursor-pointer group w-24">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 group-hover:border-primary transition-colors shadow-sm bg-muted relative">
          {member.photo ? (
            <img src={member.photo} alt={member.fullName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xl font-serif font-bold">
              {member.fullName.charAt(0)}
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-bold font-serif leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {member.fullName}
          </p>
          {member.city && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate w-full px-1">
              {member.city}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
