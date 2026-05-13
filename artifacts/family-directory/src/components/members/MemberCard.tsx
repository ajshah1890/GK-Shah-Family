import { FamilyMember } from "@/types/family";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Briefcase, MessageCircle, Mail } from "lucide-react";
import { useLocation } from "wouter";

interface MemberCardProps {
  member: FamilyMember;
}

const GEN_COLORS: Record<string, string> = {
  "1st": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50",
  "2nd": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50",
  "3rd": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50",
  "4th": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50",
  "5th": "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/50",
  "6th": "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800/50",
  "7th": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/50",
  "8th": "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/50",
};

function getGenColor(gen?: string): string {
  if (!gen) return "bg-muted text-muted-foreground border-border";
  const match = gen.match(/^(\d+)/);
  const num = match ? match[1] : "";
  return GEN_COLORS[`${num}th`] ?? GEN_COLORS[`${num}st`] ?? GEN_COLORS[`${num}nd`] ?? GEN_COLORS[`${num}rd`] ?? "bg-muted text-muted-foreground border-border";
}

function getGenColorByLabel(gen: string): string {
  for (const [key, cls] of Object.entries(GEN_COLORS)) {
    if (gen.toLowerCase().startsWith(key.replace("th","").replace("st","").replace("nd","").replace("rd",""))) {
      return cls;
    }
  }
  return "bg-muted text-muted-foreground border-border";
}

export function MemberCard({ member }: MemberCardProps) {
  const [, setLocation] = useLocation();
  const hasPhoto = !!member.photo && !member.photo.startsWith("idb:");

  const genColorClass = member.generation ? (() => {
    for (const [key, cls] of Object.entries(GEN_COLORS)) {
      const prefix = key.replace(/[^\d]/g, "");
      if (member.generation.startsWith(prefix)) return cls;
    }
    return "bg-muted text-muted-foreground border-border";
  })() : "bg-muted text-muted-foreground border-border";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => setLocation(`/members/${member.id}`)}
      onKeyDown={e => { if (e.key === "Enter") setLocation(`/members/${member.id}`); }}
      className="block"
    >
      <Card className="hover-elevate cursor-pointer overflow-hidden group border border-border transition-all hover:shadow-md hover:border-primary/20">
        <CardContent className="p-0">
          <div className="p-5 flex flex-col items-center text-center border-b border-border/50 bg-card relative">
            <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-background shadow-sm bg-muted relative">
              {hasPhoto ? (
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
              {member.generation && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${genColorClass}`}>
                  {member.generation}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 bg-muted/20 space-y-2 text-sm text-muted-foreground">
            {member.city && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <span className="truncate">{member.city}{member.country ? `, ${member.country}` : ""}</span>
              </div>
            )}
            {member.profession && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <span className="truncate">{member.profession}{member.company ? ` · ${member.company}` : ""}</span>
              </div>
            )}

            {/* Quick-action contact row — shown if any contact exists */}
            {(member.phone || member.whatsapp || member.email) && (
              <div
                className="flex items-center gap-1.5 pt-1 border-t border-border/40"
                onClick={e => e.preventDefault()}
              >
                {(member.whatsapp || member.phone) && (
                  <a
                    href={`https://wa.me/${(member.whatsapp || member.phone)!.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 text-[11px] font-medium transition-colors"
                    onClick={e => e.stopPropagation()}
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-3 h-3" />
                    Chat
                  </a>
                )}
                {member.phone && (
                  <a
                    href={`tel:${member.phone}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors"
                    onClick={e => e.stopPropagation()}
                    title="Call"
                  >
                    <Phone className="w-3 h-3" />
                    Call
                  </a>
                )}
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-[11px] font-medium transition-colors"
                    onClick={e => e.stopPropagation()}
                    title="Email"
                  >
                    <Mail className="w-3 h-3" />
                    Email
                  </a>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
