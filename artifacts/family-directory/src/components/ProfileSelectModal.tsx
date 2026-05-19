import { useState, useMemo } from "react";
import { FamilyMember } from "@/types/family";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserCircle2, ChevronRight } from "lucide-react";

// ─── Member avatar ────────────────────────────────────────────────────────────

function MemberAvatar({
  member,
  size = "md",
}: {
  member: FamilyMember;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = { sm: "w-8 h-8 text-sm", md: "w-10 h-10 text-base", lg: "w-14 h-14 text-xl" };
  const cls = sizeMap[size];

  if (member.photo && !member.photo.startsWith("idb:")) {
    return (
      <div className={`${cls} rounded-full overflow-hidden shrink-0`}>
        <img src={member.photo} alt={member.fullName} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`${cls} rounded-full bg-primary/10 flex items-center justify-center text-primary font-serif font-bold shrink-0`}
    >
      {member.fullName.charAt(0)}
    </div>
  );
}

// ─── Exported avatar helper (used by sidebar, drawer, mobile header) ──────────

export { MemberAvatar };

// ─── Main modal ───────────────────────────────────────────────────────────────

interface ProfileSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: FamilyMember[];
  onSelect: (id: string) => void;
  onGuest: () => void;
  currentMemberId: string | null;
}

export function ProfileSelectModal({
  open,
  onOpenChange,
  members,
  onSelect,
  onGuest,
  currentMemberId,
}: ProfileSelectModalProps) {
  const [search, setSearch] = useState("");

  const active = useMemo(
    () => members.filter(m => !m.isArchived),
    [members]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return active
      .filter(m =>
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        (m.city ?? "").toLowerCase().includes(q) ||
        (m.generation ?? "").toLowerCase().includes(q)
      )
      .sort(
        (a, b) =>
          (a.generationNumber ?? 99) - (b.generationNumber ?? 99) ||
          a.fullName.localeCompare(b.fullName)
      )
      .slice(0, 40);
  }, [active, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 gap-0 overflow-hidden"
        onInteractOutside={e => {
          // Prevent closing by clicking outside if user hasn't chosen yet
          if (!currentMemberId) e.preventDefault();
        }}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-lg shrink-0">
              S
            </div>
            <div>
              <DialogTitle className="font-serif text-xl leading-tight">
                Select Your Profile
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Personalise your experience — find your name below
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by name or city…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Member list */}
        <div className="overflow-y-auto max-h-[340px] px-2 py-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No members found
            </div>
          ) : (
            filtered.map(m => {
              const isSelected = m.id === currentMemberId;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelect(m.id)}
                  className={[
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left group",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent",
                  ].join(" ")}
                >
                  <MemberAvatar member={m} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[m.generation, m.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {isSelected ? (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-muted/20">
          <button
            onClick={onGuest}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <UserCircle2 className="w-4 h-4" />
            Continue as Guest
          </button>
          <p className="text-center text-[10px] text-muted-foreground/60 mt-2">
            You can change your profile anytime in Settings
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
