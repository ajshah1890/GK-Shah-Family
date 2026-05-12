import { useFamilyStore } from "@/hooks/useFamilyStore";
import { StatCard } from "@/components/dashboard/StatCard";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { Users, UserPlus, FileText, PieChart } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { members, isLoaded } = useFamilyStore();

  if (!isLoaded) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Members" 
          value={members.length} 
          icon={<Users className="w-5 h-5" />} 
          description="Across all family branches"
        />
        <div className="col-span-1 lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
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
          <Link href="/settings" className="block group col-span-2 md:col-span-1">
            <div className="h-full bg-card hover:bg-accent border border-border p-4 rounded-xl transition-colors flex flex-col items-center justify-center text-center gap-2">
              <div className="p-3 bg-muted text-muted-foreground rounded-full group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <span className="font-medium">Export Data</span>
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingEvents members={members} type="birthday" />
        <UpcomingEvents members={members} type="anniversary" />
      </div>
    </div>
  );
}
