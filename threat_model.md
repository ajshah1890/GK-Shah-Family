# Threat Model

## Project Overview

G K Shah Family Directory is a React + Vite progressive web app that is deployed in production as a static site from `artifacts/family-directory`. Its stated purpose is a private family directory, but its production architecture has no backend trust anchor, no server-side session handling, and no access-control layer: the browser downloads the entire app and all bootstrap data. Data is persisted locally in `localStorage`, and the included Express API artifact is not wired into the production deployment for this app.

## Assets

- **Family directory data** — names, phone numbers, email addresses, birthdays, anniversaries, cities, addresses, blood groups, professions, and family-relationship metadata. This is sensitive personal information and is the primary asset.
- **Imported backups and spreadsheets** — JSON/CSV/Excel imports can replace or extend the directory contents. A malicious import can become a trusted data source inside the app.
- **Local browser state** — `localStorage` holds the directory dataset and admin-mode flags/passwords for the current browser profile.
- **User privacy metadata** — who is viewing the directory, which family records are viewed, and whether those actions are disclosed to third parties through remote resources.

## Trust Boundaries

- **Public internet to browser app** — every deployed visitor receives the full frontend bundle. The client must be treated as fully untrusted, and any data embedded in the bundle is effectively public.
- **User-supplied import file to application state** — JSON/CSV/Excel imports cross from untrusted external files into trusted in-app state and then into rendered links and images.
- **Application state to browser storage** — the app persists sensitive records and admin-mode state into `localStorage`, which is readable by any script executing in the origin.
- **Browser to third-party resources** — remote avatar URLs and other external links can disclose family identifiers and viewer metadata outside the application boundary.
- **Production vs dev-only artifacts** — `artifacts/mockup-sandbox/**` is sandbox-only and out of scope for production findings. `artifacts/api-server/**` exists in the repo, but the production artifact for this application is the static `family-directory` service, so server-only findings there are out of scope unless production reachability changes.

## Scan Anchors

- **Production entry point:** `artifacts/family-directory/src/main.tsx`
- **Routing / public surface:** `artifacts/family-directory/src/App.tsx`
- **Primary sensitive data source:** `artifacts/family-directory/src/hooks/useFamilyStore.ts`
- **Bundled bootstrap data:** `artifacts/family-directory/src/types/family.ts`
- **Import / export boundary:** `artifacts/family-directory/src/pages/Import.tsx`, `artifacts/family-directory/src/pages/Settings.tsx`, `artifacts/family-directory/src/lib/memberSchema.ts`
- **Risky link/image rendering:** `artifacts/family-directory/src/pages/MemberProfile.tsx`, `artifacts/family-directory/src/components/members/MemberCard.tsx`
- **Dev-only / usually skip:** `artifacts/mockup-sandbox/**`, `artifacts/api-server/**` for this deployment shape

## Threat Categories

### Spoofing

There is no production authentication boundary for viewing directory contents. If the application is intended to be private, the system must require a real authentication mechanism before exposing family records. Client-side flags in `localStorage` are not a valid identity proof.

### Tampering

Imported JSON, CSV, and Excel data is attacker-controlled input. The application must validate imported records against a strict schema and reject dangerous URL schemes or unexpected fields before persisting them. Client-side-only admin gates do not meaningfully protect imported state from abuse on the local device.

### Information Disclosure

Because the production deployment is a static public site, any family data embedded in the shipped bundle or seeded into `localStorage` is exposed to every visitor. The application must not bundle private directory records into public assets, and it must avoid leaking member identifiers or viewer metadata to third-party resources unless that disclosure is an explicit, accepted design choice.

### Elevation of Privilege

Security-sensitive actions such as bulk import, bulk export, and edit flows currently rely on browser-local state instead of a server-enforced permission model. The required guarantee is that any privileged action must be authorized by a trust anchor outside attacker-controlled client storage whenever the product claims privacy or restricted administration.
