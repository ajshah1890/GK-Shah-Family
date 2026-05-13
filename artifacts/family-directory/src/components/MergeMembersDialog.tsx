import { useState } from "react";
import { FamilyMember } from "@/types/family";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, GitMerge, AlertTriangle } from "lucide-react";

interface MergeField {
  label: string;
  key: keyof FamilyMember;
}

const MERGE_FIELDS: MergeField[] = [
  { label: "Full Name", key: "fullName" },
  { label: "Gender", key: "gender" },
  { label: "Birthday", key: "birthday" },
  { label: "Anniversary", key: "anniversary" },
  { label: "Blood Group", key: "bloodGroup" },
  { label: "City", key: "city" },
  { label: "Country", key: "country" },
  { label: "Native Place", key: "nativePlace" },
  { label: "Address", key: "address" },
  { label: "Phone", key: "phone" },
  { label: "WhatsApp", key: "whatsapp" },
  { label: "Email", key: "email" },
  { label: "LinkedIn", key: "linkedIn" },
  { label: "Personal Website", key: "personalWebsite" },
  { label: "Instagram", key: "instagram" },
  { label: "Profession", key: "profession" },
  { label: "Company", key: "company" },
  { label: "Business Name", key: "businessName" },
  { label: "Education", key: "education" },
  { label: "Main Branch", key: "mainFamilyBranch" },
  { label: "Sub Branch", key: "subFamilyBranch" },
  { label: "Hobbies", key: "hobbies" },
  { label: "Skills", key: "skills" },
  { label: "Languages", key: "languagesSpoken" },
  { label: "Emergency Contact", key: "emergencyContact" },
  { label: "Notes", key: "notes" },
];

function formatVal(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

interface Props {
  open: boolean;
  onClose: () => void;
  memberA: FamilyMember;
  memberB: FamilyMember;
  onMerge: (winnerId: string, loserId: string, fieldOverrides: Partial<FamilyMember>) => void;
}

export function MergeMembersDialog({ open, onClose, memberA, memberB, onMerge }: Props) {
  const [winner, setWinner] = useState<"A" | "B">("A");
  const [fieldChoices, setFieldChoices] = useState<Record<string, "A" | "B">>({});

  const conflictingFields = MERGE_FIELDS.filter(({ key }) => {
    const a = formatVal(memberA[key]);
    const b = formatVal(memberB[key]);
    return a !== b && (a || b);
  });

  const identicalFields = MERGE_FIELDS.filter(({ key }) => {
    const a = formatVal(memberA[key]);
    const b = formatVal(memberB[key]);
    return a === b && a;
  });

  const getChoice = (key: string): "A" | "B" => fieldChoices[key] ?? winner;

  const handleWinnerChange = (side: "A" | "B") => {
    setWinner(side);
    setFieldChoices({});
  };

  const handleMerge = () => {
    const winnerMember = winner === "A" ? memberA : memberB;
    const loserMember  = winner === "A" ? memberB : memberA;

    const overrides: Partial<FamilyMember> = {};
    for (const { key } of MERGE_FIELDS) {
      const choice = getChoice(key as string);
      const src = choice === "A" ? memberA : memberB;
      const val = src[key];
      if (val !== undefined) {
        (overrides as Record<string, unknown>)[key] = val;
      }
    }

    onMerge(winnerMember.id, loserMember.id, overrides);
  };

  const winnerMember = winner === "A" ? memberA : memberB;
  const loserMember  = winner === "A" ? memberB : memberA;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-amber-600" />
            Merge Duplicate Members
          </DialogTitle>
          <DialogDescription>
            Select which value to keep for each conflicting field. The winner record is preserved; the other is permanently removed.
          </DialogDescription>
        </DialogHeader>

        {/* Primary record selector */}
        <div className="rounded-lg bg-muted p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Keep as primary record</p>
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((side) => {
              const m = side === "A" ? memberA : memberB;
              const selected = winner === side;
              return (
                <button
                  key={side}
                  onClick={() => handleWinnerChange(side)}
                  className={[
                    "p-3 rounded-lg border-2 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground bg-background",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {selected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                    <p className="font-semibold text-sm truncate">{m.fullName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{m.memberId ?? m.id}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[m.city, m.generation].filter(Boolean).join(" · ") || "No location"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{loserMember.fullName}</strong>'s children and relationships will be transferred to{" "}
            <strong>{winnerMember.fullName}</strong> before removal. This action can be undone immediately after.
          </span>
        </div>

        {/* Conflicting fields */}
        {conflictingFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {conflictingFields.length} conflicting field{conflictingFields.length !== 1 ? "s" : ""} — click to select
            </p>
            {conflictingFields.map(({ label, key }) => {
              const valA = formatVal(memberA[key]);
              const valB = formatVal(memberB[key]);
              const choice = getChoice(key as string);
              return (
                <div
                  key={key}
                  className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/10 p-3"
                >
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["A", "B"] as const).map((side) => {
                      const val  = side === "A" ? valA : valB;
                      const m    = side === "A" ? memberA : memberB;
                      const sel  = choice === side;
                      return (
                        <button
                          key={side}
                          onClick={() => setFieldChoices((prev) => ({ ...prev, [key as string]: side }))}
                          className={[
                            "p-2 rounded-lg text-left text-sm border transition-all",
                            sel
                              ? "border-primary bg-primary/10 font-medium"
                              : "border-border hover:border-muted-foreground bg-background",
                          ].join(" ")}
                        >
                          <span className="block text-[10px] font-mono text-muted-foreground mb-1 truncate">
                            {m.fullName}
                          </span>
                          {val ? (
                            <span className="block truncate">{val}</span>
                          ) : (
                            <span className="italic text-muted-foreground text-xs">empty</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Identical fields */}
        {identicalFields.length > 0 && (
          <div className="rounded-lg bg-green-50/50 dark:bg-green-950/10 border border-green-200 dark:border-green-800/40 p-3">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {identicalFields.length} identical field{identicalFields.length !== 1 ? "s" : ""} — no conflict
            </p>
            <div className="flex flex-wrap gap-1.5">
              {identicalFields.map(({ label }) => (
                <Badge key={label} variant="secondary" className="text-[10px]">{label}</Badge>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleMerge}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <GitMerge className="w-4 h-4" />
            Merge into {winnerMember.fullName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
