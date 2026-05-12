import { useFamilyStore } from "@/hooks/useFamilyStore";
import { MemberCard } from "@/components/members/MemberCard";
import { MemberFilters } from "@/components/members/MemberFilters";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { FamilyMember } from "@/types/family";

export default function Members() {
  const { members, isLoaded } = useFamilyStore();
  const [filteredMembers, setFilteredMembers] = useState<FamilyMember[]>([]);

  if (!isLoaded) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Directory</h1>
          <p className="text-muted-foreground mt-1">Browse and search family members.</p>
        </div>
        <Link href="/members/new">
          <Button className="gap-2 shrink-0">
            <UserPlus className="w-4 h-4" />
            Add Member
          </Button>
        </Link>
      </div>

      <MemberFilters 
        members={members} 
        onFilterChange={setFilteredMembers} 
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
