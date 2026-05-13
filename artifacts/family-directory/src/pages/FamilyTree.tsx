import {
  useState, useMemo, useRef, useEffect,
  memo, useCallback,
} from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { FamilyMember } from "@/types/family";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ZoomIn, ZoomOut, RefreshCw, GitBranch,
  Search, X, Heart, ChevronsUpDown, ChevronDown, ChevronUp, Layers,
} from "lucide-react";
import {
  buildFamilyTree, getSearchState, TreeNode,
} from "@/lib/familyTree";

// ─── Generation colour palette ────────────────────────────────────────────────
const GEN_COLORS: Record<number, {
  bg: string; border: string; highlight: string;
  avatar: string; dot: string; label: string;
}> = {
  1: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-300 dark:border-amber-600", highlight: "ring-2 ring-amber-500 shadow-amber-200 dark:shadow-amber-900 shadow-lg", avatar: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", dot: "bg-amber-500", label: "Founder" },
  2: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-300 dark:border-blue-600", highlight: "ring-2 ring-blue-500 shadow-lg", avatar: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", dot: "bg-blue-500", label: "2nd Gen" },
  3: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-300 dark:border-green-600", highlight: "ring-2 ring-green-500 shadow-lg", avatar: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", dot: "bg-green-500", label: "3rd Gen" },
  4: { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-300 dark:border-purple-600", highlight: "ring-2 ring-purple-500 shadow-lg", avatar: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", dot: "bg-purple-500", label: "4th Gen" },
  5: { bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-300 dark:border-rose-600", highlight: "ring-2 ring-rose-500 shadow-lg", avatar: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200", dot: "bg-rose-500", label: "5th Gen" },
  6: { bg: "bg-teal-50 dark:bg-teal-950/40", border: "border-teal-300 dark:border-teal-600", highlight: "ring-2 ring-teal-500 shadow-lg", avatar: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200", dot: "bg-teal-500", label: "6th Gen" },
};
function genColor(n?: number) { return GEN_COLORS[n ?? 1] ?? GEN_COLORS[1]; }

const SIBLING_GAP = 32;

// ─── Collapse revision type ───────────────────────────────────────────────────
interface CollapseRevision { all: boolean; rev: number }

// ─── Member card ──────────────────────────────────────────────────────────────
const MemberCard = memo(function MemberCard({
  member, isHighlighted,
}: { member: FamilyMember; isHighlighted: boolean }) {
  const c = genColor(member.generationNumber);
  return (
    <Link href={`/members/${member.id}`}>
      <div
        className={[
          "flex flex-col items-center gap-1 cursor-pointer group",
          "w-[80px] p-1.5 rounded-xl border transition-all duration-200",
          c.bg, c.border,
          "hover:shadow-md hover:-translate-y-0.5",
          isHighlighted ? `${c.highlight}` : "",
        ].join(" ")}
      >
        <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/40 shadow-sm bg-muted shrink-0">
          {member.photo ? (
            <img src={member.photo} alt={member.fullName} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-sm font-serif font-bold ${c.avatar}`}>
              {member.fullName.charAt(0)}
            </div>
          )}
        </div>
        <div className="text-center w-full">
          <p className="text-[9.5px] font-semibold font-serif leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {member.fullName}
          </p>
          {member.city && (
            <p className="text-[8.5px] text-muted-foreground truncate mt-0.5">{member.city}</p>
          )}
        </div>
      </div>
    </Link>
  );
});

// ─── Tree node ────────────────────────────────────────────────────────────────
interface TreeNodeProps {
  node: TreeNode;
  matchIds: Set<string>;
  expandIds: Set<string>;
  searching: boolean;
  collapseRevision: CollapseRevision;
}

const TreeNodeComponent = memo(function TreeNodeComponent({
  node, matchIds, expandIds, searching, collapseRevision,
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const forceOpen = searching && expandIds.has(node.member.id);
  const [collapsed, setCollapsed] = useState(false);

  // Respond to global expand/collapse
  useEffect(() => {
    if (collapseRevision.rev === 0) return;
    setCollapsed(collapseRevision.all);
  }, [collapseRevision.rev, collapseRevision.all]);

  // Force open when search matches a descendant
  useEffect(() => {
    if (forceOpen) setCollapsed(false);
  }, [forceOpen]);

  const isExpanded = hasChildren && !collapsed;
  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(c => !c);
  }, []);

  return (
    <div className="flex flex-col items-center">
      {/* Family unit */}
      <div className="relative flex items-center gap-1">
        <MemberCard member={node.member} isHighlighted={matchIds.has(node.member.id)} />
        {node.spouse && (
          <>
            <Heart className="w-2.5 h-2.5 text-rose-400 shrink-0" fill="currentColor" />
            <MemberCard member={node.spouse} isHighlighted={matchIds.has(node.spouse.id)} />
          </>
        )}
        {hasChildren && (
          <button
            onClick={toggle}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20
                       w-5 h-5 rounded-full bg-card border-2 border-border shadow-sm
                       flex items-center justify-center
                       hover:border-primary hover:text-primary transition-colors
                       text-muted-foreground text-[9px] font-bold leading-none"
            title={collapsed ? "Expand branch" : "Collapse branch"}
          >
            {collapsed ? "+" : "−"}
          </button>
        )}
      </div>

      {/* Children */}
      {isExpanded && (
        <div className="flex flex-col items-center">
          <div className="w-px bg-border/60 mt-3" style={{ height: 20 }} />
          <div className="relative flex items-start" style={{ gap: SIBLING_GAP }}>
            {node.children.map((child, i) => {
              const isFirst = i === 0;
              const isLast = i === node.children.length - 1;
              const isSingle = node.children.length === 1;
              return (
                <div key={child.member.id} className="relative flex flex-col items-center">
                  {!isSingle && (
                    <div
                      className="absolute top-0 h-px bg-border/60 z-0"
                      style={{
                        left: isFirst ? "50%" : -SIBLING_GAP / 2,
                        right: isLast ? "50%" : -SIBLING_GAP / 2,
                      }}
                    />
                  )}
                  <div className="w-px bg-border/60 z-0" style={{ height: 18 }} />
                  <TreeNodeComponent
                    node={child}
                    matchIds={matchIds}
                    expandIds={expandIds}
                    searching={searching}
                    collapseRevision={collapseRevision}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasChildren && collapsed && (
        <div className="mt-4 px-2 py-0.5 rounded-full bg-muted border border-border text-[9px] text-muted-foreground font-medium">
          {node.children.length} {node.children.length === 1 ? "child" : "children"} hidden
        </div>
      )}
    </div>
  );
});

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FamilyTree() {
  const { members, isLoaded } = useFamilyStore();

  // Zoom + pan
  const [zoom, setZoom] = useState(0.75);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const lastTouch = useRef({ x: 0, y: 0 });

  // Expand / Collapse all
  const [collapseRevision, setCollapseRevision] = useState<CollapseRevision>({ all: false, rev: 0 });
  const expandAll = () => setCollapseRevision(r => ({ all: false, rev: r.rev + 1 }));
  const collapseAll = () => setCollapseRevision(r => ({ all: true, rev: r.rev + 1 }));

  // Generation filter
  const [maxGenFilter, setMaxGenFilter] = useState<number | null>(null);

  const filteredMembers = useMemo(() => {
    if (maxGenFilter === null) return members;
    return members.filter(m => (m.generationNumber ?? 1) <= maxGenFilter);
  }, [members, maxGenFilter]);

  // Search with debounce
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value), 250);
  }, []);
  const clearSearch = useCallback(() => { setSearchInput(""); setSearchQuery(""); }, []);
  const searching = searchQuery.trim().length > 0;

  const treeRoots = useMemo(() => buildFamilyTree(filteredMembers), [filteredMembers]);
  const { matchIds, expandIds } = useMemo(
    () => getSearchState(searchQuery, filteredMembers),
    [searchQuery, filteredMembers]
  );
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
    setPanX(p => p + dx); setPanY(p => p + dy);
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const reset = useCallback(() => { setZoom(0.75); setPanX(0); setPanY(0); }, []);

  if (!isLoaded) return null;

  const genLabels: Record<number, string> = {
    1: "Founder", 2: "2nd Gen", 3: "3rd Gen",
    4: "4th Gen", 5: "5th Gen", 6: "6th Gen",
  };

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight">Family Tree</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {members.length} members · {maxGen} generation{maxGen !== 1 ? "s" : ""} · rooted at GK Shah
          </p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: Math.min(maxGen, 6) }, (_, i) => i + 1).map(gen => {
            const c = genColor(gen);
            return (
              <div key={gen} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${c.bg} ${c.border}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {genLabels[gen] ?? `Gen ${gen}`}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search member…"
            className="pl-8 pr-8 h-8 text-sm"
          />
          {searchInput && (
            <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {searching && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {matchIds.size} match{matchIds.size !== 1 ? "es" : ""}
          </span>
        )}

        {/* Expand / Collapse all */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-2" onClick={expandAll}>
            <ChevronDown className="w-3 h-3" />
            <span className="hidden sm:inline">Expand all</span>
          </Button>
          <div className="w-px h-4 bg-border" />
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-2" onClick={collapseAll}>
            <ChevronUp className="w-3 h-3" />
            <span className="hidden sm:inline">Collapse all</span>
          </Button>
        </div>

        {/* Generation filter */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground px-1.5">
            <Layers className="w-3 h-3" />
            <span className="hidden sm:inline">Gen</span>
          </span>
          {Array.from({ length: Math.min(maxGen, 6) }, (_, i) => i + 1).map(gen => {
            const c = genColor(gen);
            const active = maxGenFilter === gen;
            return (
              <button
                key={gen}
                onClick={() => setMaxGenFilter(active ? null : gen)}
                className={[
                  "text-[10px] font-medium px-2 py-0.5 rounded transition-colors border",
                  active ? `${c.bg} ${c.border} font-semibold ring-1 ${c.border}` : "text-muted-foreground hover:bg-muted border-transparent",
                ].join(" ")}
                title={active ? "Clear filter" : `Show up to generation ${gen}`}
              >
                {gen}
              </button>
            );
          })}
          {maxGenFilter !== null && (
            <button onClick={() => setMaxGenFilter(null)} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5" title="Clear filter">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 ml-auto">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.2, +(z - 0.1).toFixed(1)))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-medium w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(1)))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={reset}>
          <RefreshCw className="w-3 h-3" />
          Reset
        </Button>
        <p className="text-[10px] text-muted-foreground hidden xl:block">
          Drag to pan · Click +/− to expand · Click card to view profile
        </p>
      </div>

      {/* Canvas */}
      <div
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
                  Add parent-child relationships in member edit forms to build the tree.
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
                  collapseRevision={collapseRevision}
                />
              ))}
            </div>
          )}
        </div>

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
