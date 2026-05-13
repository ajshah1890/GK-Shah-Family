import { FamilyMember } from "@/types/family";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Briefcase } from "lucide-react";
import { Link } from "wouter";

interface MemberCardProps {
  member: FamilyMember;
}

export function MemberCard({ member }: MemberCardProps) {
  const renderGenerationBadge = (gen?: string) => {
    if (!gen) return null;
    let colorClass = "bg-muted text-muted-foreground border-border";
    if (gen.includes("1st")) colorClass = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50";
    else if (gen.includes("2nd")) colorClass = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50";
    else if (gen.includes("3rd")) colorClass = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50";
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colorClass}`}>
        {gen}
      </span>
    );
  };

  return (
    <Link href={`/members/${member.id}`}>
      <Card className="hover-elevate cursor-pointer overflow-hidden group border border-border transition-all">
        <CardContent className="p-0">
          <div className="p-5 flex flex-col items-center text-center border-b border-border/50 bg-card">
            <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-background shadow-sm bg-muted relative">
              {member.photo ? (
                <img 
                  src={member.photo} 
                  alt={member.fullName} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-3xl font-serif font-bold">
                  {member.fullName.charAt(0)}
                </div>
              )}
            </div>
            <h3 className="font-serif font-bold text-lg group-hover:text-primary transition-colors line-clamp-1 w-full mb-2">
              {member.fullName}
            </h3>
            
            <div className="flex flex-col gap-1.5 items-center w-full">
              <div className="flex flex-wrap justify-center gap-1">
                {member.mainFamilyBranch && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                    {member.mainFamilyBranch}
                  </span>
                )}
                {member.subFamilyBranch && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border/50">
                    {member.subFamilyBranch}
                  </span>
                )}
              </div>
              {renderGenerationBadge(member.generation)}
            </div>
          </div>
          
          <div className="p-4 bg-muted/20 space-y-2 text-sm text-muted-foreground">
            {member.city && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate">{member.city}{member.country ? `, ${member.country}` : ''}</span>
              </div>
            )}
            {member.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate">{member.phone}</span>
              </div>
            )}
            {member.profession && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate">{member.profession}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
