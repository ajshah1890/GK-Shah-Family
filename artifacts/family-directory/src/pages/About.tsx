import { Card, CardContent } from "@/components/ui/card";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useMemo } from "react";
import { Link } from "wouter";
import { Users, Globe, GitBranch, Heart, BookOpen, Camera } from "lucide-react";

export default function About() {
  const { members, isLoaded } = useFamilyStore();

  const stats = useMemo(() => {
    if (!isLoaded || members.length === 0) return null;
    const countries = new Set(members.map(m => m.country).filter(Boolean));
    const cities = new Set(members.map(m => m.city).filter(Boolean));
    const generations = new Set(members.map(m => m.generationNumber).filter(n => n && n > 0));
    return {
      total: members.length,
      countries: countries.size,
      cities: cities.size,
      generations: generations.size,
    };
  }, [members, isLoaded]);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="text-center pt-4">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-4xl mx-auto mb-4 shadow-md">
          S
        </div>
        <h1 className="text-4xl font-serif font-bold tracking-tight">G K Shah Family</h1>
        <p className="text-muted-foreground mt-2 text-lg">A chronicle of roots, branches, and bonds</p>
      </div>

      {/* Live stats banner */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-serif font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Members</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-serif font-bold text-blue-600 dark:text-blue-400">{stats.generations}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Generations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-serif font-bold text-green-600 dark:text-green-400">{stats.countries}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Countries</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-serif font-bold text-amber-600 dark:text-amber-400">{stats.cities}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cities</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Origin story */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-serif font-semibold">Our Story</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            The G K Shah family traces its roots to the vibrant culture of Gujarat, India. 
            Founded on values of hard work, education, and close-knit family bonds, our 
            lineage has grown across generations — from humble beginnings in a single 
            ancestral home to a sprawling family spread across India and beyond.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Shri G K Shah — the patriarch after whom this chronicle is named — embodied 
            the spirit of the family: dedication to community, respect for tradition, and 
            an unwavering belief in the next generation. His legacy lives on through every 
            branch of this directory.
          </p>
        </CardContent>
      </Card>

      {/* Values */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-serif font-semibold">Family Values</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: "Unity", desc: "We celebrate every milestone together — births, weddings, and achievements." },
              { title: "Heritage", desc: "We honour our Gujarati roots while embracing the wider world." },
              { title: "Education", desc: "Every generation has strived to learn, grow, and contribute." },
              { title: "Service", desc: "Giving back to community is a cornerstone of who we are." },
            ].map(v => (
              <div key={v.title} className="bg-muted/40 rounded-lg p-4">
                <p className="font-semibold font-serif text-foreground mb-1">{v.title}</p>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* About this app */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-serif font-semibold">About This Directory</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            This private, mobile-first web app is the digital home of the G K Shah Family 
            Chronicle. It stores all data locally on your device — nothing is sent to any 
            server — so your family's information stays completely private.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>Browse and search the full family directory with smart multi-field search</span>
            </li>
            <li className="flex items-start gap-2">
              <GitBranch className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>Explore the interactive family tree and discover kinship between any two members</span>
            </li>
            <li className="flex items-start gap-2">
              <Camera className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>Capture and preserve special family moments with the Moments journal</span>
            </li>
            <li className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>Never miss a birthday or anniversary with the dashboard's upcoming reminders</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Quick navigation */}
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
