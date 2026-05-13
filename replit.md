# G K Shah Family Chronicle

A private, mobile-first family genealogy and directory PWA for the G K Shah family — installable on Android and iPhone, works fully offline after install.

## Run & Operate

- `pnpm --filter @workspace/family-directory run dev` — run the frontend
- `pnpm --filter @workspace/api-server run dev` — run the API server (not used by app)
- `pnpm --filter @workspace/family-directory run typecheck` — typecheck the app
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4
- Routing: wouter
- Forms: react-hook-form + zod
- Charts: recharts
- Date utilities: date-fns
- Animations: framer-motion
- Themes: next-themes (dark mode)
- Toasts: sonner
- Icons: lucide-react
- Import/Export: xlsx + papaparse
- Storage: localStorage (no backend required)
- Command palette: cmdk (already installed)

## Where things live

- `artifacts/family-directory/src/` — main React app
- `artifacts/family-directory/src/hooks/useFamilyStore.ts` — localStorage CRUD store with schema v2, validation, auto-lineage, memberId generation, duplicate detection
- `artifacts/family-directory/src/hooks/useAdminMode.ts` — lazy-init admin state (no flash)
- `artifacts/family-directory/src/hooks/usePhotoCache.ts` — IndexedDB photo cache hook (Phase 3)
- `artifacts/family-directory/src/types/family.ts` — FamilyMember interface + sample data
- `artifacts/family-directory/src/lib/familyTree.ts` — tree builder, query utils, data integrity checks
- `artifacts/family-directory/src/lib/relationships.ts` — relationship engine
- `artifacts/family-directory/src/lib/memberSchema.ts` — unified 36-field schema for import/export
- `artifacts/family-directory/src/lib/repository.ts` — repository abstraction layer (Phase 8)
- `artifacts/family-directory/src/components/CommandPalette.tsx` — Cmd+K global command palette
- `artifacts/family-directory/src/pages/` — Dashboard, Members, MemberProfile, MemberForm, FamilyTree, RelationshipExplorer, Import, Statistics, Settings, DataHealth
- `artifacts/family-directory/src/components/` — layout, member cards, filters, dashboard widgets
- `artifacts/family-directory/public/manifest.json` — PWA manifest
- `artifacts/family-directory/public/sw.js` — service worker for offline support

## Architecture decisions

- All data stored in localStorage under key `gkshah_family_members` — schema version 2 format `{ version: 2, members: [...] }`
- Backward compatible: plain array format (v1) auto-migrated on load
- Photos stored as base64 data URLs in localStorage (max 2MB per photo recommended)
- PWA-first: manifest.json + service worker enable "Add to Home Screen" on Android/iOS
- Warm amber/terracotta palette to feel like a family heirloom, not a generic contacts app
- Recharts used for statistics visualizations (city, generation, branch, blood group)
- `generationNumber` and `lineageRootId` auto-computed on addMember/updateMember — no manual entry needed
- `childrenIds` arrays rebuilt automatically on every save via `rebuildChildrenArrays()`
- `memberId` (e.g. GK-G1-0001) auto-assigned on creation or migration; never editable; internal `id` (UUID) remains primary key
- `updatedAt` stamped on every addMember/updateMember; `isArchived`/`archivedAt` for soft delete
- Repository abstraction layer in `src/lib/repository.ts` decouples storage from UI — ready for backend migration

## Product

- Dashboard: total members, upcoming birthdays (30 days), upcoming anniversaries, generation breakdown
- Members: searchable directory with multi-field filters (city, country, branch, generation, gender, blood group, company, profession)
- Member profiles: ancestry breadcrumb path, memberId badge (# GK-G3-0001), family position stats, "How are we related?" quick action
- Family Tree: recursive hierarchical renderer with generation colour coding, Expand All / Collapse All, **generation filter chips (show up to Gen N)**, debounced search, zoom+pan, touch support
- **Relationship Explorer** (`/relationships`): select any two members, compute exact kinship label, show path; **pre-populates Person A from `?from=<memberId>` URL param**
- Add/edit members: form with relationship dropdowns, validation, **duplicate detection dialog**
- Import (admin only): Excel/CSV with smart column auto-matching, Skip or Overwrite duplicate mode toggle, preview before import
- Export: Excel + CSV with all 36 fields including memberId
- Data integrity utilities: detectOrphans(), detectCircularRelationships(), rebuildChildrenArrays(), repairMissingLineageRoots()
- Statistics: Genealogy Snapshot, Longest Lineage Chain, Largest Sibling Group, charts
- **Data Health** (`/data-health`, admin only): 10-check integrity report with severity labels, repair buttons, export to JSON
- **Command Palette** (`⌘K` / `Ctrl+K`): global search for members by name/city/profession/memberId, navigation shortcuts, recent searches, copy Member ID, "Find relationship" action
- Dark mode toggle
- PWA install + offline support
- Soft delete (archive/unarchive)

## Admin

- Password: `gkshah2024` (default; changeable in Settings while admin)
- localStorage keys: `gkshah_family_members`, `gkshah_admin_mode`, `gkshah_admin_password`, `gkshah_recent_searches`
- Admin gates: Add/Edit member, Import/Export, Delete member, Change password, **Data Health**
- Admin nav: Data Health appears under "Admin" section in sidebar when logged in

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- No backend: all data lives in the browser's localStorage — data is per-device and per-browser
- Photos are stored as base64 in localStorage — large photos may approach storage limits; compress before uploading
- IndexedDB photo abstraction (photoRepository) exists in repository.ts — not yet wired into member renders; `photo: "idb:<memberId>"` prefix scheme is ready when needed
- PWA install prompt appears in browser's address bar after first visit on mobile
- xlsx@0.18.5 has a known prototype pollution CVE — upgrade path blocked by Vite/ESM compatibility; mitigation: parse only trusted/self-exported files
- `pnpm audit --filter` flag does not exist; use plain `pnpm audit` at root

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- `familyTree.ts` exports: `buildFamilyTree`, `getDescendants`, `getAncestors`, `getAncestryPath`, `getSearchState`, `wouldCreateCircularAncestry`, `detectOrphans`, `detectCircularRelationships`, `rebuildChildrenArrays`, `repairMissingLineageRoots`, `runIntegrityCheck`
- `relationships.ts` exports: `buildAncestorDepthMap`, `findCommonAncestor`, `findRelationshipPath`, `kinshipLabel`, `calculateRelationship`, `computeGenealogyInsights`
- `repository.ts` exports: `familyRepository` (LocalStorage), `photoRepository` (IndexedDB), `relationshipCache` (in-memory), plus interfaces `FamilyRepository`, `PhotoRepository`, `RelationshipRepository`
- All relationship validation flows through `useFamilyStore.validateRelationship()`
- `useFamilyStore` exposes `detectPotentialDuplicates(candidate, excludeId?)` for use in forms
- `useFamilyStore` exposes `archiveMember(id)` and `unarchiveMember(id)` for soft delete
- Relationship kinship formula: degree = min(dA,dB)−1, removed = |dA−dB| where dA/dB = steps to common ancestor
- Command palette recent searches stored in localStorage key `gkshah_recent_searches`
