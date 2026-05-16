import { FamilyMember } from "@/types/family";

export type WishStyle = "formal" | "warm" | "fun";

/** Strip all non-digit characters so wa.me receives a clean number. */
export function cleanPhone(raw: string): string {
  return raw.replace(/[\s+\-().]/g, "");
}

export function buildWaUrl(cleanedPhone: string, message: string): string {
  return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
}

function firstName(member: FamilyMember): string {
  return member.fullName?.split(" ")[0] ?? "there";
}

// ── Birthday messages ──────────────────────────────────────────────────────
const BIRTHDAY: Record<WishStyle, (m: FamilyMember) => string> = {
  formal: (m) =>
    `Dear ${firstName(m)},\n\nWishing you a very Happy Birthday. May this special day bring you joy, good health, and continued success. Many happy returns of the day!`,

  warm: (m) =>
    `Happy Birthday, ${firstName(m)}! 🎉\n\nWishing you happiness, good health, and a wonderful year ahead. So glad to have you in our family! 💛`,

  fun: (m) =>
    `Hey ${firstName(m)}! 🎂🥳\n\nHappy Birthday!! Hope your day is as amazing as you are! 🎊 Have an absolutely blast! 🎁🎈`,
};

// ── Anniversary messages ───────────────────────────────────────────────────
const ANNIVERSARY: Record<WishStyle, (m: FamilyMember) => string> = {
  formal: (m) =>
    `Dear ${firstName(m)},\n\nWishing you and your spouse a very Happy Anniversary. May your bond grow stronger and your love deeper with each passing year.`,

  warm: (m) =>
    `Happy Anniversary! 💐\n\nWishing you both many more years of happiness, love, and togetherness. Your partnership is truly beautiful! 💛`,

  fun: (m) =>
    `Happy Anniversary ${firstName(m)}! 🥂💑\n\nHere's to many more years of love, laughter, and adventure together! You two are absolute goals! 🎊✨`,
};

export function generateWishMessage(
  member: FamilyMember,
  type: "birthday" | "anniversary",
  style: WishStyle
): string {
  const bank = type === "birthday" ? BIRTHDAY : ANNIVERSARY;
  return bank[style](member);
}

/** Returns the best phone number to use for WhatsApp (prefers whatsapp field). */
export function resolvePhone(member: FamilyMember): string | undefined {
  return member.whatsapp || member.phone || undefined;
}
