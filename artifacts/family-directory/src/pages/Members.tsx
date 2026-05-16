import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import { MemberCard } from "@/components/members/MemberCard";
import { MemberFilters } from "@/components/members/MemberFilters";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { FamilyMember } from "@/types/family";

export default function Members() {
  const { members, isLoaded } = useFamilyStore();
  const { isAdmin } = useAdminMode();
  const [filteredMembers, setFilteredMembers] = useState<FamilyMember[]>([]);

  // Read all filter query params on mount to support click-through from Statistics
  const initialFilters = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      city:       params.get("city")       ?? "",
      gender:     params.get("gender")     ?? "",
      generation: params.get("generation") ?? "",
      branch:     params.get("branch")     ?? "",
      country:    params.get("country")    ?? "",
      profession: params.get("profession") ?? "",
    };
  }, []);

  if (!isLoaded) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Directory</h1>
          <p className="text-muted-foreground mt-1">Browse and search family members.</p>
        </div>
        {isAdmin && (
          <Link href="/members/new">
            <Button className="gap-2 shrink-0">
              <UserPlus className="w-4 h-4" />
              Add Member
            </Button>
          </Link>
        )}
      </div>

      <MemberFilters
        members={members}
        onFilterChange={setFilteredMembers}
        initialCity={initialFilters.city}
        initialGender={initialFilters.gender}
        initialGeneration={initialFilters.generation}
        initialBranch={initialFilters.branch}
        initialCountry={initialFilters.country}
        initialProfession={initialFilters.profession}
      />

      {filteredMembers.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
          <h3 className="text-lg font-medium text-foreground mb-1">No members found</h3>
          <p className="text-muted-foreground text-sm">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMembers.map(member => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
