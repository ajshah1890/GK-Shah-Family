import { useState, useMemo, useRef, useEffect, memo, useCallback } from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { FamilyMember } from "@/types/family";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ZoomIn, ZoomOut, RefreshCw, GitBranch, Search, X, Heart } from "lucide-react";
import {
  buildFamilyTree,
  getSearchState,
  TreeNode,
} from "@/lib/familyTree";

// ─── Generation colour palette ────────────────────────────────────────────────
const GEN_COLORS: Record<number, {
  bg: string; border: string; highlight: string;
  avatar: string; dot: string; label: string;
}> = {
  1: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-600",
    highlight: "ring-2 ring-amber-500 shadow-amber-200 dark:shadow-amber-900",
    avatar: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    dot: "bg-amber-500",
    label: "Founder",
  },
  2: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-600",
    highlight: "ring-2 ring-blue-500 shadow-blue-200 dark:shadow-blue-900",
    avatar: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    dot: "bg-blue-500",
    label: "2nd Gen",
  },
  3: {
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-300 dark:border-green-600",
    highlight: "ring-2 ring-green-500 shadow-green-200 dark:shadow-green-900",
    avatar: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    dot: "bg-green-500",
    label: "3rd Gen",
  },
  4: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-300 dark:border-purple-600",
    highlight: "ring-2 ring-purple-500 shadow-purple-200 dark:shadow-purple-900",
    avatar: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    dot: "bg-purple-500",
    label: "4th Gen",
  },
  5: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-300 dark:border-rose-600",
    highlight: "ring-2 ring-rose-500",
    avatar: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
    dot: "bg-rose-500",
    label: "5th Gen",
  },
  6: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-300 dark:border-teal-600",
    highlight: "ring-2 ring-teal-500",
    avatar: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    dot: "bg-teal-500",
    label: "6th Gen",
  },
};
function genColor(n?: number) {
  return GEN_COLORS[n ?? 1] ?? GEN_COLORS[1];
}

// Gap between siblings in pixels — must match the CSS value below
const SIBLING_GAP = 32;

// ─── Member card ─────────────────────────────────────────────────────────────
interface MemberCardProps {
  member: FamilyMember;
  isHighlighted: boolean;
}

const MemberCard = memo(function MemberCard({ member, isHighlighted }: MemberCardProps) {
  const c = genColor(member.generationNumber);
  return (
    <Link href={`/members/${member.id}`}>
      <div
        className={[
          "flex flex-col items-center gap-1.5 cursor-pointer group",
          "w-[84px] p-2 rounded-xl border transition-all duration-200",
          c.bg, c.border,
          "hover:shadow-md hover:-translate-y-0.5",
          isHighlighted ? `shadow-md ${c.highlight}` : "",
        ].join(" ")}
        data-testid={`member-card-${member.id}`}
      >
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/40 shadow-sm bg-muted shrink-0">
          {member.photo ? (
            <img
              src={member.photo}
              alt={member.fullName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-base font-serif font-bold ${c.avatar}`}>
              {member.fullName.charAt(0)}
            </div>
          )}
        </div>
        <div className="text-center w-full">
          <p className="text-[10px] font-semibold font-serif leading-tight line-clamp-2 group-hover:text-primary transition-colors text-foreground">
            {member.fullName}
          </p>
          {member.city && (
            <p className="text-[9px] text-muted-foreground truncate mt-0.5">{member.city}</p>
          )}
        </div>
      </div>
    </Link>
  );
});

// ─── Tree node (recursive) ───────────────────────────────────────────────────
interface TreeNodeProps {
  node: TreeNode;
  matchIds: Set<string>;
  expandIds: Set<string>;
  searching: boolean;
}

const TreeNodeComponent = memo(function TreeNodeComponent({
  node,
  matchIds,
  expandIds,
  searching,
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;

  // Force-expand when searching and this node has a descendant that matches
  const forceOpen = searching && expandIds.has(node.member.id);
  const [collapsed, setCollapsed] = useState(false);

  // Reset collapse when search forces open
  useEffect(() => {
    if (forceOpen) setCollapsed(false);
  }, [forceOpen]);

  const isExpanded = hasChildren && !collapsed;
  const primaryHighlighted = matchIds.has(node.member.id);
  const spouseHighlighted = !!node.spouse && matchIds.has(node.spouse.id);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(c => !c);
  }, []);

  return (
    <div className="flex flex-col items-center">
      {/* ── Family unit: member [♥ spouse] ── */}
      <div className="relative flex items-center gap-1">
        <MemberCard member={node.member} isHighlighted={primaryHighlighted} />

        {node.spouse && (
          <>
            <Heart
              className="w-3 h-3 text-rose-400 shrink-0 mx-0.5"
              fill="currentColor"
            />
            <MemberCard member={node.spouse} isHighlighted={spouseHighlighted} />
          </>
        )}

        {/* Collapse / expand toggle */}
        {hasChildren && (
          <button
            onClick={toggle}
            className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20
                       w-5 h-5 rounded-full bg-card border-2 border-border shadow-sm
                       flex items-center justify-center
                       hover:border-primary hover:text-primary transition-colors
                       text-muted-foreground text-[9px] font-bold leading-none"
            data-testid={`toggle-${node.member.id}`}
            title={collapsed ? "Expand branch" : "Collapse branch"}
          >
            {collapsed ? "+" : "−"}
          </button>
        )}
      </div>

      {/* ── Children ── */}
      {isExpanded && (
        <div className="flex flex-col items-center">
          {/* Vertical stem from parent to children bar */}
          <div className="w-px bg-border/60 mt-3.5" style={{ height: 20 }} />

          {/* Sibling row */}
          <div className="relative flex items-start" style={{ gap: SIBLING_GAP }}>
            {node.children.map((child, i) => {
              const isFirst = i === 0;
              const isLast = i === node.children.length - 1;
              const isSingle = node.children.length === 1;

              return (
                <div key={child.member.id} className="relative flex flex-col items-center">
                  {/* Horizontal connector segment */}
                  {!isSingle && (
                    <div
                      className="absolute top-0 h-px bg-border/60 z-0"
                      style={{
                        left: isFirst ? "50%" : -SIBLING_GAP / 2,
                        right: isLast ? "50%" : -SIBLING_GAP / 2,
                      }}
                    />
                  )}
                  {/* Vertical stub down to child node */}
                  <div className="w-px bg-border/60 z-0" style={{ height: 18 }} />
                  <TreeNodeComponent
                    node={child}
                    matchIds={matchIds}
                    expandIds={expandIds}
                    searching={searching}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Show count badge when collapsed and has children */}
      {hasChildren && collapsed && (
        <div className="mt-4 px-2 py-0.5 rounded-full bg-muted border border-border text-[9px] text-muted-foreground font-medium">
          {node.children.length} {node.children.length === 1 ? "child" : "children"} hidden
        </div>
      )}
    </div>
  );
});

// ─── Main page ───────────────────────────────────────────────────────────────
export default function FamilyTree() {
  const { members, isLoaded } = useFamilyStore();

  // Zoom + pan state
  const [zoom, setZoom] = useState(0.75);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const lastTouch = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const searching = searchQuery.trim().length > 0;

  // Memoised tree build
  const treeRoots = useMemo(() => buildFamilyTree(members), [members]);

  // Memoised search state
  const { matchIds, expandIds } = useMemo(
    () => getSearchState(searchQuery, members),
    [searchQuery, members]
  );

  // Generation counts for legend
  const maxGen = useMemo(
    () => Math.max(1, ...members.map(m => m.generationNumber ?? 1)),
    [members]
  );

  // Mouse pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a, button, input")) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
  }, [panX, panY]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPanX(panStart.current.px + e.clientX - panStart.current.x);
    setPanY(panStart.current.py + e.clientY - panStart.current.y);
  }, []);

  const stopPan = useCallback(() => { isPanning.current = false; }, []);

  // Touch pan
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - lastTouch.current.x;
    const dy = e.touches[0].clientY - lastTouch.current.y;
    setPanX(p => p + dx);
    setPanY(p => p + dy);
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const reset = useCallback(() => {
    setZoom(0.75);
    setPanX(0);
    setPanY(0);
  }, []);

  if (!isLoaded) return null;

  const genLabels: Record<number, string> = {
    1: "Founder", 2: "2nd Gen", 3: "3rd Gen",
    4: "4th Gen", 5: "5th Gen", 6: "6th Gen",
  };

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-80px)]">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight">Family Tree</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {members.length} members · {maxGen} generation{maxGen !== 1 ? "s" : ""} · starting from GK Shah
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: Math.min(maxGen, 6) }, (_, i) => i + 1).map(gen => {
            const c = genColor(gen);
            return (
              <div
                key={gen}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${c.bg} ${c.border}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {genLabels[gen] ?? `Gen ${gen}`}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search member in tree…"
            className="pl-8 pr-8 h-8 text-sm"
            data-testid="tree-search"
          />
          {searching && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {searching && (
          <span className="text-xs text-muted-foreground">
            {matchIds.size} match{matchIds.size !== 1 ? "es" : ""}
          </span>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 ml-auto">
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setZoom(z => Math.max(0.25, +(z - 0.1).toFixed(1)))}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-medium w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(1)))}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={reset}>
          <RefreshCw className="w-3 h-3" />
          Reset
        </Button>

        <p className="text-[10px] text-muted-foreground hidden lg:block">
          Drag to pan · Click +/− to expand · Click card to view profile
        </p>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[length:24px_24px] relative cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={stopPan}
      >
        <div
          className="absolute p-20 transition-none"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: "top center",
            willChange: "transform",
          }}
        >
          {treeRoots.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-center py-20 px-8">
              <GitBranch className="w-12 h-12 text-muted-foreground/30" />
              <div>
                <p className="font-semibold text-muted-foreground">No tree structure yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Add parent-child relationships to members using the Edit form to build the tree.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-16 items-start justify-center">
              {treeRoots.map(root => (
                <TreeNodeComponent
                  key={root.member.id}
                  node={root}
                  matchIds={matchIds}
                  expandIds={expandIds}
                  searching={searching}
                />
              ))}
            </div>
          )}
        </div>

        {/* Search no-results overlay */}
        {searching && matchIds.size === 0 && (
          <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none">
            <div className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground shadow-sm">
              No members found for "{searchQuery}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
