import { FamilyMember } from "@/types/family";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Briefcase } from "lucide-react";
import { Link } from "wouter";

interface MemberCardProps {
  member: FamilyMember;
}

export function MemberCard({ member }: MemberCardProps) {
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
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-3xl font-serif font-bold">
                  {member.fullName.charAt(0)}
                </div>
              )}
            </div>
            <h3 className="font-serif font-bold text-lg group-hover:text-primary transition-colors line-clamp-1 w-full">
              {member.fullName}
            </h3>
            <p className="text-sm font-medium text-primary/80 mb-1">{member.relationship}</p>
            {member.familyBranch && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                {member.familyBranch}
              </span>
            )}
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
