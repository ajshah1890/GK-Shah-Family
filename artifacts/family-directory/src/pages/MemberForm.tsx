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
import { ArrowLeft, Upload, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { RelationshipCombobox } from "@/components/RelationshipCombobox";
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const isHydrating = useRef(false);
  const hydratedForId = useRef<string | null>(null);

  /** Snapshot of the DB values when edit form opened — used as fallback on save. */
  const originalValues = useRef<{
    fatherId?: string; motherId?: string; spouseId?: string;
    gender?: "Male" | "Female" | "Other"; bloodGroup?: string;
    birthday?: string; anniversary?: string;
    generation?: string; generationNumber?: number; siblingOrder?: number;
  }>({});
  // Backward-compat alias used in a few places below
  const originalRelIds = originalValues;

  /** Fields the user explicitly cleared via the "None" button in a combobox.
   *  Only these are allowed to become undefined on save; un-touched empty fields
   *  fall back to originalValues to survive hydration failures. */
  const userExplicitlyClearedRels = useRef<Set<"fatherId" | "motherId" | "spouseId">>(new Set());

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
    // Only hydrate once per member id — prevents re-hydration wiping user edits
    // whenever the members array reference changes (e.g. GitHub sync, other saves).
    if (!isLoaded || !isEditing || hydratedForId.current === id) return;
    const member = members.find(m => m.id === id);
    if (!member) return;

    // Clear explicit-clear tracking for the incoming member before resetting
    userExplicitlyClearedRels.current = new Set();
    hydratedForId.current = id;

    // Snapshot DB values; used as fallback in buildMemberData if a field silently fails to hydrate.
    // Normalize dates to YYYY-MM-DD so the snapshot matches the form's date input format.
    originalValues.current = {
      fatherId:         member.fatherId,
      motherId:         member.motherId,
      spouseId:         member.spouseId,
      gender:           member.gender,
      bloodGroup:       member.bloodGroup,
      birthday:         member.birthday?.slice(0, 10),
      anniversary:      member.anniversary?.slice(0, 10),
      generation:       member.generation,
      generationNumber: member.generationNumber,
      siblingOrder:     member.siblingOrder,
    };

    console.log("[GKShah] HYDRATED MEMBER", {
      id,
      fullName: member.fullName,
      birthday: member.birthday,
      birthdayNormalized: member.birthday?.slice(0, 10),
      gender: member.gender,
      bloodGroup: member.bloodGroup,
      generation: member.generation,
      generationNumber: member.generationNumber,
    });

    console.log("[GKShah] RESET VALUES", {
      gender: member.gender,
      generation: member.generation,
      bloodGroup: member.bloodGroup,
    });

    isHydrating.current = true;
    form.reset({
      fullName: member.fullName ?? "",
      photo: (member.photo && !member.photo.startsWith("idb:")) ? member.photo : "",
      gender: member.gender,
      generation: member.generation ?? "",
      nativePlace: member.nativePlace ?? "",
      // Normalize to YYYY-MM-DD — date inputs silently show empty for ISO datetime strings
      birthday: member.birthday?.slice(0, 10) ?? "",
      anniversary: member.anniversary?.slice(0, 10) ?? "",
      address: member.address ?? "",
      mapsLink: member.mapsLink ?? "",
      city: member.city ?? "",
      country: member.country ?? "",
      phone: member.phone ?? "",
      whatsapp: member.whatsapp ?? "",
      email: member.email ?? "",
      personalWebsite: member.personalWebsite ?? "",
      linkedIn: member.linkedIn ?? "",
      instagram: member.instagram ?? "",
      profession: member.profession ?? "",
      company: member.company ?? "",
      previousCompany: member.previousCompany ?? "",
      businessName: member.businessName ?? "",
      education: member.education ?? "",
      bloodGroup: member.bloodGroup ?? "",
      mainFamilyBranch: member.mainFamilyBranch ?? "",
      subFamilyBranch: member.subFamilyBranch ?? "",
      spouseName: member.spouseName ?? "",
      childrenNamesStr: member.childrenNames?.join(", ") ?? "",
      hobbies: member.hobbies ?? "",
      skills: member.skills ?? "",
      languagesSpoken: member.languagesSpoken ?? "",
      emergencyContact: member.emergencyContact ?? "",
      notes: member.notes ?? "",
      fatherId: member.fatherId ?? "",
      motherId: member.motherId ?? "",
      spouseId: member.spouseId ?? "",
      generationNumber: member.generationNumber,
      siblingOrder: member.siblingOrder,
    });
    // Keep isHydrating true until after React has committed the new values and
    // all triggered effects have run (rAF fires after paint, well after effects).
    requestAnimationFrame(() => { isHydrating.current = false; });

    if (member.photo && !member.photo.startsWith("idb:")) {
      setPhotoPreview(member.photo);
    }
  }, [isLoaded, isEditing, id, members]); // `members` needed for find(); hydrated.current prevents re-runs

  // When navigating to /members/new, clear the photo preview so it doesn't
  // persist from a previous edit session.
  useEffect(() => {
    if (!isEditing) {
      setPhotoPreview(null);
      hydratedForId.current = null;
    }
  }, [isEditing]);

  // Watch all five hydration-sensitive fields for the debug panel + generation effect
  const fatherId      = form.watch("fatherId");
  const watchMotherId = form.watch("motherId");
  const watchSpouseId = form.watch("spouseId");
  const watchGender   = form.watch("gender");
  const watchBloodGroup = form.watch("bloodGroup");

  useEffect(() => {
    // Skip auto-generation-compute during programmatic hydration (form.reset).
    // Only fire when the user actively changes the father field.
    if (isHydrating.current) return;
    if (fatherId) {
      const father = members.find(m => m.id === fatherId);
      if (father?.generationNumber) {
        const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
        const genNum = father.generationNumber + 1;
        form.setValue("generationNumber", genNum);
        form.setValue("generation", `${ordinals[genNum - 1] ?? `${genNum}th`} Generation`);
      }
    }
  }, [fatherId, members, form]);

  if (!isLoaded) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto pb-10 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-md bg-muted" />
          <div className="h-8 w-48 bg-muted rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="flex gap-6">
            <div className="w-32 h-32 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3.5 w-20 bg-muted rounded" />
                <div className="h-10 w-full bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
    // Pull out fields we handle explicitly so they are not double-included via ...rest
    const {
      childrenNamesStr,
      photo,
      birthday:         rawBirthday,
      anniversary:      rawAnniversary,
      gender:           _gender,
      bloodGroup:       _bloodGroup,
      generation:       _generation,
      generationNumber: _generationNumber,
      fatherId:         _fatherId,
      motherId:         _motherId,
      spouseId:         _spouseId,
      siblingOrder:     _siblingOrder,
      ...rest
    } = values;

    const finalPhoto = photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(values.fullName)}`;
    const orig    = originalValues.current;
    const cleared = userExplicitlyClearedRels.current;

    // ── Relationship fields ───────────────────────────────────────────────────
    // If the form value is empty AND the user did NOT explicitly click "None",
    // fall back to the original DB value to survive any hydration timing failure.
    const fatherIdFinal = _fatherId
      ? _fatherId
      : cleared.has("fatherId") ? undefined : (orig.fatherId ?? undefined);

    const motherIdFinal = _motherId
      ? _motherId
      : cleared.has("motherId") ? undefined : (orig.motherId ?? undefined);

    const spouseIdFinal = _spouseId
      ? _spouseId
      : cleared.has("spouseId") ? undefined : (orig.spouseId ?? undefined);

    // ── Gender ────────────────────────────────────────────────────────────────
    // onValueChange normalises "none" → undefined before it reaches RHF, so
    // _gender is always a valid enum value or undefined here.
    // Fall back to the original snapshot when the form value is absent so a
    // hydration gap can never silently clear an existing gender.
    const genderFinal: "Male" | "Female" | "Other" | undefined =
      _gender ?? orig.gender;

    // ── Blood group ───────────────────────────────────────────────────────────
    // onValueChange normalises "none" → "" before it reaches RHF.
    // Non-empty form value wins; empty falls back to original.
    const bloodGroupFinal: string | undefined =
      (_bloodGroup !== undefined && _bloodGroup !== "")
        ? _bloodGroup
        : (orig.bloodGroup ?? undefined);

    // ── Birthday / anniversary ────────────────────────────────────────────────
    // <input type="date"> requires YYYY-MM-DD.  Stored ISO datetimes
    // (e.g. "1980-05-15T00:00:00.000Z") make the input render empty, causing the
    // empty string to overwrite the real value on save.  Normalize here AND fall
    // back to the original snapshot when the form value is blank.
    const normalizeDate = (raw: string | undefined, fallback: string | undefined): string | undefined => {
      const t = raw?.trim();
      if (t) return t.slice(0, 10);
      return fallback ?? undefined;
    };

    const birthdayFinal    = normalizeDate(rawBirthday,    orig.birthday);
    const anniversaryFinal = normalizeDate(rawAnniversary, orig.anniversary);

    // ── Generation ────────────────────────────────────────────────────────────
    // onValueChange normalises "none" → "" before it reaches RHF.
    const generationFinal: string | undefined =
      (_generation !== undefined && _generation !== "")
        ? _generation
        : (orig.generation ?? undefined);

    const generationNumberFinal: number | undefined =
      _generationNumber ?? orig.generationNumber;

    const siblingOrderFinal: number | undefined =
      _siblingOrder ?? orig.siblingOrder;

    return {
      ...rest,
      photo:            finalPhoto,
      birthday:         birthdayFinal,
      anniversary:      anniversaryFinal,
      gender:           genderFinal,
      bloodGroup:       bloodGroupFinal,
      generation:       generationFinal,
      generationNumber: generationNumberFinal,
      siblingOrder:     siblingOrderFinal,
      childrenNames:    childrenNamesStr
        ? childrenNamesStr.split(",").map(s => s.trim()).filter(Boolean)
        : [],
      fatherId:  fatherIdFinal,
      motherId:  motherIdFinal,
      spouseId:  spouseIdFinal,
    };
  };

  const performSave = (memberData: Omit<FamilyMember, 'id'>) => {
    console.log("[GKShah] FINAL PAYLOAD SAVED", {
      birthday:         memberData.birthday,
      anniversary:      memberData.anniversary,
      gender:           memberData.gender,
      bloodGroup:       memberData.bloodGroup,
      generation:       memberData.generation,
      generationNumber: memberData.generationNumber,
      fatherId:         memberData.fatherId,
      motherId:         memberData.motherId,
      spouseId:         memberData.spouseId,
    });
    // Track whether the save actually succeeded so finally can set the right status.
    // Without try/finally: any thrown exception leaves saveStatus='saving' forever,
    // permanently disabling the submit button (REGRESSION from adding setSaveStatus).
    let savedSuccessfully = false;
    console.group('[GKShah] performSave START');
    console.log('[GKShah] performSave', { isEditing, id, currentSaveStatus: saveStatus });
    try {
      setSaveStatus('saving');
      if (isEditing && id) {
        console.log('[GKShah] performSave calling updateMember...');
        const result = updateMember(id, memberData);
        if (result.error) {
          console.warn('[GKShah] performSave FAILURE (updateMember validation):', result.error);
          toast.error(result.error);
          return; // finally will set saveStatus='idle'
        }
        savedSuccessfully = true;
        toast.success("Member updated successfully");
        console.log('[GKShah] performSave END (edit) — navigating to', id, 'in 700ms');
        setTimeout(() => setLocation(`/members/${id}`), 700);
      } else {
        console.log('[GKShah] performSave calling addMember...');
        const result = addMember(memberData);
        if (result.error) {
          console.warn('[GKShah] performSave FAILURE (addMember validation):', result.error);
          toast.error(result.error);
          return; // finally will set saveStatus='idle'
        }
        savedSuccessfully = true;
        toast.success("Member added successfully");
        console.log('[GKShah] performSave END (add) — navigating to', result.member.id, 'in 700ms');
        setTimeout(() => setLocation(`/members/${result.member.id}`), 700);
      }
    } catch (err) {
      console.error('[GKShah] performSave FAILURE (unhandled exception):', err);
      toast.error(`Save failed unexpectedly — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaveStatus(savedSuccessfully ? 'saved' : 'idle');
      console.log('[GKShah] performSave FINALLY — saveStatus =', savedSuccessfully ? 'saved' : 'idle');
      console.groupEnd();
    }
  };

  const onSubmit = (values: FormValues) => {
    console.log("[GKShah] FORM VALUES BEFORE SAVE", {
      birthday:         values.birthday,
      anniversary:      values.anniversary,
      gender:           values.gender,
      bloodGroup:       values.bloodGroup,
      generation:       values.generation,
      generationNumber: values.generationNumber,
    });
    const memberData = buildMemberData(values);

    // Pre-save integrity: warn if a relationship is being removed
    if (isEditing) {
      const orig    = originalRelIds.current;
      const cleared = userExplicitlyClearedRels.current;

      if (orig.fatherId && !memberData.fatherId && !cleared.has("fatherId")) {
        // Should not happen with preservation logic — flag for debugging
        console.warn("[GKShah] Unexpected fatherId loss on save:", { original: orig.fatherId });
      }
      if (orig.fatherId && !memberData.fatherId && cleared.has("fatherId")) {
        toast.warning("Father relationship removed. Undo to restore if unintentional.");
      }
      if (orig.motherId && !memberData.motherId && cleared.has("motherId")) {
        toast.warning("Mother relationship removed. Undo to restore if unintentional.");
      }
      if (orig.spouseId && !memberData.spouseId && cleared.has("spouseId")) {
        toast.warning("Spouse relationship removed. Undo to restore if unintentional.");
      }
    }

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
                      render={({ field }) => {
                        console.log("[GKShah] Gender Select value:", field.value);
                        return (
                          <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select
                              onValueChange={(val) => field.onChange(val === "none" ? undefined : val)}
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Gender" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Select Gender</SelectItem>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={form.control}
                      name="generation"
                      render={({ field }) => {
                        console.log("[GKShah] Generation Select value:", field.value);
                        return (
                          <FormItem>
                            <FormLabel>Generation</FormLabel>
                            <Select
                              onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Generation" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Select Generation</SelectItem>
                                <SelectItem value="1st Generation">1st Generation</SelectItem>
                                <SelectItem value="2nd Generation">2nd Generation</SelectItem>
                                <SelectItem value="3rd Generation">3rd Generation</SelectItem>
                                <SelectItem value="4th Generation">4th Generation</SelectItem>
                                <SelectItem value="5th Generation">5th Generation</SelectItem>
                                <SelectItem value="6th Generation">6th Generation</SelectItem>
                                <SelectItem value="7th Generation">7th Generation</SelectItem>
                                <SelectItem value="8th Generation">8th Generation</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
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

              {/* Relationship fields - searchable comboboxes for large family datasets */}
              <div className="md:col-span-2 space-y-4 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-muted-foreground">Family Relationships</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="fatherId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Father</FormLabel>
                      <FormControl>
                        <RelationshipCombobox
                          value={field.value ?? ""}
                          onChange={(val) => field.onChange(val)}
                          onClear={() => userExplicitlyClearedRels.current.add("fatherId")}
                          members={members}
                          placeholder="Select father…"
                          excludeId={id}
                          excludeGender="Female"
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="motherId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mother</FormLabel>
                      <FormControl>
                        <RelationshipCombobox
                          value={field.value ?? ""}
                          onChange={(val) => field.onChange(val)}
                          onClear={() => userExplicitlyClearedRels.current.add("motherId")}
                          members={members}
                          placeholder="Select mother…"
                          excludeId={id}
                          excludeGender="Male"
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="spouseId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spouse</FormLabel>
                      <FormControl>
                        <RelationshipCombobox
                          value={field.value ?? ""}
                          onChange={(val) => {
                            field.onChange(val);
                            const spouse = members.find(m => m.id === val);
                            if (spouse) form.setValue("spouseName", spouse.fullName);
                            if (!val) form.setValue("spouseName", "");
                          }}
                          onClear={() => {
                            userExplicitlyClearedRels.current.add("spouseId");
                            form.setValue("spouseName", "");
                          }}
                          members={members}
                          placeholder="Select spouse…"
                          excludeId={id}
                        />
                      </FormControl>
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
                  render={({ field }) => {
                    console.log("[GKShah] Blood Group Select value:", field.value);
                    return (
                      <FormItem>
                        <FormLabel>Blood Group</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Blood Group" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Select Blood Group</SelectItem>
                            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                              <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
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

          {/* ── Hydration debug panel (edit mode only) ─────────────────────── */}
          {isEditing && (
            <details className="rounded-lg border border-dashed border-border text-[11px] font-mono">
              <summary className="px-3 py-2 cursor-pointer text-muted-foreground select-none">
                Form state inspector (edit debug)
              </summary>
              <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {([
                  { label: "gender",    persisted: originalValues.current.gender,    form: watchGender     ?? "" },
                  { label: "bloodGroup",persisted: originalValues.current.bloodGroup, form: watchBloodGroup ?? "" },
                  { label: "fatherId",  persisted: originalValues.current.fatherId,  form: fatherId        ?? "",
                    name: fatherId ? members.find(m => m.id === fatherId)?.fullName : "" },
                  { label: "motherId",  persisted: originalValues.current.motherId,  form: watchMotherId   ?? "",
                    name: watchMotherId ? members.find(m => m.id === watchMotherId)?.fullName : "" },
                  { label: "spouseId",  persisted: originalValues.current.spouseId,  form: watchSpouseId   ?? "",
                    name: watchSpouseId ? members.find(m => m.id === watchSpouseId)?.fullName : "" },
                ] as { label: string; persisted?: string; form: string; name?: string }[]).map(row => {
                  const match = (row.persisted ?? "") === row.form;
                  return (
                    <div key={row.label} className={`flex flex-col gap-0.5 py-0.5 border-b border-border/40 last:border-0 ${match ? "" : "text-amber-600 dark:text-amber-400"}`}>
                      <span className="font-semibold">{row.label}</span>
                      <span className="text-muted-foreground">DB:&nbsp;&nbsp;&nbsp;{row.persisted || "—"}</span>
                      <span>Form: {row.form || "—"}{row.name ? ` (${row.name})` : ""}</span>
                      <span className={match ? "text-green-600 dark:text-green-400" : "text-amber-500"}>
                        {match ? "✓ match" : "⚠ mismatch — original will be preserved on save"}
                      </span>
                    </div>
                  );
                })}
                <div className="sm:col-span-2 pt-1 text-muted-foreground">
                  Explicitly cleared: [{Array.from(userExplicitlyClearedRels.current).join(", ") || "none"}]
                </div>
              </div>
            </details>
          )}

          <div className="flex justify-end items-center gap-4">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                Saved locally
              </span>
            )}
            <Button type="button" variant="outline" onClick={() => setLocation(isEditing ? `/members/${id}` : "/members")}>
              Cancel
            </Button>
            <Button type="submit" className="min-w-[150px]" disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? "Saving…" : isEditing ? "Save Changes" : "Add Member"}
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
