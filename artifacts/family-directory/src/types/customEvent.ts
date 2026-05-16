export type CustomEventCategory =
  | "reunion"
  | "ceremony"
  | "celebration"
  | "festival"
  | "memorial"
  | "other";

export interface CategoryMeta {
  value: CustomEventCategory;
  label: string;
  emoji: string;
  color: string; // tailwind bg class for badge
}

export const CUSTOM_EVENT_CATEGORIES: CategoryMeta[] = [
  { value: "reunion",     label: "Reunion",     emoji: "🏡", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { value: "ceremony",    label: "Ceremony",    emoji: "🎗️", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "celebration", label: "Celebration", emoji: "🎉", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "festival",    label: "Festival",    emoji: "🪔", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "memorial",    label: "Memorial",    emoji: "🕯️", color: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300" },
  { value: "other",       label: "Other",       emoji: "📅", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
];

export function getCategoryMeta(cat: CustomEventCategory): CategoryMeta {
  return CUSTOM_EVENT_CATEGORIES.find(c => c.value === cat) ?? CUSTOM_EVENT_CATEGORIES[5];
}

export interface CustomEvent {
  id: string;
  title: string;
  description?: string;
  /** "YYYY-MM-DD" */
  date: string;
  category: CustomEventCategory;
  /** IDs of related FamilyMembers */
  relatedMemberIds: string[];
  /** If true, event repeats every year on this month/day */
  recurring: boolean;
  imageUrl?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}
