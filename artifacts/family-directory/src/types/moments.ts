export type EventType =
  | "Birthday"
  | "Anniversary"
  | "Wedding"
  | "Vacation"
  | "Achievement"
  | "Festival"
  | "Reunion"
  | "Childhood Memory"
  | "Legacy"
  | "Other";

export const EVENT_TYPES: EventType[] = [
  "Birthday",
  "Anniversary",
  "Wedding",
  "Vacation",
  "Achievement",
  "Festival",
  "Reunion",
  "Childhood Memory",
  "Legacy",
  "Other",
];

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  Birthday: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300",
  Anniversary: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300",
  Wedding: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  Vacation: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300",
  Achievement: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  Festival: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  Reunion: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  "Childhood Memory": "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300",
  Legacy: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  Other: "bg-muted text-muted-foreground border-border",
};

export const EVENT_TYPE_EMOJIS: Record<EventType, string> = {
  Birthday: "🎂",
  Anniversary: "💕",
  Wedding: "💍",
  Vacation: "✈️",
  Achievement: "🏆",
  Festival: "🎉",
  Reunion: "👨‍👩‍👧‍👦",
  "Childhood Memory": "🧸",
  Legacy: "📜",
  Other: "📸",
};

export interface Moment {
  id: string;
  caption: string;
  photoKeys: string[];
  taggedMemberIds: string[];
  eventDate: string;
  createdAt: string;
  updatedAt: string;
  location?: string;
  branch?: string;
  eventType: EventType;
  favorite: boolean;
  archived: boolean;
}
