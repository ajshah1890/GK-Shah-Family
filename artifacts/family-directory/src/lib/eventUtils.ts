/**
 * Shared event/date utility functions used by dashboard event components
 * and the Events page. All helpers are timezone-safe: they extract date
 * components directly from the YYYY-MM-DD prefix of any ISO string, which
 * avoids the UTC-midnight-vs-local-midnight shift that `parseISO` + `getDate()`
 * produces in UTC+ and UTC- timezones.
 */

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;

export const MONTH_NAMES_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
] as const;

/** Extract { month (0-indexed), day } from any ISO date string. */
export function parseDateParts(raw: string): { month: number; day: number } | null {
  if (!raw || typeof raw !== "string") return null;
  const clean = raw.trim().slice(0, 10);
  if (clean.length < 10 || clean[4] !== "-" || clean[7] !== "-") return null;
  const month = parseInt(clean.slice(5, 7), 10) - 1;
  const day   = parseInt(clean.slice(8, 10), 10);
  if (
    isNaN(month) || isNaN(day) ||
    month < 0 || month > 11 ||
    day < 1 || day > 31
  ) return null;
  return { month, day };
}

/** Extract { year, month (0-indexed), day } from any ISO date string. */
export function parseDateFullParts(
  raw: string
): { year: number; month: number; day: number } | null {
  if (!raw || typeof raw !== "string") return null;
  const clean = raw.trim().slice(0, 10);
  if (clean.length < 10 || clean[4] !== "-" || clean[7] !== "-") return null;
  const year  = parseInt(clean.slice(0, 4), 10);
  const month = parseInt(clean.slice(5, 7), 10) - 1;
  const day   = parseInt(clean.slice(8, 10), 10);
  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    month < 0 || month > 11 ||
    day < 1 || day > 31
  ) return null;
  return { year, month, day };
}

/**
 * Couple dedup key: alphabetically sorted names + date string.
 * Ensures (A, B) and (B, A) map to the same key.
 */
export function coupleKey(nameA: string, nameB: string, dateStr: string): string {
  return [nameA.trim(), nameB.trim()]
    .map(n => n.toLowerCase())
    .sort()
    .join("|") + "|" + dateStr.slice(0, 10);
}

/** Format a { month, day } pair as "Month D" (e.g. "May 16"). */
export function formatMonthDay(month: number, day: number): string {
  return `${MONTH_NAMES[month]} ${day}`;
}
