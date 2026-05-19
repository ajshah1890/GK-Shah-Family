import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { FamilyMember } from "@/types/family";
import { useFamilyStore } from "@/hooks/useFamilyStore";
import { ProfileSelectModal } from "@/components/ProfileSelectModal";

// ─── Constants ────────────────────────────────────────────────────────────────

export const CURRENT_MEMBER_KEY = "gkshah_current_member_id";
// Sentinel stored in localStorage when the user explicitly picks guest mode
const GUEST_SENTINEL = "__guest__";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CurrentMemberContextValue {
  /** UUID of the selected member, or null when in guest mode / unset */
  currentMemberId: string | null;
  /** Resolved FamilyMember object, or null for guests */
  currentMember: FamilyMember | null;
  /** True when no member profile is selected (guest or first visit) */
  isGuest: boolean;
  /** True once the user has explicitly chosen a profile or guest mode */
  hasChosen: boolean;
  setCurrentMember: (id: string) => void;
  /** Clears the profile and re-triggers the selector on next render */
  clearCurrentMember: () => void;
  /** Programmatically open the profile selector (e.g. "Switch Profile" button) */
  openProfileSelector: () => void;
}

const CurrentMemberContext = createContext<CurrentMemberContextValue>({
  currentMemberId: null,
  currentMember: null,
  isGuest: true,
  hasChosen: false,
  setCurrentMember: () => {},
  clearCurrentMember: () => {},
  openProfileSelector: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CurrentMemberProvider({ children }: { children: ReactNode }) {
  const { members, isLoaded } = useFamilyStore();

  const [rawStored, setRawStored] = useState<string | null>(
    () => localStorage.getItem(CURRENT_MEMBER_KEY)
  );
  const [modalOpen, setModalOpen] = useState(false);

  // Compute derived values
  const isGuestSentinel = rawStored === GUEST_SENTINEL;
  const hasChosen = rawStored !== null; // null = first visit
  const currentMemberId = isGuestSentinel || rawStored === null ? null : rawStored;
  const currentMember: FamilyMember | null = currentMemberId
    ? (members.find(m => m.id === currentMemberId) ?? null)
    : null;
  const isGuest = !currentMember;

  // Auto-open modal on first visit once members are loaded
  useEffect(() => {
    if (isLoaded && members.length > 0 && rawStored === null) {
      setModalOpen(true);
    }
  }, [isLoaded, members.length, rawStored]);

  // If stored ID no longer maps to a real member (e.g. member deleted),
  // fall back gracefully without crashing — just become a guest.

  const setCurrentMember = (id: string) => {
    localStorage.setItem(CURRENT_MEMBER_KEY, id);
    setRawStored(id);
    setModalOpen(false);
  };

  const clearCurrentMember = () => {
    localStorage.removeItem(CURRENT_MEMBER_KEY);
    setRawStored(null);
    // Will auto-open modal next render cycle once rawStored is null
  };

  const chooseGuest = () => {
    localStorage.setItem(CURRENT_MEMBER_KEY, GUEST_SENTINEL);
    setRawStored(GUEST_SENTINEL);
    setModalOpen(false);
  };

  const openProfileSelector = () => setModalOpen(true);

  return (
    <CurrentMemberContext.Provider
      value={{
        currentMemberId,
        currentMember,
        isGuest,
        hasChosen,
        setCurrentMember,
        clearCurrentMember,
        openProfileSelector,
      }}
    >
      {children}
      <ProfileSelectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        members={members}
        onSelect={setCurrentMember}
        onGuest={chooseGuest}
        currentMemberId={currentMemberId}
      />
    </CurrentMemberContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCurrentMember() {
  return useContext(CurrentMemberContext);
}
