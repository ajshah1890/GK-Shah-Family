import { useFamilyStore } from "@/hooks/useFamilyStore";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, X, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAdminMode } from "@/hooks/useAdminMode";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FamilyMember } from "@/types/family";

const formSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  photo: z.string().optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  generation: z.string().optional(),
  nativePlace: z.string().optional(),
  birthday: z.string().optional(),
  anniversary: z.string().optional(),
  address: z.string().optional(),
  mapsLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  personalWebsite: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  linkedIn: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  instagram: z.string().optional(),
  profession: z.string().optional(),
  company: z.string().optional(),
  previousCompany: z.string().optional(),
  businessName: z.string().optional(),
  education: z.string().optional(),
  bloodGroup: z.string().optional(),
  mainFamilyBranch: z.string().optional(),
  subFamilyBranch: z.string().optional(),
  spouseName: z.string().optional(),
  childrenNamesStr: z.string().optional(),
  hobbies: z.string().optional(),
  skills: z.string().optional(),
  languagesSpoken: z.string().optional(),
  emergencyContact: z.string().optional(),
  notes: z.string().optional(),
  fatherId: z.string().optional(),
  motherId: z.string().optional(),
  spouseId: z.string().optional(),
  generationNumber: z.number().optional(),
  siblingOrder: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function MemberForm() {
  const { id } = useParams();
  const isEditing = id !== "new" && !!id;
  const [, setLocation] = useLocation();
  const { members, addMember, updateMember, isLoaded, detectPotentialDuplicates } = useFamilyStore();
  const { isAdmin } = useAdminMode();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [duplicatesFound, setDuplicatesFound] = useState<{ member: FamilyMember; reasons: string[] }[]>([]);
  const [pendingData, setPendingData] = useState<Omit<FamilyMember, 'id'> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      photo: "",
      gender: undefined,
      generation: "",
      nativePlace: "",
      birthday: "",
      anniversary: "",
      address: "",
      mapsLink: "",
      city: "",
      country: "",
      phone: "",
      whatsapp: "",
      email: "",
      personalWebsite: "",
      linkedIn: "",
      instagram: "",
      profession: "",
      company: "",
      previousCompany: "",
      businessName: "",
      education: "",
      bloodGroup: "",
      mainFamilyBranch: "",
      subFamilyBranch: "",
      spouseName: "",
      childrenNamesStr: "",
      hobbies: "",
      skills: "",
      languagesSpoken: "",
      emergencyContact: "",
      notes: "",
      fatherId: "",
      motherId: "",
      spouseId: "",
      generationNumber: undefined,
      siblingOrder: undefined,
    },
  });

  useEffect(() => {
    if (isLoaded && isEditing) {
      const member = members.find(m => m.id === id);
      if (member) {
        form.reset({
          ...member,
          childrenNamesStr: member.childrenNames?.join(", ") || "",
          fatherId: member.fatherId || "",
          motherId: member.motherId || "",
          spouseId: member.spouseId || "",
          generationNumber: member.generationNumber,
          siblingOrder: member.siblingOrder,
        });
        if (member.photo) {
          setPhotoPreview(member.photo);
        }
      }
    }
  }, [isLoaded, isEditing, id, members, form]);

  const fatherId = form.watch("fatherId");
  useEffect(() => {
    if (fatherId) {
      const father = members.find(m => m.id === fatherId);
      if (father?.generationNumber) {
        form.setValue("generationNumber", father.generationNumber + 1);
        const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
        const genNum = father.generationNumber + 1;
        form.setValue("generation", `${ordinals[genNum - 1] || genNum + 'th'} Generation`);
      }
    }
  }, [fatherId, members, form]);

  if (!isLoaded) return null;

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold font-serif mb-4">Access Denied</h2>
        <p className="text-muted-foreground mb-6">You need admin access to add or edit members.</p>
        <Button onClick={() => setLocation("/members")}>
          Return to Directory
        </Button>
      </div>
    );
  }

  const compressImage = (file: File, maxDim = 800, quality = 0.82): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas unavailable")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("load failed")); };
      img.src = objectUrl;
    });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      const kb = Math.round(compressed.length * 0.75 / 1024);
      setPhotoPreview(compressed);
      form.setValue("photo", compressed);
      toast.success(`Photo ready — ${kb} KB after compression`);
    } catch {
      toast.error("Failed to process image. Please try a different photo.");
    }
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    form.setValue("photo", "");
  };

  const buildMemberData = (values: FormValues) => {
    const { childrenNamesStr, photo, ...rest } = values;
    const finalPhoto = photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(values.fullName)}`;
    return {
      ...rest,
      photo: finalPhoto,
      childrenNames: childrenNamesStr ? childrenNamesStr.split(",").map(s => s.trim()).filter(Boolean) : [],
      fatherId: values.fatherId || undefined,
      motherId: values.motherId || undefined,
      spouseId: values.spouseId || undefined,
      generationNumber: values.generationNumber,
      siblingOrder: values.siblingOrder,
    };
  };

  const performSave = (memberData: Omit<FamilyMember, 'id'>) => {
    if (isEditing && id) {
      const result = updateMember(id, memberData);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Member updated successfully");
      setLocation(`/members/${id}`);
    } else {
      const result = addMember(memberData);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Member added successfully");
      setLocation(`/members/${result.member.id}`);
    }
  };

  const onSubmit = (values: FormValues) => {
    const memberData = buildMemberData(values);

    // Duplicate detection (skip when editing the same person)
    const dupes = detectPotentialDuplicates(
      { fullName: memberData.fullName, phone: memberData.phone, birthday: memberData.birthday },
      isEditing ? id : undefined
    );

    if (dupes.length > 0) {
      setDuplicatesFound(dupes);
      setPendingData(memberData);
      return;
    }

    performSave(memberData);
  };

  const handleConfirmDespiteDuplicates = () => {
    if (pendingData) performSave(pendingData);
    setDuplicatesFound([]);
    setPendingData(null);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation(isEditing ? `/members/${id}` : "/members")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-serif font-bold">
          {isEditing ? "Edit Family Member" : "Add Family Member"}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="shrink-0 flex flex-col items-center gap-3">
                  <div className="w-32 h-32 rounded-full border-2 border-dashed border-border overflow-hidden bg-muted relative group">
                    {photoPreview ? (
                      <>
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button type="button" variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={removePhoto}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => document.getElementById('photo-upload')?.click()}>
                        <Upload className="w-6 h-6 mb-2" />
                        <span className="text-[10px]">Upload Photo</span>
                      </div>
                    )}
                  </div>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  {!photoPreview && (
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('photo-upload')?.click()}>
                      Choose File
                    </Button>
                  )}
                  <p className="text-[10px] text-muted-foreground text-center max-w-[120px]">Auto-compressed to ~200 KB. Leave empty for auto-generated avatar.</p>
                </div>

                <div className="flex-1 w-full space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g. Ramesh Shah" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="generation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Generation</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Generation" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1st Generation">1st Generation</SelectItem>
                              <SelectItem value="2nd Generation">2nd Generation</SelectItem>
                              <SelectItem value="3rd Generation">3rd Generation</SelectItem>
                              <SelectItem value="4th Generation">4th Generation</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Family Classification</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="mainFamilyBranch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Main Family Branch</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g. Mumbai Branch" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subFamilyBranch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub Family Branch</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g. Elder Line" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nativePlace"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Native Place</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g. Rajkot" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Relationship fields - Father, Mother, Spouse dropdowns */}
              <div className="md:col-span-2 space-y-4 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-muted-foreground">Family Relationships</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="fatherId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Father</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select father..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {members.filter(m => m.id !== id && m.gender !== "Female").map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="motherId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mother</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select mother..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {members.filter(m => m.id !== id && m.gender !== "Male").map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="spouseId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spouse</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(val);
                        // Auto-fill spouseName from selection
                        const spouse = members.find(m => m.id === val);
                        if (spouse) form.setValue("spouseName", spouse.fullName);
                      }} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select spouse..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {members.filter(m => m.id !== id).map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                
                {/* Auto-generate generation number from father */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="generationNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Generation Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} max={10}
                          placeholder="e.g. 2"
                          value={field.value ?? ""}
                          onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormDescription>Auto-filled when father is selected</FormDescription>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="siblingOrder" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birth Order Among Siblings</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1}
                          placeholder="e.g. 1"
                          value={field.value ?? ""}
                          onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Important Dates</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="birthday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birthday</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="anniversary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anniversary</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="example@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="personalWebsite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Social & Professional Links</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="linkedIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://linkedin.com/in/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instagram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram Handle/URL</FormLabel>
                    <FormControl>
                      <Input placeholder="@handle or https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Mumbai" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. India" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Full residential address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mapsLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google Maps Link</FormLabel>
                    <FormControl>
                      <Input placeholder="https://maps.google.com/..." {...field} />
                    </FormControl>
                    <FormDescription>Paste a Google Maps link to this member's address</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Professional & Other Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="profession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profession</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Software Engineer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Company</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Tech Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="previousCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Previous Company</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Old Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Shah Enterprises" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="education"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Education</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. B.Tech" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bloodGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Group</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Blood Group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                            <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Family Ties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="spouseName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spouse Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Partner's name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="childrenNamesStr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Children Names</FormLabel>
                      <FormControl>
                        <Input placeholder="Comma separated names" {...field} />
                      </FormControl>
                      <FormDescription>E.g. Ravi, Sneha</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Personal Interests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="hobbies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hobbies</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Reading, Traveling" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skills</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Photography, Cooking" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="languagesSpoken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Languages Spoken</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. English, Gujarati, Hindi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact</FormLabel>
                      <FormControl>
                        <Input placeholder="Name & Phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any other details or family history..." className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setLocation(isEditing ? `/members/${id}` : "/members")}>
              Cancel
            </Button>
            <Button type="submit" className="min-w-[150px]">
              {isEditing ? "Save Changes" : "Add Member"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Duplicate Detection Dialog */}
      <AlertDialog open={duplicatesFound.length > 0} onOpenChange={(open) => { if (!open) { setDuplicatesFound([]); setPendingData(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Possible Duplicate Detected
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>The following existing member(s) may be duplicates of the person you're adding:</p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {duplicatesFound.map(({ member, reasons }) => (
                    <div key={member.id} className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                      <p className="font-semibold text-foreground text-sm">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground">{[member.generation, member.city].filter(Boolean).join(" · ")}</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{reasons.join(", ")}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm">Are you sure you want to add this as a new member anyway?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel — go back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDespiteDuplicates} className="bg-amber-600 hover:bg-amber-700 text-white">
              Add anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
