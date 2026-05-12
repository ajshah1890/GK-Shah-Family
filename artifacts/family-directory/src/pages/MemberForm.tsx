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
import { ArrowLeft, Upload, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAdminMode } from "@/hooks/useAdminMode";

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
});

type FormValues = z.infer<typeof formSchema>;

export default function MemberForm() {
  const { id } = useParams();
  const isEditing = id !== "new" && !!id;
  const [, setLocation] = useLocation();
  const { members, addMember, updateMember, isLoaded } = useFamilyStore();
  const { isAdmin } = useAdminMode();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
    },
  });

  useEffect(() => {
    if (isLoaded && isEditing) {
      const member = members.find(m => m.id === id);
      if (member) {
        form.reset({
          ...member,
          childrenNamesStr: member.childrenNames?.join(", ") || "",
        });
        if (member.photo) {
          setPhotoPreview(member.photo);
        }
      }
    }
  }, [isLoaded, isEditing, id, members, form]);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image must be less than 2MB to save to local storage.");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPhotoPreview(base64String);
        form.setValue("photo", base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    form.setValue("photo", "");
  };

  const onSubmit = (values: FormValues) => {
    const { childrenNamesStr, photo, ...rest } = values;
    
    // Default avatar if no photo is provided
    const finalPhoto = photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(values.fullName)}`;
    
    const memberData = {
      ...rest,
      photo: finalPhoto,
      childrenNames: childrenNamesStr ? childrenNamesStr.split(",").map(s => s.trim()).filter(Boolean) : [],
    };

    if (isEditing && id) {
      updateMember(id, memberData);
      toast.success("Member updated successfully");
      setLocation(`/members/${id}`);
    } else {
      const newMember = addMember(memberData);
      toast.success("Member added successfully");
      setLocation(`/members/${newMember.id}`);
    }
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
                  <p className="text-[10px] text-muted-foreground text-center max-w-[120px]">Max 2MB. Leave empty for auto-generated avatar.</p>
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
    </div>
  );
}
