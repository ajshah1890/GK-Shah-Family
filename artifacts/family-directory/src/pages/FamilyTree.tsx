import { useState, useMemo, useRef } from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { FamilyMember } from "@/types/family";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Heart, ChevronDown, ChevronUp, RefreshCw, GitBranch } from "lucide-react";

interface TreeNode {
  member: FamilyMember;
  spouse?: FamilyMember;
  children: TreeNode[];
}

function buildTree(members: FamilyMember[]): TreeNode[] {
  const memberMap = new Map(members.map(m => [m.id, m]));
  const placed = new Set<string>();

  function buildNode(m: FamilyMember): TreeNode {
    placed.add(m.id);
    
    // Find spouse via spouseId first, then by spouseName match
    let spouse: FamilyMember | undefined;
    if (m.spouseId) {
      spouse = memberMap.get(m.spouseId);
    } else if (m.spouseName) {
      spouse = members.find(x => x.fullName.toLowerCase() === m.spouseName!.toLowerCase() && x.id !== m.id);
    }
    if (spouse) placed.add(spouse.id);

    // Find children: members whose fatherId or motherId is this member's id
    // OR whose fatherId/motherId is spouse's id
    const parentIds = new Set([m.id, spouse?.id].filter(Boolean));
    const children = members
      .filter(x => {
        if (placed.has(x.id)) return false;
        return (x.fatherId && parentIds.has(x.fatherId)) ||
               (x.motherId && parentIds.has(x.motherId));
      })
      .sort((a, b) => (a.siblingOrder || 999) - (b.siblingOrder || 999));

    const childNodes = children.map(c => buildNode(c));
    
    return { member: m, spouse, children: childNodes };
  }

  // Find roots: members with no fatherId and no motherId, not placed as spouse
  const roots = members
    .filter(m => !m.fatherId && !m.motherId && !placed.has(m.id))
    .sort((a, b) => (a.generationNumber || 99) - (b.generationNumber || 99) || (a.siblingOrder || 99) - (b.siblingOrder || 99));

  return roots.map(r => {
    if (placed.has(r.id)) return null;
    return buildNode(r);
  }).filter(Boolean) as TreeNode[];
}

const GEN_COLORS: Record<number, { bg: string; border: string; badge: string; badgeText: string; dot: string }> = {
  1: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-300 dark:border-amber-700", badge: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200", badgeText: "Founder", dot: "bg-amber-500" },
  2: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-300 dark:border-blue-700", badge: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200", badgeText: "2nd Gen", dot: "bg-blue-500" },
  3: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-300 dark:border-green-700", badge: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200", badgeText: "3rd Gen", dot: "bg-green-500" },
  4: { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-300 dark:border-purple-700", badge: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200", badgeText: "4th Gen", dot: "bg-purple-500" },
  5: { bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-300 dark:border-rose-700", badge: "bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200", badgeText: "5th Gen", dot: "bg-rose-500" },
};

function getGenColor(n?: number) { return GEN_COLORS[n ?? 1] ?? GEN_COLORS[1]; }

function MemberCard({ member }: { member: FamilyMember }) {
  const colors = getGenColor(member.generationNumber);
  return (
    <Link href={`/members/${member.id}`}>
      <div className={`flex flex-col items-center gap-1.5 cursor-pointer group w-[88px] p-2 rounded-xl border ${colors.bg} ${colors.border} hover:shadow-md transition-all`}>
        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/50 shadow-sm bg-muted shrink-0">
          {member.photo ? (
            <img src={member.photo} alt={member.fullName} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-lg font-serif font-bold ${colors.badge}`}>
              {member.fullName.charAt(0)}
            </div>
          )}
        </div>
        <div className="text-center w-full">
          <p className="text-[11px] font-semibold font-serif leading-tight line-clamp-2 group-hover:text-primary transition-colors text-foreground">
            {member.fullName}
          </p>
          {member.city && (
            <p className="text-[9px] text-muted-foreground truncate">{member.city}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function TreeNodeComponent({ node }: { node: TreeNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center select-none">
      {/* Family unit */}
      <div className="relative flex items-center gap-1">
        <MemberCard member={node.member} />
        {node.spouse && (
          <div className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" fill="currentColor" />
            <MemberCard member={node.spouse} />
          </div>
        )}
        {hasChildren && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full bg-card border-2 border-border shadow-sm flex items-center justify-center hover:border-primary transition-colors text-muted-foreground hover:text-primary"
          >
            {collapsed 
              ? <span className="text-[9px] font-bold leading-none">+</span> 
              : <span className="text-[9px] font-bold leading-none">–</span>}
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className="flex flex-col items-center">
          {/* Vertical down */}
          <div className="w-px h-8 bg-border/60 mt-4" />
          {/* Children row */}
          <div className="flex gap-6 items-start relative">
            {/* Top horizontal line spanning full width */}
            {node.children.length > 1 && (
              <div className="absolute top-0 left-[44px] right-[44px] h-px bg-border/60" />
            )}
            {node.children.map(child => (
              <div key={child.member.id} className="flex flex-col items-center">
                {/* Vertical stub down */}
                <div className="w-px h-4 bg-border/60" />
                <TreeNodeComponent node={child} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FamilyTree() {
  const { members, isLoaded } = useFamilyStore();
  const [zoom, setZoom] = useState(0.8);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const treeRoots = useMemo(() => buildTree(members), [members]);

  // Pan handlers
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanX(panStart.current.px + e.clientX - panStart.current.x);
    setPanY(panStart.current.py + e.clientY - panStart.current.y);
  };
  const onMouseUp = () => setIsPanning(false);

  // Touch pan
  const lastTouch = useRef({ x: 0, y: 0 });
  const onTouchStart = (e: React.TouchEvent) => {
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - lastTouch.current.x;
    const dy = e.touches[0].clientY - lastTouch.current.y;
    setPanX(p => p + dx);
    setPanY(p => p + dy);
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const reset = () => { setZoom(0.8); setPanX(0); setPanY(0); };

  if (!isLoaded) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Family Tree</h1>
          <p className="text-muted-foreground mt-1">
            {members.length} members across {Math.max(...members.map(m => m.generationNumber || 1), 0)} generations
          </p>
        </div>
        {/* Generation Legend */}
        <div className="flex flex-wrap gap-2">
          {[1,2,3,4].map(gen => {
            const c = getGenColor(gen);
            const labels = ["Founder", "2nd Gen", "3rd Gen", "4th Gen"];
            return (
              <div key={gen} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.border}`}>
                <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                {labels[gen-1]}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={reset}>
          <RefreshCw className="w-3.5 h-3.5" />
          Reset View
        </Button>
        <p className="text-xs text-muted-foreground ml-2 hidden sm:block">Drag to pan • Click cards to view profiles • Click +/– to expand branches</p>
      </div>

      {/* Tree Canvas */}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border border-border bg-muted/20 min-h-[500px] relative cursor-grab active:cursor-grabbing"
        style={{ height: 'calc(100vh - 280px)', minHeight: 480 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        <div
          className="absolute transition-none p-16"
          style={{ 
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'top center',
          }}
        >
          {treeRoots.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-center py-20">
              <GitBranch className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">No family tree structure yet. Add parent-child relationships to members to build the tree.</p>
            </div>
          ) : (
            <div className="flex gap-20 items-start justify-center">
              {treeRoots.map(root => (
                <TreeNodeComponent key={root.member.id} node={root} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
