/**
 * SINGLE SOURCE OF TRUTH for all FamilyMember fields.
 *
 * This is imported by:
 *   - Import.tsx  → import column mapping + export column order
 *   - MemberForm  → (field labels used in validation messages)
 *
 * Adding a field here automatically adds it to import/export.
 * The order below matches the MemberForm section order.
 */

import { FamilyMember } from "@/types/family";

export interface FieldDef {
  key: keyof FamilyMember;
  label: string;
  /** Aliases recognised during import (lower-cased, trimmed) */
  aliases?: string[];
}

export const MEMBER_SCHEMA: FieldDef[] = [
  // ── Identity ───────────────────────────────────────────────────────────────
  { key: "memberId",         label: "Member ID",              aliases: ["member id", "memberid", "gk id"] },
  // ── Basic ──────────────────────────────────────────────────────────────────
  { key: "fullName",         label: "Full Name",              aliases: ["full name", "fullname", "name", "first name"] },
  { key: "gender",           label: "Gender",                 aliases: ["gender", "sex"] },
  { key: "birthday",         label: "Birthday",               aliases: ["birthday", "date of birth", "dob", "birth date"] },
  { key: "anniversary",      label: "Anniversary",            aliases: ["anniversary", "wedding date", "marriage date"] },
  { key: "bloodGroup",       label: "Blood Group",            aliases: ["blood group", "blood", "blood type"] },
  { key: "nativePlace",      label: "Native Place",           aliases: ["native place", "native", "hometown", "origin"] },

  // ── Family Hierarchy ───────────────────────────────────────────────────────
  { key: "fatherId",         label: "Father ID",              aliases: ["father id", "fatherid", "dad id"] },
  { key: "motherId",         label: "Mother ID",              aliases: ["mother id", "motherid", "mom id"] },
  { key: "spouseId",         label: "Spouse ID",              aliases: ["spouse id", "spouseid", "partner id"] },
  { key: "spouseName",       label: "Spouse Name",            aliases: ["spouse", "spouse name", "partner name", "wife", "husband"] },
  { key: "generationNumber", label: "Generation Number",      aliases: ["generation number", "generationnumber", "gen number", "gen no"] },
  { key: "generation",       label: "Generation Label",       aliases: ["generation", "generation label"] },
  { key: "siblingOrder",     label: "Sibling Birth Order",    aliases: ["sibling order", "siblingorder", "birth order"] },
  { key: "lineageRootId",    label: "Lineage Root ID",        aliases: ["lineage root", "lineagerootid", "root id"] },
  { key: "mainFamilyBranch", label: "Main Family Branch",     aliases: ["main branch", "main family branch", "family branch", "branch"] },
  { key: "subFamilyBranch",  label: "Sub Family Branch",      aliases: ["sub branch", "sub family branch"] },
  { key: "childrenNames",    label: "Children Names",         aliases: ["children", "children names", "kids"] },

  // ── Contact ────────────────────────────────────────────────────────────────
  { key: "phone",            label: "Phone",                  aliases: ["phone", "phone number", "mobile", "cell"] },
  { key: "whatsapp",         label: "WhatsApp",               aliases: ["whatsapp", "whatsapp number"] },
  { key: "email",            label: "Email",                  aliases: ["email", "email address", "e-mail"] },
  { key: "personalWebsite",  label: "Personal Website",       aliases: ["website", "personal website", "web"] },
  { key: "linkedIn",         label: "LinkedIn",               aliases: ["linkedin", "linkedin url"] },
  { key: "instagram",        label: "Instagram",              aliases: ["instagram", "instagram handle"] },

  // ── Location ───────────────────────────────────────────────────────────────
  { key: "city",             label: "City",                   aliases: ["city", "town"] },
  { key: "country",          label: "Country",                aliases: ["country", "nation"] },
  { key: "address",          label: "Address",                aliases: ["address", "full address", "home address"] },
  { key: "mapsLink",         label: "Maps Link",              aliases: ["maps link", "google maps", "maps url", "mapslink"] },

  // ── Professional ───────────────────────────────────────────────────────────
  { key: "profession",       label: "Profession",             aliases: ["profession", "job", "occupation", "role"] },
  { key: "company",          label: "Current Company",        aliases: ["company", "current company", "employer"] },
  { key: "previousCompany",  label: "Previous Company",       aliases: ["previous company", "previouscompany", "former company"] },
  { key: "businessName",     label: "Business Name",          aliases: ["business name", "businessname", "business"] },
  { key: "education",        label: "Education",              aliases: ["education", "qualification", "degree"] },

  // ── Personal ───────────────────────────────────────────────────────────────
  { key: "hobbies",          label: "Hobbies",                aliases: ["hobbies", "interests"] },
  { key: "skills",           label: "Skills",                 aliases: ["skills", "talents"] },
  { key: "languagesSpoken",  label: "Languages Spoken",       aliases: ["languages", "languages spoken", "language"] },
  { key: "emergencyContact", label: "Emergency Contact",      aliases: ["emergency contact", "emergencycontact", "sos"] },
  { key: "notes",            label: "Notes",                  aliases: ["notes", "remarks", "comments"] },
];

/** Flat map: lowercase alias → FamilyMember field key */
export const IMPORT_ALIAS_MAP: Record<string, keyof FamilyMember> = {};
for (const def of MEMBER_SCHEMA) {
  (def.aliases ?? []).forEach(alias => {
    IMPORT_ALIAS_MAP[alias] = def.key;
  });
  // Also map the key itself
  IMPORT_ALIAS_MAP[def.key.toLowerCase()] = def.key;
}

/**
 * Ordered export columns for Excel/CSV.
 * Photo is intentionally excluded (base64 exceeds Excel cell limits).
 * Internal fields (id, addedAt) are excluded too.
 */
export const EXPORT_COLUMNS: Array<{ key: keyof FamilyMember; label: string }> =
  MEMBER_SCHEMA.map(d => ({ key: d.key, label: d.label }));
