import { useFamilyStore } from "@/hooks/useFamilyStore";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { StatCard } from "@/components/dashboard/StatCard";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { Users, UserPlus, FileText, PieChart, Info, MapPin, Download, GitBranch } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useState, useEffect, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Dashboard() {
  const { members, isLoaded } = useFamilyStore();
  const { canInstall, install } = usePWAInstall();
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);

  useNotifications(members);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShowNotificationBanner(true);
    }
  }, []);

  const requestNotifications = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(() => {
        setShowNotificationBanner(false);
      });
    }
  };

  const { thisMonthAdded, topCity, generationStats, recentMembers } = useMemo(() => {
    const now = new Date();
    let thisMonthCount = 0;
    const cityCounts: Record<string, number> = {};
    const genCounts: Record<string, number> = {};

    members.forEach(m => {
      // Added this month
      if (m.addedAt) {
        const addedDate = new Date(m.addedAt);
        if (addedDate.getMonth() === now.getMonth() && addedDate.getFullYear() === now.getFullYear()) {
          thisMonthCount++;
        }
      }
      
      // Cities
      if (m.city) {
        cityCounts[m.city] = (cityCounts[m.city] || 0) + 1;
      }
      
      // Generations
      if (m.generation) {
        let shortGen = m.generation.replace(" Generation", "");
        genCounts[shortGen] = (genCounts[shortGen] || 0) + 1;
      }
    });

    let topC = "N/A";
    let maxC = 0;
    for (const [city, count] of Object.entries(cityCounts)) {
      if (count > maxC) {
        maxC = count;
        topC = city;
      }
    }

    const genString = Object.entries(genCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([g, c]) => `${g}: ${c}`)
      .join(", ") || "No generation data";

    // Recent 3 members
    const sortedMembers = [...members].sort((a, b) => {
      if (a.addedAt && b.addedAt) {
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      }
      return 0; // Fallback to id ordering loosely
    }).slice(0, 3);

    return { 
      thisMonthAdded: thisMonthCount, 
      topCity: topC !== "N/A" ? `${topC} (${maxC})` : topC,
      generationStats: genString,
      recentMembers: sortedMembers
    };
  }, [members]);

  if (!isLoaded) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {canInstall && (
        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-400">
          <Download className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <AlertTitle>Install App</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <span>Install the G K Shah Family Directory on your device for the best offline experience.</span>
            <Button size="sm" variant="outline" className="shrink-0 bg-background" onClick={install}>
              Install App
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showNotificationBanner && (
        <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-400">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
          <AlertTitle>Enable Notifications</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <span>Enable notifications to get birthday and anniversary reminders at 8 AM every day.</span>
            <Button size="sm" variant="outline" className="shrink-0 bg-background" onClick={requestNotifications}>
              Enable Notifications
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="bg-card rounded-xl p-8 border border-border text-center sm:text-left flex flex-col sm:flex-row items-center sm:justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <h2 className="text-3xl font-serif font-bold text-foreground">Welcome to the G K Shah Family Directory</h2>
          <p className="text-muted-foreground max-w-xl">
            A digital home to stay connected, celebrate milestones, and keep our family network strong across generations and borders.
          </p>
        </div>
        <div className="relative z-10 shrink-0">
          <Link href="/members/new">
            <Button size="lg" className="rounded-full shadow-sm hover:shadow-md transition-all gap-2">
              <UserPlus className="w-4 h-4" />
              Add Family Member
            </Button>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Members" 
          value={members.length} 
          icon={<Users className="w-5 h-5" />} 
          description="Across all branches"
        />
        <StatCard 
          title="Added This Month" 
          value={thisMonthAdded} 
          icon={<UserPlus className="w-5 h-5 text-green-500" />} 
          description="New additions"
        />
        <StatCard 
          title="Top City" 
          value={topCity.split(' ')[0] || "N/A"} 
          icon={<MapPin className="w-5 h-5 text-amber-500" />} 
          description={topCity}
        />
        <StatCard 
          title="Generations" 
          value={members.some(m => m.generation) ? members.filter(m => m.generation).length : 0} 
          icon={<GitBranch className="w-5 h-5 text-blue-500" />} 
          description={generationStats}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingEvents members={members} type="birthday" />
        <UpcomingEvents members={members} type="anniversary" />
      </div>

      {recentMembers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-serif font-bold">Recently Added</h3>
            <Link href="/members" className="text-sm text-primary hover:underline font-medium">View All</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentMembers.map(member => (
              <Link key={member.id} href={`/members/${member.id}`}>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-background shadow-sm bg-muted shrink-0">
                    {member.photo ? (
                      <img src={member.photo} alt={member.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-serif font-bold">
                        {member.fullName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold font-serif truncate">{member.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.city || member.mainFamilyBranch || "No location details"}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
        <Link href="/members" className="block group">
          <div className="h-full bg-card hover:bg-accent border border-border p-4 rounded-xl transition-colors flex flex-col items-center justify-center text-center gap-2">
            <div className="p-3 bg-primary/10 text-primary rounded-full group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <span className="font-medium">Browse Directory</span>
          </div>
        </Link>
        <Link href="/statistics" className="block group">
          <div className="h-full bg-card hover:bg-accent border border-border p-4 rounded-xl transition-colors flex flex-col items-center justify-center text-center gap-2">
            <div className="p-3 bg-secondary text-secondary-foreground rounded-full group-hover:scale-110 transition-transform">
              <PieChart className="w-6 h-6" />
            </div>
            <span className="font-medium">Family Insights</span>
          </div>
        </Link>
        <Link href="/import" className="block group">
          <div className="h-full bg-card hover:bg-accent border border-border p-4 rounded-xl transition-colors flex flex-col items-center justify-center text-center gap-2">
            <div className="p-3 bg-muted text-muted-foreground rounded-full group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <span className="font-medium">Import / Export</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
