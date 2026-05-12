import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2, Phone, Mail, MapPin, Briefcase, Calendar, Heart, MessageCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/members")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </Button>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

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
            <h1 className="text-2xl font-serif font-bold text-foreground mb-4">{member.fullName}</h1>
            
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
                  {(member.birthday || member.anniversary || member.bloodGroup) ? (
                    <>
                      {member.birthday && (
                        <div className="flex gap-3">
                          <Calendar className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Birthday</p>
                            <p className="font-medium">{format(parseISO(member.birthday), "MMMM d, yyyy")}</p>
                          </div>
                        </div>
                      )}
                      {member.anniversary && (
                        <div className="flex gap-3">
                          <Heart className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Anniversary</p>
                            <p className="font-medium">{format(parseISO(member.anniversary), "MMMM d, yyyy")}</p>
                          </div>
                        </div>
                      )}
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
                  {(member.phone || member.email || member.city || member.address) ? (
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
                              data-testid="link-maps"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              Open Address in Maps
                            </a>
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
                  {(member.profession || member.company || member.education) ? (
                    <>
                      {(member.profession || member.company) && (
                        <div className="flex gap-3 col-span-full">
                          <Briefcase className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Work</p>
                            <p className="font-medium">
                              {member.profession} {member.company && `at ${member.company}`}
                            </p>
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
              
              {/* Family Connections */}
              {(member.spouseName || (member.childrenNames && member.childrenNames.length > 0)) && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Family Connections</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {member.spouseName && (
                      <div>
                        <p className="text-sm text-muted-foreground">Spouse</p>
                        <p className="font-medium">{member.spouseName}</p>
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
