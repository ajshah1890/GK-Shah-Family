import { useFamilyStore } from "@/hooks/useFamilyStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { computeGenealogyInsights } from "@/lib/relationships";
import {
  Globe,
  MapPin,
  Users,
  GitBranch,
  TrendingUp,
  ArrowRight,
  Heart,
  Briefcase,
} from "lucide-react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const CLICK_HINT = (
  <span className="text-xs font-normal text-muted-foreground ml-1">
    (click to filter)
  </span>
);

export default function Statistics() {
  const { members, isLoaded } = useFamilyStore();
  const [, navigate] = useLocation();

  const cityData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      if (m.city) counts[m.city] = (counts[m.city] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [members]);

  const branchData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      if (m.mainFamilyBranch)
        counts[m.mainFamilyBranch] = (counts[m.mainFamilyBranch] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [members]);

  // Store the generation label alongside the display name so click-through
  // can pass the exact label string that MemberFilters uses for filtering.
  const genData = useMemo(() => {
    const counts: Record<number, { count: number; label: string }> = {};
    members.forEach((m) => {
      const g = m.generationNumber ?? 0;
      if (g > 0) {
        if (!counts[g]) counts[g] = { count: 0, label: m.generation ?? `Gen ${g}` };
        counts[g].count++;
      }
    });
    return Object.entries(counts)
      .map(([gen, { count, label }]) => ({
        name: `Gen ${gen}`,
        value: count,
        label,
      }))
      .sort(
        (a, b) =>
          parseInt(a.name.split(" ")[1]) - parseInt(b.name.split(" ")[1])
      );
  }, [members]);

  const genderData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      if (m.gender) counts[m.gender] = (counts[m.gender] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [members]);

  const professionData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      if (m.profession) counts[m.profession] = (counts[m.profession] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [members]);

  const countryData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      if (m.country) counts[m.country] = (counts[m.country] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [members]);

  const insights = useMemo(
    () => computeGenealogyInsights(members),
    [members]
  );

  const memberStats = useMemo(() => {
    const withBirthday = members.filter((m) => m.birthday).length;
    const withPhone = members.filter((m) => m.phone || m.whatsapp).length;
    const withPhoto = members.filter(
      (m) => m.photo && !m.photo.startsWith("https://api.dicebear.com")
    ).length;
    const married = members.filter((m) => m.spouseId || m.spouseName).length;
    return { withBirthday, withPhone, withPhoto, married };
  }, [members]);

  if (!isLoaded) return null;

  if (members.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold font-serif">No Data Available</h2>
        <p className="text-muted-foreground mt-2">
          Add family members to see statistics.
        </p>
      </div>
    );
  }

  const tooltipStyle = {
    contentStyle: {
      borderRadius: "8px",
      border: "1px solid hsl(var(--border))",
    },
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">
          Family Insights
        </h1>
        <p className="text-muted-foreground mt-1">
          Demographics and genealogy analytics for {members.length} members.
        </p>
      </div>

      {/* ── Genealogy Insight Metrics ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-serif font-semibold">Genealogy Snapshot</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Total Members</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold">
                  {
                    Object.keys(insights.generationCounts).filter(
                      (g) => Number(g) > 0
                    ).length
                  }
                </p>
                <p className="text-xs text-muted-foreground">Generations</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold">
                  {insights.countrySpread}
                </p>
                <p className="text-xs text-muted-foreground">Countries</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold">
                  {insights.citySpread}
                </p>
                <p className="text-xs text-muted-foreground">Cities</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile completeness row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold">
                  {memberStats.married}
                </p>
                <p className="text-xs text-muted-foreground">Married</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold">
                  {memberStats.withPhone}
                </p>
                <p className="text-xs text-muted-foreground">With Contact</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold">
                  {memberStats.withPhoto}
                </p>
                <p className="text-xs text-muted-foreground">With Photo</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold">
                  {memberStats.withBirthday}
                </p>
                <p className="text-xs text-muted-foreground">Birthday Known</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Longest lineage chain */}
          {insights.longestChain.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Longest Lineage Chain ({insights.longestChain.length}{" "}
                  generations)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-1.5">
                  {insights.longestChain.members.map((m, i) => (
                    <span key={m.id} className="flex items-center gap-1.5">
                      <Link
                        href={`/members/${m.id}`}
                        className="text-sm font-medium hover:text-primary hover:underline transition-colors"
                      >
                        {m.fullName.split(" ")[0]}
                      </Link>
                      {i < insights.longestChain.members.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Root: {insights.longestChain.members[0]?.fullName} →
                  Deepest:{" "}
                  {
                    insights.longestChain.members[
                      insights.longestChain.members.length - 1
                    ]?.fullName
                  }
                </p>
              </CardContent>
            </Card>
          )}

          {/* Largest sibling group */}
          {insights.largestSiblingGroup.count > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Largest Sibling Group (
                  {insights.largestSiblingGroup.count} children)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.largestSiblingGroup.parent && (
                  <p className="text-sm text-muted-foreground mb-2">
                    Children of{" "}
                    <Link
                      href={`/members/${insights.largestSiblingGroup.parent.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline transition-colors"
                    >
                      {insights.largestSiblingGroup.parent.fullName}
                    </Link>
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {insights.largestSiblingGroup.children
                    .slice(0, 8)
                    .map((child) => (
                      <Link key={child.id} href={`/members/${child.id}`}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted border border-border hover:border-primary hover:text-primary transition-colors cursor-pointer">
                          {child.fullName.split(" ")[0]}
                        </span>
                      </Link>
                    ))}
                  {insights.largestSiblingGroup.children.length > 8 && (
                    <span className="text-xs text-muted-foreground">
                      +{insights.largestSiblingGroup.children.length - 8} more
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* ── Charts ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-serif font-semibold">Demographics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Top Cities — clickable */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">
                Top Cities {CLICK_HINT}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={cityData}
                    margin={{ top: 16, right: 16, left: 0, bottom: 4 }}
                    onClick={(data) => {
                      const name = data?.activePayload?.[0]?.payload?.name;
                      if (name) navigate(`/members?city=${encodeURIComponent(name)}`);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={28} />
                    <Tooltip cursor={{ fill: "hsl(var(--accent))" }} {...tooltipStyle} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Members" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Members per Generation — clickable */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">
                Members per Generation {CLICK_HINT}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={genData}
                    margin={{ top: 16, right: 16, left: 0, bottom: 4 }}
                    onClick={(data) => {
                      const label = data?.activePayload?.[0]?.payload?.label;
                      if (label) navigate(`/members?generation=${encodeURIComponent(label)}`);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={28} />
                    <Tooltip cursor={{ fill: "hsl(var(--accent))" }} {...tooltipStyle} />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Members" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Family Branches — clickable pie */}
          {branchData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">
                  Main Family Branches {CLICK_HINT}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={branchData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        style={{ cursor: "pointer" }}
                        onClick={(data) => {
                          if (data?.name) navigate(`/members?branch=${encodeURIComponent(data.name)}`);
                        }}
                      >
                        {branchData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                      <Legend iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gender Distribution — clickable pie */}
          {genderData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">
                  Gender Distribution {CLICK_HINT}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        style={{ cursor: "pointer" }}
                        onClick={(data) => {
                          if (data?.name) navigate(`/members?gender=${encodeURIComponent(data.name)}`);
                        }}
                      >
                        {genderData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                      <Legend iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Professions — clickable */}
          {professionData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">
                  Top Professions {CLICK_HINT}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={professionData}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                      onClick={(data) => {
                        const name = data?.activePayload?.[0]?.payload?.name;
                        if (name) navigate(`/members?profession=${encodeURIComponent(name)}`);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={90} />
                      <Tooltip cursor={{ fill: "hsl(var(--accent))" }} {...tooltipStyle} />
                      <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} name="Members" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Countries — clickable */}
          {countryData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">
                  Countries {CLICK_HINT}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={countryData}
                      margin={{ top: 16, right: 16, left: 0, bottom: 4 }}
                      onClick={(data) => {
                        const name = data?.activePayload?.[0]?.payload?.name;
                        if (name) navigate(`/members?country=${encodeURIComponent(name)}`);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={28} />
                      <Tooltip cursor={{ fill: "hsl(var(--accent))" }} {...tooltipStyle} />
                      <Bar dataKey="value" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} name="Members" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
