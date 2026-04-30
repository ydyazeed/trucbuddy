# TrucBuddy — Project Context for Claude

A mobile-optimized React + Django web app: 4-input trip form → truck-aware route + drawn ELD daily-log sheets, with a lite live-tracking layer.

## Authoritative spec

**[PRD.md](PRD.md)** is the source of truth for product scope, architecture, data model, API surface, HOS rules, edge cases, and deployment. Read it before starting any non-trivial change. If a request conflicts with PRD.md, surface the conflict — don't silently deviate.

Supporting docs:
- [driver-scenarios-and-edge-cases.md](driver-scenarios-and-edge-cases.md) — original scenario checklist (note: PRD scopes some items out of MVP)
- [hos-rules.md](hos-rules.md) — FMCSA hours-of-service reference

## Frontend design — use the `/frontend-design` skill

**Any frontend design or visual work must go through the `/frontend-design` skill.** That includes:

- Building or restyling components (shadcn/ui based)
- Designing pages, layouts, navigation flows
- Picking spacing, typography, motion, iconography
- Anything that touches the look-and-feel of the app

Brand tokens (defined in PRD §4) are non-negotiable inputs to that skill:
- `brand.coral` `#E5574E`, `brand.teal` `#2A7268`, `brand.mint` `#C8DCD4`
- Typeface: Sora (`@fontsource/sora`)
- Three-dot motif (coral / teal / mint) is the brand mark
- Mobile-first, bottom tabs in trip context, no dark mode

## Stack quick reference

**Frontend:** Vite + React + TypeScript + React Router + Zustand + TanStack Query + Tailwind + shadcn/ui + RHF + Zod + date-fns + Dexie + Leaflet + react-signature-canvas + Sora + lucide-react + sonner + Vitest

**Backend:** Django + DRF + SQLite (dev) / PostgreSQL (prod) + pytest-django

**External (free):** OpenRouteService (routing) + Photon (geocoding) + OSM tiles + Overpass (POI)

**Hosting:** Vercel (frontend) + Railway (backend + Postgres)

## Repo layout

```
trucbuddy/
├── frontend/    # Vite + React app
├── backend/     # Django project (single `trips` app, 3 models)
├── PRD.md
├── CLAUDE.md
└── README.md
```

Detailed directory structure lives in PRD §13.

## HOS engine

Pure TypeScript module at `frontend/src/hos/`. **No React, no DOM, no fetch.** Backend has zero HOS logic — it's a persistence + sync layer only. The engine is deterministic: same inputs → same outputs. Heavy Vitest coverage required (PRD §16).

## Local dev

```
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # :8000

# Frontend
cd frontend && npm install
npm run dev                       # :5173
```

Env vars in PRD §14.

## Conventions

- TypeScript everywhere on the frontend; no `any` without justification.
- Single Django app `trips`. Don't split into multiple apps prematurely.
- Anonymous `X-Client-Id` header on every API request (UUID v4 in `localStorage['truc_client_id']`). Backend filters all queries by it.
- Event sourcing: `TripEvent` is append-only with `client_event_id` idempotency keys.
- Two-endpoint log model: `PATCH /logs/:date/` (pre-signing, 409 if signed) vs `POST /logs/:date/corrections/` (post-signing, 400 if not signed).
- Daily-log totals must sum to **exactly 24.0 hours** — engine and validators enforce.
- Time stored UTC, displayed device-local; single timezone per trip.
- No comments unless the *why* is non-obvious.
- No README/docs files unless explicitly requested (PRD and this file are the exceptions).

## Out of scope (don't add unprompted)

HOS exceptions, auto-detected driving status, driver auth/accounts, cross-device sync, recovery codes, personal conveyance, yard moves, team driving, split sleeper berth, international borders, HAZMAT/truck-restricted routing, DOT inspection mode, panic flow, dark mode, PWA / service workers, real fuel prices, parking-fullness data, amenity icons.
