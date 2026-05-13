import { FamilyMember } from "@/types/family";

export type AuditAction = "create" | "update" | "delete" | "archive" | "unarchive" | "merge";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  memberId: string;
  memberName: string;
  timestamp: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  note?: string;
}

const AUDIT_KEY = "gkshah_audit_log";
const MAX_ENTRIES = 500;

const SKIP_DIFF_KEYS = new Set([
  "id", "childrenIds", "updatedAt", "addedAt", "lineageRootId",
]);

export function logAudit(entry: Omit<AuditEntry, "id">): void {
  try {
    const existing = readAuditLog();
    const next: AuditEntry[] = [
      { ...entry, id: crypto.randomUUID() },
      ...existing,
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(next));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function readAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuditEntry[];
  } catch {
    return [];
  }
}

export function clearAuditLog(): void {
  localStorage.removeItem(AUDIT_KEY);
}

export function diffMembers(
  before: Partial<FamilyMember>,
  after: Partial<FamilyMember>
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (SKIP_DIFF_KEYS.has(key)) continue;
    const fromVal = (before as Record<string, unknown>)[key];
    const toVal = (after as Record<string, unknown>)[key];
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      changes[key] = { from: fromVal, to: toVal };
    }
  }
  return changes;
}
