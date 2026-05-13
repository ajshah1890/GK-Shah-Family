import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useAdminMode } from "@/hooks/useAdminMode";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, Phone, Mail, MapPin, Briefcase, Calendar, Heart, MessageCircle, Share2, Globe, Linkedin, Instagram, GitBranch, Users, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { getAncestryPath, getDescendants } from "@/lib/familyTree";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function MemberProfile() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { members, deleteMember, isLoaded } = useFamilyStore();
  const { isAdmin } = useAdminMode();
  
  const ancestryPath = useMemo(
    () => (id ? getAncestryPath(id, members) : []),
    [id, members]
  );
  const descendants = useMemo(
    () => (id ? getDescendants(id, members) : []),
    [id, members]
  );

  if (!isLoaded) return null;

  const member = members.find(m => m.id === id);

  if (!member) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Member not found</h2>
        <Button onClick={() => setLocation("/members")} className="mt-4">
          Return to Directory
        </Button>
      </div>
    );
  }

  const handleDelete = () => {
    if (member.id) {
      deleteMember(member.id);
      toast.success(`${member.fullName} has been removed from the directory.`);
      setLocation("/members");
    }
  };

  const shareText = `Check out ${member.fullName}'s profile in the G K Shah Family Directory!`;
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const renderGenerationBadge = (gen?: string) => {
    if (!gen) return null;
    let colorClass = "bg-muted text-muted-foreground border-border";
    if (gen.includes("1st")) colorClass = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50";
    else if (gen.includes("2nd")) colorClass = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50";
    else if (gen.includes("3rd")) colorClass = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50";
    
    return (
      <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
        {gen}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pb-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/members")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={shareUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 className="w-4 h-4" />
              Share on WhatsApp
            </Button>
          </a>
          {isAdmin && (
            <>
              <Link href={`/members/${member.id}/edit`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete {member.fullName}'s profile from the directory.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Ancestry Breadcrumb */}
      {ancestryPath.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-sm text-muted-foreground">
          <GitBranch className="w-3.5 h-3.5 shrink-0" />
          {ancestryPath.map((ancestor, i) => (
            <span key={ancestor.id} className="flex items-center gap-1.5">
              <Link href={`/members/${ancestor.id}`} className="hover:text-foreground hover:underline transition-colors">
                {ancestor.fullName}
              </Link>
              <ChevronRight className="w-3 h-3 shrink-0" />
            </span>
          ))}
          <span className="font-medium text-foreground">{member?.fullName}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Photo & Primary Info */}
        <div className="space-y-6">
          <Card className="overflow-hidden border-border bg-card text-center relative pt-12 pb-6 px-6">
            <div className="absolute top-0 inset-x-0 h-24 bg-primary/10"></div>
            <div className="relative z-10 w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-card shadow-md bg-muted mb-4">
              {member.photo ? (
                <img src={member.photo} alt={member.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-4xl font-serif font-bold">
                  {member.fullName.charAt(0)}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-1">{member.fullName}</h1>
            {member.gender && <p className="text-sm text-muted-foreground mb-4">{member.gender}</p>}
            
            <div className="flex flex-col items-center gap-2 mb-6">
              {member.mainFamilyBranch && (
                <div className="inline-block px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
                  {member.mainFamilyBranch}
                </div>
              )}
              {member.subFamilyBranch && (
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-medium">
                  {member.subFamilyBranch}
                </div>
              )}
              {renderGenerationBadge(member.generation)}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {member.phone && (
                <Button size="icon" variant="outline" className="rounded-full h-10 w-10" asChild>
                  <a href={`tel:${member.phone}`} title="Call"><Phone className="h-4 w-4 text-primary" /></a>
                </Button>
              )}
              {member.whatsapp && (
                <Button size="icon" variant="outline" className="rounded-full h-10 w-10" asChild>
                  <a href={`https://wa.me/${member.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                    <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </a>
                </Button>
              )}
              {member.email && (
                <Button size="icon" variant="outline" className="rounded-full h-10 w-10" asChild>
                  <a href={`mailto:${member.email}`} title="Email"><Mail className="h-4 w-4 text-primary" /></a>
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-8">
              {/* Personal Details */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Personal Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(member.birthday || member.anniversary || member.bloodGroup || member.nativePlace) ? (
                    <>
                      {member.birthday && (() => {
                        try { const d = parseISO(member.birthday); return (
                          <div className="flex gap-3">
                            <Calendar className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm text-muted-foreground">Birthday</p>
                              <p className="font-medium">{format(d, "MMMM d, yyyy")}</p>
                            </div>
                          </div>
                        ); } catch { return null; }
                      })()}
                      {member.anniversary && (() => {
                        try { const d = parseISO(member.anniversary); return (
                          <div className="flex gap-3">
                            <Heart className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm text-muted-foreground">Anniversary</p>
                              <p className="font-medium">{format(d, "MMMM d, yyyy")}</p>
                            </div>
                          </div>
                        ); } catch { return null; }
                      })()}
                      {member.bloodGroup && (
                        <div className="flex gap-3">
                          <div className="w-5 h-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                            {member.bloodGroup.replace(/[^ABO]/g, '')}
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Blood Group</p>
                            <p className="font-medium">{member.bloodGroup}</p>
                          </div>
                        </div>
                      )}
                      {member.nativePlace && (
                        <div className="flex gap-3">
                          <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Native Place</p>
                            <p className="font-medium">{member.nativePlace}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic col-span-full">No personal details provided.</p>
                  )}
                </div>
              </section>

              {/* Contact & Location */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Contact & Location</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(member.phone || member.email || member.city || member.address || member.personalWebsite || member.linkedIn || member.instagram) ? (
                    <>
                      {member.phone && (
                        <div className="flex gap-3">
                          <Phone className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Phone</p>
                            <p className="font-medium">{member.phone}</p>
                          </div>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex gap-3">
                          <Mail className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-medium">{member.email}</p>
                          </div>
                        </div>
                      )}
                      {(member.city || member.country) && (
                        <div className="flex gap-3">
                          <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Location</p>
                            <p className="font-medium">
                              {[member.city, member.country].filter(Boolean).join(", ")}
                            </p>
                          </div>
                        </div>
                      )}
                      {member.address && (
                        <div className="flex gap-3 col-span-full">
                          <MapPin className="w-5 h-5 text-transparent shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Address</p>
                            <p className="font-medium">{member.address}</p>
                          </div>
                        </div>
                      )}
                      {member.mapsLink && (
                        <div className="flex gap-3 col-span-full">
                          <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Google Maps</p>
                            <a
                              href={member.mapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              Open Address in Maps
                            </a>
                          </div>
                        </div>
                      )}
                      {member.personalWebsite && (
                        <div className="flex gap-3">
                          <Globe className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Website</p>
                            <a href={member.personalWebsite} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline truncate inline-block max-w-[200px]">
                              {new URL(member.personalWebsite).hostname}
                            </a>
                          </div>
                        </div>
                      )}
                      {member.linkedIn && (
                        <div className="flex gap-3">
                          <Linkedin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">LinkedIn</p>
                            <a href={member.linkedIn} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline truncate inline-block max-w-[200px]">
                              View Profile
                            </a>
                          </div>
                        </div>
                      )}
                      {member.instagram && (
                        <div className="flex gap-3">
                          <Instagram className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Instagram</p>
                            <p className="font-medium">{member.instagram}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic col-span-full">No contact details provided.</p>
                  )}
                </div>
              </section>

              {/* Profession & Education */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Profession & Education</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(member.profession || member.company || member.education || member.businessName || member.previousCompany) ? (
                    <>
                      {(member.profession || member.company) && (
                        <div className="flex gap-3 col-span-full">
                          <Briefcase className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Current Work</p>
                            <p className="font-medium">
                              {member.profession} {member.company && `at ${member.company}`}
                            </p>
                          </div>
                        </div>
                      )}
                      {member.businessName && (
                        <div className="flex gap-3 col-span-full">
                          <Briefcase className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Business</p>
                            <p className="font-medium">{member.businessName}</p>
                          </div>
                        </div>
                      )}
                      {member.previousCompany && (
                        <div className="flex gap-3 col-span-full">
                          <Briefcase className="w-5 h-5 text-muted-foreground opacity-50 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Previous Work</p>
                            <p className="font-medium text-muted-foreground">{member.previousCompany}</p>
                          </div>
                        </div>
                      )}
                      {member.education && (
                        <div className="flex gap-3 col-span-full">
                          <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 font-serif font-bold text-lg text-muted-foreground">
                            E
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Education</p>
                            <p className="font-medium">{member.education}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic col-span-full">No professional details provided.</p>
                  )}
                </div>
              </section>

              {/* Personal Interests */}
              {(member.hobbies || member.skills || member.languagesSpoken || member.emergencyContact) && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Personal</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {member.hobbies && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1.5">Hobbies</p>
                        <div className="flex flex-wrap gap-1.5">
                          {member.hobbies.split(',').map((h, i) => (
                            <Badge key={i} variant="secondary" className="font-normal">{h.trim()}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {member.skills && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1.5">Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {member.skills.split(',').map((s, i) => (
                            <Badge key={i} variant="outline" className="font-normal">{s.trim()}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {member.languagesSpoken && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Languages Spoken</p>
                        <p className="font-medium">{member.languagesSpoken}</p>
                      </div>
                    )}
                    {member.emergencyContact && (
                      <div className="mt-2 p-3 bg-destructive/5 rounded-md border border-destructive/10">
                        <p className="text-sm text-destructive mb-1 font-medium">Emergency Contact</p>
                        <p className="font-medium">{member.emergencyContact}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}
              
              {/* Family Connections */}
              {(member.spouseName || member.spouseId || member.fatherId || member.motherId || (member.childrenNames && member.childrenNames.length > 0)) && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Family Connections</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {member.fatherId && (() => {
                      const father = members.find(m => m.id === member.fatherId);
                      return father ? (
                        <div>
                          <p className="text-sm text-muted-foreground">Father</p>
                          <Link href={`/members/${father.id}`} className="font-medium text-primary hover:underline">
                            {father.fullName}
                          </Link>
                        </div>
                      ) : null;
                    })()}
                    {member.motherId && (() => {
                      const mother = members.find(m => m.id === member.motherId);
                      return mother ? (
                        <div>
                          <p className="text-sm text-muted-foreground">Mother</p>
                          <Link href={`/members/${mother.id}`} className="font-medium text-primary hover:underline">
                            {mother.fullName}
                          </Link>
                        </div>
                      ) : null;
                    })()}
                    {(member.spouseName || member.spouseId) && (
                      <div>
                        <p className="text-sm text-muted-foreground">Spouse</p>
                        {member.spouseId ? (() => {
                          const spouse = members.find(m => m.id === member.spouseId);
                          return spouse ? (
                            <Link href={`/members/${spouse.id}`} className="font-medium text-primary hover:underline">
                              {spouse.fullName}
                            </Link>
                          ) : <p className="font-medium">{member.spouseName}</p>;
                        })() : (
                          <p className="font-medium">{member.spouseName}</p>
                        )}
                      </div>
                    )}
                    {member.childrenNames && member.childrenNames.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Children</p>
                        <ul className="list-disc list-inside pl-1 mt-1">
                          {member.childrenNames.map((child, i) => (
                            <li key={i} className="font-medium">{child}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Family Position */}
              {(descendants.length > 0 || member.generationNumber) && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Family Position</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {member.generationNumber && (
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-serif font-bold text-primary">{member.generationNumber}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Generation</p>
                      </div>
                    )}
                    {descendants.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-serif font-bold text-primary">{descendants.length}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Descendants</p>
                      </div>
                    )}
                    {ancestryPath.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-serif font-bold text-primary">{ancestryPath.length}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Generations up</p>
                      </div>
                    )}
                  </div>
                  {descendants.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Descendants include:{" "}
                        {descendants.slice(0, 3).map((d, i) => (
                          <span key={d.id}>
                            <Link href={`/members/${d.id}`} className="text-primary hover:underline font-medium">
                              {d.fullName}
                            </Link>
                            {i < Math.min(2, descendants.length - 1) ? ", " : ""}
                          </span>
                        ))}
                        {descendants.length > 3 && (
                          <span className="text-muted-foreground"> and {descendants.length - 3} more</span>
                        )}
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* Notes */}
              {member.notes && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Notes</h3>
                  <p className="whitespace-pre-wrap">{member.notes}</p>
                </section>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
