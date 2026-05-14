import {
  useState, useMemo, useRef, useEffect, useCallback, memo,
} from "react";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { FamilyMember } from "@/types/family";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ZoomIn, ZoomOut, RefreshCw, GitBranch,
  Search, X, Heart, Layers, Maximize2,
  ChevronDown, ChevronUp, Crosshair, Map,
} from "lucide-react";
import { buildFamilyTree, getSearchState, TreeNode } from "@/lib/familyTree";

// ─── Generation palette ───────────────────────────────────────────────────────
const GEN_PALETTE: Record<number, { bg: string; border: string; ring: string; avatar: string; dot: string }> = {
  1: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-300 dark:border-amber-700", ring: "ring-amber-500", avatar: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100", dot: "#d97706" },
  2: { bg: "bg-sky-50 dark:bg-sky-950/40", border: "border-sky-300 dark:border-sky-700", ring: "ring-sky-500", avatar: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100", dot: "#0ea5e9" },
  3: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-300 dark:border-emerald-700", ring: "ring-emerald-500", avatar: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100", dot: "#10b981" },
  4: { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-300 dark:border-purple-700", ring: "ring-purple-500", avatar: "bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100", dot: "#a855f7" },
  5: { bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-300 dark:border-rose-700", ring: "ring-rose-500", avatar: "bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100", dot: "#f43f5e" },
  6: { bg: "bg-teal-50 dark:bg-teal-950/40", border: "border-teal-300 dark:border-teal-700", ring: "ring-teal-500", avatar: "bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-100", dot: "#14b8a6" },
  7: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-300 dark:border-orange-700", ring: "ring-orange-500", avatar: "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100", dot: "#f97316" },
  8: { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-300 dark:border-indigo-700", ring: "ring-indigo-500", avatar: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100", dot: "#6366f1" },
};
function gp(n?: number) { return GEN_PALETTE[n ?? 1] ?? GEN_PALETTE[1]; }

// ─── Layout types ─────────────────────────────────────────────────────────────
const SG = 10;      // spouse gap
const ROOT_GAP = 56; // gap between disconnected root trees

interface NodePos {
  id: string;
  member: FamilyMember;
  x: number;
  y: number;
  spouse?: FamilyMember;
  childrenIds: string[];
  hasTreeChildren: boolean;
}

interface TreeLayout {
  nodes: NodePos[];
  svgPath: string;
  bounds: { x: number; y: number; w: number; h: number };
}

// ─── Reingold-Tilford style layout ───────────────────────────────────────────
function computeLayout(
  roots: TreeNode[],
  collapsedSet: Set<string>,
  cw: number, ch: number, hg: number, vg: number,
): TreeLayout {
  const widths: Record<string, number> = {};
  const nodes: NodePos[] = [];
  const childrenOf: Record<string, string[]> = {};

  // Pass 1 — post-order: compute minimum subtree widths
  function subtreeW(node: TreeNode): number {
    const unitW = node.spouse ? cw + SG + cw : cw;
    const selfMin = unitW + hg;
    const collapsed = collapsedSet.has(node.member.id);
    if (collapsed || node.children.length === 0) {
      widths[node.member.id] = selfMin;
      return selfMin;
    }
    const childW = node.children.reduce((s, c) => s + subtreeW(c), 0);
    const w = Math.max(selfMin, childW);
    widths[node.member.id] = w;
    return w;
  }

  // Pass 2 — pre-order: assign positions
  function place(node: TreeNode, left: number, allocated: number, depth: number) {
    const y = depth * (ch + vg);
    const collapsed = collapsedSet.has(node.member.id);
    const hasChildren = !collapsed && node.children.length > 0;

    let centerX: number;

    if (!hasChildren) {
      centerX = left + allocated / 2;
    } else {
      const childTotalW = node.children.reduce((s, c) => s + widths[c.member.id], 0);
      const childStart = left + (allocated - childTotalW) / 2;
      const firstW = widths[node.children[0].member.id];
      const lastW  = widths[node.children[node.children.length - 1].member.id];
      const firstCx = childStart + firstW / 2;
      const lastCx  = childStart + childTotalW - lastW / 2;
      centerX = (firstCx + lastCx) / 2;

      const kids: string[] = [];
      let cl = childStart;
      for (const child of node.children) {
        const cw2 = widths[child.member.id];
        kids.push(child.member.id);
        place(child, cl, cw2, depth + 1);
        cl += cw2;
      }
      childrenOf[node.member.id] = kids;
    }

    const x = centerX - cw / 2;
    nodes.push({
      id: node.member.id,
      member: node.member,
      x,
      y,
      spouse: node.spouse ?? undefined,
      childrenIds: childrenOf[node.member.id] ?? [],
      hasTreeChildren: node.children.length > 0,
    });
  }

  for (const root of roots) subtreeW(root);

  let left = hg / 2;
  for (const root of roots) {
    const w = widths[root.member.id];
    place(root, left, w, 0);
    left += w + ROOT_GAP;
  }

  // Build SVG connector path — classic T-bar genealogy style
  let svgPath = "";
  for (const n of nodes) {
    const kids = n.childrenIds;
    if (!kids.length) continue;
    const childNodes = kids.map(id => nodes.find(nn => nn.id === id)).filter(Boolean) as NodePos[];
    if (!childNodes.length) continue;

    const parentCx = n.x + cw / 2;
    const parentBottom = n.y + ch;
    const childTop = childNodes[0].y;
    const junctionY = parentBottom + Math.round((childTop - parentBottom) * 0.5);

    svgPath += `M${parentCx} ${parentBottom}L${parentCx} ${junctionY}`;

    if (childNodes.length > 1) {
      const firstCx = childNodes[0].x + cw / 2;
      const lastCx  = childNodes[childNodes.length - 1].x + cw / 2;
      svgPath += `M${firstCx} ${junctionY}L${lastCx} ${junctionY}`;
    }

    for (const cn of childNodes) {
      svgPath += `M${cn.x + cw / 2} ${junctionY}L${cn.x + cw / 2} ${cn.y}`;
    }
  }

  // Bounds
  let minX = Infinity, minY = 0, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x + (n.spouse ? cw + SG + cw : cw));
    maxY = Math.max(maxY, n.y + ch);
  }
  if (!isFinite(minX)) minX = 0;
  if (!isFinite(maxX)) maxX = 0;

  return {
    nodes,
    svgPath,
    bounds: { x: minX - hg, y: minY, w: maxX - minX + hg * 2, h: maxY + vg },
  };
}

// ─── Member card ─────────────────────────────────────────────────────────────
interface CardProps {
  node: NodePos;
  cw: number; ch: number;
  isMatch: boolean;
  isFocused: boolean;
  isFaded: boolean;
  isCollapsed: boolean;
  focusMode: boolean;
  onToggle: (id: string) => void;
  onFocus: (id: string) => void;
  member: FamilyMember;
  isSpouse?: boolean;
}

const MemberCard = memo(function MemberCard({
  node, cw, ch, isMatch, isFocused, isFaded, isCollapsed,
  focusMode, onToggle, onFocus, member, isSpouse,
}: CardProps) {
  const c = gp(member.generationNumber);
  const big = cw > 80;

  const inner = (
    <div
      className={[
        "rounded-xl border transition-all duration-150 cursor-pointer select-none",
        "flex flex-col items-center overflow-hidden",
        c.bg, c.border,
        isMatch   ? `ring-2 ${c.ring} shadow-lg shadow-black/10` : "",
        isFocused ? `ring-2 ${c.ring} shadow-xl scale-[1.06] z-30` : "",
        isFaded   ? "opacity-20 pointer-events-none" : "",
        "hover:shadow-md hover:-translate-y-0.5 hover:z-10 active:scale-[0.97]",
      ].join(" ")}
      style={{ width: cw, height: ch, padding: big ? "6px 5px 4px" : "4px 3px 3px" }}
      onClick={focusMode ? (e) => { e.preventDefault(); onFocus(member.id); } : undefined}
    >
      <div
        className="rounded-full overflow-hidden border border-white/50 shadow-sm bg-muted shrink-0"
        style={{ width: big ? 46 : 32, height: big ? 46 : 32, marginBottom: 2 }}
      >
        {member.photo && !member.photo.startsWith("idb:") ? (
          <img src={member.photo} alt={member.fullName} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center font-serif font-bold ${c.avatar}`}
            style={{ fontSize: big ? 17 : 13 }}
          >
            {member.fullName.charAt(0)}
          </div>
        )}
      </div>
      <p
        className="font-semibold font-serif leading-tight text-center line-clamp-2 px-0.5 w-full"
        style={{ fontSize: big ? 10.5 : 8.5, lineHeight: 1.25 }}
      >
        {member.fullName}
      </p>
      {big && member.city && (
        <p className="text-muted-foreground truncate w-full text-center px-0.5" style={{ fontSize: 8 }}>
          {member.city}
        </p>
      )}
    </div>
  );

  return (
    <div className="relative shrink-0" style={{ width: cw, height: ch }}>
      {!focusMode ? <Link href={`/members/${member.id}`}>{inner}</Link> : inner}
      {!isSpouse && node.hasTreeChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
          className="absolute left-1/2 -translate-x-1/2 z-20 w-[18px] h-[18px] rounded-full bg-card border-2 border-border shadow flex items-center justify-center hover:border-primary hover:text-primary transition-colors text-muted-foreground text-[8px] font-bold leading-none"
          style={{ bottom: -11 }}
          title={isCollapsed ? "Expand branch" : "Collapse branch"}
        >
          {isCollapsed ? "+" : "−"}
        </button>
      )}
    </div>
  );
});

// ─── Minimap ──────────────────────────────────────────────────────────────────
const MM_W = 168, MM_H = 104;

function Minimap({
  layout, zoom, pan, cvsW, cvsH, cw, ch,
}: { layout: TreeLayout; zoom: number; pan: { x: number; y: number }; cvsW: number; cvsH: number; cw: number; ch: number }) {
  const { bounds, nodes } = layout;
  if (!nodes.length || bounds.w <= 0 || bounds.h <= 0) return null;

  const scale = Math.min(MM_W / bounds.w, MM_H / bounds.h) * 0.88;
  const ox = (MM_W - bounds.w * scale) / 2;
  const oy = (MM_H - bounds.h * scale) / 2;
  const tx = (wx: number) => (wx - bounds.x) * scale + ox;
  const ty = (wy: number) => (wy - bounds.y) * scale + oy;

  const vx = tx(-pan.x / zoom);
  const vy = ty(-pan.y / zoom);
  const vw = (cvsW / zoom) * scale;
  const vh = (cvsH / zoom) * scale;

  return (
    <div className="absolute bottom-3 right-3 z-20 rounded-lg border border-border bg-card/90 shadow-lg overflow-hidden backdrop-blur-sm">
      <svg width={MM_W} height={MM_H} className="block">
        {nodes.map(n => (
          <rect
            key={n.id}
            x={tx(n.x)}
            y={ty(n.y)}
            width={Math.max(3, cw * scale)}
            height={Math.max(2, ch * scale)}
            rx={1}
            fill={gp(n.member.generationNumber).dot}
            opacity={0.72}
          />
        ))}
        <rect
          x={vx} y={vy} width={Math.max(12, vw)} height={Math.max(10, vh)}
          rx={2} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FamilyTree() {
  const { members, isLoaded } = useFamilyStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const innerRef  = useRef<HTMLDivElement>(null);

  // Viewport state
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan]   = useState({ x: 0, y: 0 });
  const [cvsSize, setCvsSize] = useState({ w: 0, h: 0 });
  const fitted = useRef(false);

  // UX modes
  const [compact, setCompact]       = useState(false);
  const [focusMode, setFocusMode]   = useState(false);
  const [focusedId, setFocusedId]   = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());

  // Filters
  const [maxGenFilter, setMaxGenFilter] = useState<number | null>(null);
  const [searchInput, setSearchInput]   = useState("");
  const [searchQuery, setSearchQuery]   = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Dimensions
  const CW = compact ? 76  : 96;
  const CH = compact ? 68  : 88;
  const HG = compact ? 14  : 24;
  const VG = compact ? 52  : 80;

  // Pan gesture state
  const panning = useRef(false);
  const panAnchor = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const touches = useRef<Record<number, { x: number; y: number }>>({});
  const pinchDist = useRef<number | null>(null);

  // ── Computed data ──────────────────────────────────────────────────────────
  const filteredMembers = useMemo(
    () => maxGenFilter === null ? members : members.filter(m => (m.generationNumber ?? 1) <= maxGenFilter),
    [members, maxGenFilter],
  );
  const maxGen = useMemo(() => Math.max(1, ...members.map(m => m.generationNumber ?? 1)), [members]);
  const treeRoots = useMemo(() => buildFamilyTree(filteredMembers), [filteredMembers]);
  const searching = searchQuery.trim().length > 0;
  const { matchIds, expandIds } = useMemo(
    () => getSearchState(searchQuery, filteredMembers),
    [searchQuery, filteredMembers],
  );
  const layout = useMemo(
    () => computeLayout(treeRoots, collapsedSet, CW, CH, HG, VG),
    [treeRoots, collapsedSet, CW, CH, HG, VG],
  );

  // When search fires, auto-expand ancestors of matches
  useEffect(() => {
    if (searching && expandIds.size > 0) {
      setCollapsedSet(prev => {
        const next = new Set(prev);
        expandIds.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [searching, expandIds]);

  // Focus relatives set
  const focusRelatives = useMemo(() => {
    if (!focusedId || !focusMode) return null;
    const m = members.find(m => m.id === focusedId);
    if (!m) return null;
    const rel = new Set<string>([focusedId]);
    if (m.fatherId)  rel.add(m.fatherId);
    if (m.motherId)  rel.add(m.motherId);
    if (m.spouseId)  rel.add(m.spouseId);
    const layoutNode = layout.nodes.find(n => n.id === focusedId);
    layoutNode?.childrenIds.forEach(id => rel.add(id));
    // Siblings
    members.forEach(sib => {
      if ((sib.fatherId && sib.fatherId === m.fatherId) ||
          (sib.motherId && sib.motherId === m.motherId)) rel.add(sib.id);
    });
    return rel;
  }, [focusedId, focusMode, members, layout]);

  // ── Canvas resize observer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setCvsSize({ w: r.width, h: r.height });
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Fit tree function ──────────────────────────────────────────────────────
  const fitTree = useCallback(() => {
    if (!layout.nodes.length) return;
    const cw2 = canvasRef.current?.clientWidth  ?? cvsSize.w;
    const ch2 = canvasRef.current?.clientHeight ?? cvsSize.h;
    if (!cw2 || !ch2) return;
    const pad = 40;
    const availW = cw2 - pad * 2;
    const availH = ch2 - pad * 2;
    const { w: treeW, h: treeH, x: treeX, y: treeY } = layout.bounds;

    // Height-first fitting: prioritise keeping all generations visible vertically.
    // Very wide trees (134+ members) are expected to overflow horizontally — panning handles that.
    const heightFit = availH / treeH;
    const widthFit  = availW / treeW;

    // Only use min(width,height) when tree is narrow enough to fit comfortably;
    // otherwise let it overflow horizontally at the height-fit zoom.
    const rawZoom = treeW * heightFit <= availW * 1.6
      ? Math.min(heightFit, widthFit)
      : heightFit;

    // Clamp: never below 0.45 (cards become unreadable), never above 1.5 (wastes space)
    const z = Math.max(0.45, Math.min(rawZoom, 1.5));

    setPan({
      x: (cw2 - treeW * z) / 2 - treeX * z,   // centre horizontally
      y: pad - treeY * z,                        // align top with padding
    });
    setZoom(z);
  }, [layout, cvsSize]);

  // Auto-fit once after first render
  useEffect(() => {
    if (!fitted.current && cvsSize.w > 0 && layout.nodes.length > 0) {
      fitTree();
      fitted.current = true;
    }
  }, [cvsSize, layout, fitTree]);

  // Re-fit when layout changes significantly (compact toggle, gen filter)
  const prevNodeCount = useRef(0);
  useEffect(() => {
    if (prevNodeCount.current !== layout.nodes.length && fitted.current) {
      fitTree();
    }
    prevNodeCount.current = layout.nodes.length;
  }, [layout.nodes.length, fitTree]);

  // ── Center on node ─────────────────────────────────────────────────────────
  const centerOnNode = useCallback((id: string) => {
    const n = layout.nodes.find(n => n.id === id);
    if (!n) return;
    const cw2 = canvasRef.current?.clientWidth  ?? cvsSize.w;
    const ch2 = canvasRef.current?.clientHeight ?? cvsSize.h;
    const cx = n.x + CW / 2;
    const cy = n.y + CH / 2;
    setPan({ x: cw2 / 2 - cx * zoom, y: ch2 / 2 - cy * zoom });
  }, [layout, zoom, CW, CH, cvsSize]);

  const handleFocus = useCallback((id: string) => {
    setFocusedId(id);
    centerOnNode(id);
  }, [centerOnNode]);

  // ── Collapse controls ──────────────────────────────────────────────────────
  const toggleCollapse = useCallback((id: string) => {
    setCollapsedSet(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const expandAll  = useCallback(() => setCollapsedSet(new Set()), []);
  const collapseAll = useCallback(() => {
    const rootIds = new Set(treeRoots.map(r => r.member.id));
    setCollapsedSet(new Set(
      layout.nodes.filter(n => n.hasTreeChildren && !rootIds.has(n.id)).map(n => n.id),
    ));
  }, [layout, treeRoots]);

  // ── Wheel zoom (cursor-centered) ───────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const delta = e.ctrlKey ? (e.deltaY > 0 ? -0.08 : 0.08) : (e.deltaY > 0 ? -0.1 : 0.1);
    setZoom(prev => {
      const next = Math.max(0.12, Math.min(2.5, parseFloat((prev + delta).toFixed(2))));
      const factor = next / prev;
      setPan(p => ({ x: cx - (cx - p.x) * factor, y: cy - (cy - p.y) * factor }));
      return next;
    });
  }, []);

  // ── Mouse pan ──────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a,button,input")) return;
    panning.current = true;
    panAnchor.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panning.current) return;
    setPan({
      x: panAnchor.current.px + e.clientX - panAnchor.current.mx,
      y: panAnchor.current.py + e.clientY - panAnchor.current.my,
    });
  }, []);
  const stopPan = useCallback(() => { panning.current = false; }, []);

  // ── Touch pan + pinch zoom ─────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    Array.from(e.changedTouches).forEach(t => {
      touches.current[t.identifier] = { x: t.clientX, y: t.clientY };
    });
    pinchDist.current = null;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const prev = { ...touches.current };
    Array.from(e.changedTouches).forEach(t => {
      touches.current[t.identifier] = { x: t.clientX, y: t.clientY };
    });
    const pts = Object.values(touches.current);
    const rect = canvasRef.current?.getBoundingClientRect();

    if (pts.length >= 2 && rect) {
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (pinchDist.current !== null) {
        const factor = dist / pinchDist.current;
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
        setZoom(z => {
          const next = Math.max(0.12, Math.min(2.5, z * factor));
          const f = next / z;
          setPan(p => ({ x: midX - (midX - p.x) * f, y: midY - (midY - p.y) * f }));
          return next;
        });
      }
      pinchDist.current = dist;
    } else if (pts.length === 1) {
      const t = e.changedTouches[0];
      const p = prev[t.identifier];
      if (p) {
        const dx = t.clientX - p.x;
        const dy = t.clientY - p.y;
        setPan(pp => ({ x: pp.x + dx, y: pp.y + dy }));
      }
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    Array.from(e.changedTouches).forEach(t => { delete touches.current[t.identifier]; });
    if (Object.keys(touches.current).length < 2) pinchDist.current = null;
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = useCallback((v: string) => {
    setSearchInput(v);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setSearchQuery(v), 250);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isLoaded) return (
    <div className="flex flex-col gap-3 h-[calc(100vh-80px)]">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-muted animate-pulse rounded" />
          <div className="h-4 w-52 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex gap-1.5">
          {[1,2,3,4].map(i => <div key={i} className="h-5 w-14 bg-muted animate-pulse rounded-full" />)}
        </div>
      </div>
      <div className="flex gap-2">
        {[140, 100, 90, 80].map((w, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" style={{ width: w }} />)}
      </div>
      <div className="flex-1 rounded-xl border border-border bg-muted/10 flex items-center justify-center">
        <GitBranch className="w-12 h-12 text-muted-foreground/20 animate-pulse" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-400 h-[calc(100vh-80px)]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight">Family Tree</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {members.length} members · {maxGen} generation{maxGen !== 1 ? "s" : ""}
            {layout.nodes.length < members.length && ` · ${layout.nodes.length} shown`}
          </p>
        </div>
        {/* Gen legend */}
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: Math.min(maxGen, 8) }, (_, i) => i + 1).map(gen => {
            const c = gp(gen);
            const labels: Record<number, string> = {
              1: "Founder", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th", 7: "7th", 8: "8th",
            };
            return (
              <div key={gen} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-medium border ${c.bg} ${c.border}`}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                {labels[gen] ?? `Gen ${gen}`}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[140px] max-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search member…"
            className="pl-8 pr-8 h-8 text-sm"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearchQuery(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {searching && <span className="text-xs text-muted-foreground shrink-0">{matchIds.size} match{matchIds.size !== 1 ? "es" : ""}</span>}

        {/* Expand / Collapse */}
        <div className="flex items-center gap-px bg-card border border-border rounded-lg p-0.5">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2" onClick={expandAll}>
            <ChevronDown className="w-3 h-3" />
            <span className="hidden sm:inline">Expand</span>
          </Button>
          <div className="w-px h-4 bg-border" />
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2" onClick={collapseAll}>
            <ChevronUp className="w-3 h-3" />
            <span className="hidden sm:inline">Collapse</span>
          </Button>
        </div>

        {/* Generation filter */}
        <div className="flex items-center gap-px bg-card border border-border rounded-lg p-0.5 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground px-1.5">
            <Layers className="w-3 h-3" />
            <span className="hidden sm:inline">Gen</span>
          </span>
          {Array.from({ length: Math.min(maxGen, 8) }, (_, i) => i + 1).map(gen => {
            const c = gp(gen);
            const active = maxGenFilter === gen;
            return (
              <button
                key={gen}
                onClick={() => setMaxGenFilter(active ? null : gen)}
                className={[
                  "text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors border",
                  active ? `${c.bg} ${c.border} font-semibold` : "text-muted-foreground hover:bg-muted border-transparent",
                ].join(" ")}
              >
                {gen}
              </button>
            );
          })}
          {maxGenFilter !== null && (
            <button onClick={() => setMaxGenFilter(null)} className="px-1 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {/* Compact mode */}
          <Button
            variant={compact ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => { setCompact(c => !c); fitted.current = false; }}
            title="Compact mode — smaller cards, tighter layout"
          >
            <Layers className="w-3 h-3" />
            <span className="hidden sm:inline">{compact ? "Normal" : "Compact"}</span>
          </Button>

          {/* Focus mode */}
          <Button
            variant={focusMode ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => { setFocusMode(f => !f); if (focusMode) setFocusedId(null); }}
            title="Focus mode — click a member to highlight their relatives"
          >
            <Crosshair className="w-3 h-3" />
            <span className="hidden sm:inline">{focusMode ? "Exit Focus" : "Focus"}</span>
          </Button>

          {/* Minimap toggle */}
          <Button
            variant={showMinimap ? "default" : "outline"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setShowMinimap(m => !m)}
            title="Toggle minimap"
          >
            <Map className="w-3 h-3" />
          </Button>

          {/* Fit */}
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={fitTree} title="Fit all members into view">
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">Fit</span>
          </Button>

          {/* Zoom controls */}
          <div className="flex items-center gap-px bg-card border border-border rounded-lg p-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.12, parseFloat((z - 0.1).toFixed(2))))}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs font-medium w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2.5, parseFloat((z + 0.1).toFixed(2))))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Focus mode banner */}
      {focusMode && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
          <Crosshair className="w-3.5 h-3.5" />
          Focus mode active — click any member to highlight their relatives.
          {focusedId && (
            <button className="ml-auto underline hover:no-underline opacity-70 hover:opacity-100" onClick={() => setFocusedId(null)}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[length:22px_22px] relative cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={(e) => {
          // Double-click on the background (not on a card) → reset to best-fit view
          const target = e.target as HTMLElement;
          if (!target.closest("button,a,input,[data-card]")) fitTree();
        }}
        style={{ touchAction: "none" }}
      >
        <div
          ref={innerRef}
          className="absolute"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {layout.nodes.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-center py-20 px-8 min-w-[300px]">
              <GitBranch className="w-12 h-12 text-muted-foreground/30" />
              <div>
                <p className="font-semibold text-muted-foreground">No tree structure yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add parent-child relationships in member edit forms to build the tree.</p>
              </div>
            </div>
          ) : (
            <>
              {/* SVG connector overlay */}
              <svg
                className="absolute pointer-events-none overflow-visible"
                style={{
                  left: 0, top: 0,
                  width: layout.bounds.x + layout.bounds.w + HG,
                  height: layout.bounds.y + layout.bounds.h + VG,
                }}
              >
                <path
                  d={layout.svgPath}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </svg>

              {/* Member cards — absolute positioned */}
              {layout.nodes.map(n => {
                const isCollapsed = collapsedSet.has(n.id);
                const isMatch    = matchIds.has(n.id);
                const isFocused  = focusedId === n.id && focusMode;
                const isFaded    = focusMode && focusedId !== null && focusRelatives !== null
                  ? !focusRelatives.has(n.id)
                  : false;

                const cardStack = (
                  <div
                    key={n.id}
                    className="absolute flex items-center"
                    style={{ left: n.x, top: n.y, gap: SG }}
                  >
                    <MemberCard
                      node={n}
                      cw={CW} ch={CH}
                      isMatch={isMatch}
                      isFocused={isFocused}
                      isFaded={isFaded}
                      isCollapsed={isCollapsed}
                      focusMode={focusMode}
                      onToggle={toggleCollapse}
                      onFocus={handleFocus}
                      member={n.member}
                    />
                    {n.spouse && (
                      <>
                        <Heart className="w-3 h-3 text-rose-400 shrink-0" fill="currentColor" />
                        <MemberCard
                          node={n}
                          cw={CW} ch={CH}
                          isMatch={matchIds.has(n.spouse.id)}
                          isFocused={focusedId === n.spouse.id && focusMode}
                          isFaded={focusMode && focusedId !== null && focusRelatives !== null
                            ? !focusRelatives.has(n.spouse.id) : false}
                          isCollapsed={false}
                          focusMode={focusMode}
                          onToggle={toggleCollapse}
                          onFocus={handleFocus}
                          member={n.spouse}
                          isSpouse
                        />
                      </>
                    )}
                    {/* Collapsed-children badge */}
                    {isCollapsed && n.hasTreeChildren && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 rounded-full bg-muted border border-border text-[8px] text-muted-foreground font-medium whitespace-nowrap"
                        style={{ top: CH + 14 }}
                      >
                        branch hidden
                      </div>
                    )}
                  </div>
                );

                return cardStack;
              })}
            </>
          )}
        </div>

        {/* No-search-match overlay */}
        {searching && matchIds.size === 0 && (
          <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none">
            <div className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground shadow-sm">
              No members found for "{searchQuery}"
            </div>
          </div>
        )}

        {/* Minimap */}
        {showMinimap && layout.nodes.length > 0 && (
          <Minimap
            layout={layout}
            zoom={zoom}
            pan={pan}
            cvsW={cvsSize.w}
            cvsH={cvsSize.h}
            cw={CW}
            ch={CH}
          />
        )}

        {/* Hint */}
        <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground/60 pointer-events-none hidden xl:block">
          Scroll to zoom · Drag to pan · Pinch on mobile
        </div>
      </div>
    </div>
  );
}
