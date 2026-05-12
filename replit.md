# G K Shah Family Directory

A private, mobile-first family network and directory PWA for the G K Shah family — installable on Android and iPhone, works fully offline after install.

## Run & Operate

- `pnpm --filter @workspace/family-directory run dev` — run the frontend (port 20214)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000, not used by app)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

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
- Storage: localStorage (no backend required)

## Where things live

- `artifacts/family-directory/src/` — main React app
- `artifacts/family-directory/src/hooks/useFamilyStore.ts` — localStorage CRUD store (source of truth for all data)
- `artifacts/family-directory/src/types/family.ts` — FamilyMember interface + sample data
- `artifacts/family-directory/src/pages/` — all pages (Dashboard, Members, MemberProfile, MemberForm, Statistics, Settings)
- `artifacts/family-directory/src/components/` — layout, member cards, filters, dashboard widgets
- `artifacts/family-directory/public/manifest.json` — PWA manifest
- `artifacts/family-directory/public/sw.js` — service worker for offline support

## Architecture decisions

- All data stored in localStorage under key `gkshah_family_members` — no backend needed, fully offline-capable
- Photos stored as base64 data URLs in localStorage
- PWA-first: manifest.json + service worker enable "Add to Home Screen" on Android/iOS
- Warm amber/terracotta palette to feel like a family heirloom, not a generic contacts app
- Recharts used for statistics visualizations (city, blood group, branch, profession breakdowns)

## Product

- Dashboard with live stats: total members, upcoming birthdays (next 30 days), upcoming anniversaries
- Members directory with search (name, city, profession, company) and filters (city, country, branch, profession)
- Full member profile pages with call/WhatsApp/email action buttons
- Add/edit/delete members with photo upload (base64 stored locally)
- Family statistics page with charts
- Import/export JSON for data backup and sharing
- Dark mode toggle

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- No backend: all data lives in the browser's localStorage — data is per-device and per-browser
- Photos are stored as base64 in localStorage — large photos may approach storage limits; recommend compressing before uploading
- PWA install prompt appears in browser's address bar after first visit on mobile

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
