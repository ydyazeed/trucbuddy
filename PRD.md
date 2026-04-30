# TrucBuddy — Product Requirements Document

A mobile-optimized web app that turns four trip inputs (current location, pickup, dropoff, current cycle hours used) into a planned route with stops + drawn ELD daily-log sheets, plus a lite live-tracking layer for active trips.

This PRD is the product of a structured grilling session. Each section's decisions are final and load-bearing — changes should re-trigger the relevant question rather than be made silently.

---

## 1. Goals

- Take four trip inputs from a property-carrying driver and output:
  - A truck-aware route on a map with auto-picked or driver-picked stops (fuel, breaks, rests, restart).
  - One drawn ELD daily-log sheet per calendar day of the trip.
- Allow the driver to "start" the trip and log duty status changes manually with live HOS clocks, hard blocks, and a recalculate-on-change loop.
- Allow the driver to review, edit, sign, and correct daily logs.
- Ship completely free (free hosting tiers + free APIs).

## 2. Out of scope

- HOS exceptions (Adverse Driving, CDL Short-Haul, Non-CDL Short-Haul, 16-Hour) — too much legal nuance to half-implement.
- Speed-based auto-detection of driving status (lite tracking is manual; GPS is ambient context only).
- Driver authentication / accounts / cross-device sync.
- Recovery-code system for lost browser storage.
- Personal conveyance, yard moves, team driving, multi-carrier days, split sleeper berth, international border crossings, truck-restricted routing (HAZMAT / bridge heights / weight limits), DOT inspection mode, panic / "I need help" flow, vehicle-moved-by-shop-personnel audit trail.
- Real fuel prices, parking-fullness data, amenity icons (no free data source).
- PWA / service workers / native wrappers.
- Dark mode.

## 3. Tech stack (locked)

**Frontend:**
- Vite + React 18 + TypeScript
- React Router v6
- Zustand (client state) + TanStack Query (server state, with Dexie persistence for offline)
- Tailwind CSS + shadcn/ui (Radix primitives) + lucide-react icons + sonner toasts
- React Hook Form + Zod
- date-fns (timezone-sensitive math; UTC stored, device-local displayed)
- Leaflet + react-leaflet + OpenStreetMap tiles
- react-signature-canvas
- Sora typeface via @fontsource/sora
- Vitest + React Testing Library

**Backend:**
- Django + Django REST Framework
- SQLite (dev) / PostgreSQL (prod) via dj-database-url
- gunicorn + whitenoise
- pytest-django

**External services (all free):**
- OpenRouteService — routing, `driving-hgv` profile, 2k req/day, single API key in frontend env
- Photon — geocoding + autocomplete + reverse-geocoding (no key)
- OSM tile servers — basemap (no key)
- Overpass API — POI lookup for driver-choice stops (no key)

**Hosting:**
- Vercel — frontend (Vite static SPA)
- Railway — Django backend + PostgreSQL (paid after $5 trial)

## 4. Brand & design language

**Color tokens (Tailwind theme):**
- `brand.coral` — `#E5574E` — destructive actions, red-zone HOS (≤15 min remaining), violation alerts, dropoff marker, on-duty row accent
- `brand.teal` — `#2A7268` — primary CTAs, ok-state HOS, driving-status row, active-state highlights, brand mark
- `brand.mint` — `#C8DCD4` — secondary surfaces, inactive chips, sleeper-berth row accent
- Neutral foundation — slate-900 text, slate-50 canvas, slate-200 borders, amber-500 caution-zone HOS (90 min – 15 min remaining)

**Three-dot motif** (coral / teal / mint) is the brand mark, lockup top-left of app bar.

**Typography:** Sora (free Google Font, self-hosted via @fontsource).
- Sora 800 hero, 700 section heads, 600 buttons, 500 body
- Tabular nums on HOS clocks

**Layout:**
- Mobile-first; `md` breakpoint (768px) flips to desktop sidebar layout.
- Trip-context navigation: bottom tab bar (Map / Timeline / Logs / More).
- Map screen uses bottom-sheet pattern; other screens are flat-page with shadcn cards.
- Min tap target 44×44 px; default button 48 px; list rows 64 px.
- Motion: Tailwind transitions; framer-motion only if needed.
- No dark mode for MVP.

**Frontend design must be done via the `/frontend-design` skill.** All component, page, and design-system work runs through it to maintain visual consistency.

## 5. Data model

### Frontend (browser, IndexedDB via Dexie)

- `events` — append-only log of trip events buffered offline before sync; idempotent via `client_event_id`.
- `tripsCache` — TanStack Query cache projection for offline read.
- `signatureBlob` (localStorage) — base64 PNG of saved signature.
- `client_id` (localStorage, key `truc_client_id`) — UUID v4 generated on first visit; sent as `X-Client-Id` header.

### Backend (PostgreSQL)

**`Trip`**
- `id` (UUID), `client_id` (UUID), `inputs` (JSON: current/pickup/dropoff/cycle_hours), `plan` (JSON: route + stops + daily logs from frontend engine), `status` (`planned` | `active` | `completed`), `created_at`, `updated_at`

**`TripEvent`**
- `id`, `trip_id`, `sequence_number`, `event_type` (status_change, location_ping, stop_arrival, stop_departure, replan, sign_log, correction, …), `payload` (JSON), `occurred_at`, `recorded_at`, `client_event_id` (UUID, idempotency key)
- Unique on `(trip_id, client_event_id)`.

**`DailyLog`**
- `id`, `trip_id`, `log_date`, `log_data` (JSON: 24-hr grid + remarks + totals + placeholder fields), `signed` (bool), `signed_at`, `signature_image` (base64 PNG TextField), `corrections` (JSON array)
- Each correction record: `{ id, original_field_path, original_value, corrected_value, reason, timestamp, client_event_id }`

### Trip lifecycle

`planned → active → completed`. Single active trip per client_id (UI + backend 409). Drafts exist only in form state, not persisted. No transition back from completed. `paused` and `abandoned` states are explicitly excluded.

## 6. API surface

All requests carry `X-Client-Id`. Backend filters everything by client_id; no cross-client visibility.

- `POST   /api/trips/` — create trip from form inputs + computed plan
- `GET    /api/trips/` — list this client's trips (sorted by `updated_at` desc)
- `GET    /api/trips/:id/` — fetch trip + events + logs
- `PATCH  /api/trips/:id/` — update plan or status
- `POST   /api/trips/:id/events/` — append events; accepts batch; idempotent on `client_event_id`
- `GET    /api/trips/:id/logs/` — list logs for trip
- `PATCH  /api/trips/:id/logs/:date/` — pre-signing edits; **409 if signed**
- `POST   /api/trips/:id/logs/:date/sign/` — sign log
- `POST   /api/trips/:id/logs/:date/corrections/` — post-signing corrections; **400 if not signed**

Two-endpoint pre/post-signing model is deliberate: pre-signing edits are silent (the log is a draft), post-signing changes always create an audit-trail record.

## 7. HOS engine (frontend, pure TypeScript)

Lives at `frontend/src/hos/`. No React, no DOM, no fetch. Backend has zero HOS logic.

### Inputs

```
{
  trip:        { current, pickup, dropoff, cycleHoursUsed },
  route:       { legs: [{ distance_mi, duration_hr, geometry }] },  // from ORS
  events:      TripEvent[],                                          // empty at planning, grows during active trip
  preferences: { stopStrategy: 'auto' | 'choice', avgSpeedMph: 55 }
}
```

### Outputs

```
{
  schedule:        TimelineEntry[],
  dailyLogs:       DailyLog[],
  hosClocks:       { drive11, window14, cycle70, sinceBreak8 },
  feasibility:     'ok' | 'needs_restart' | 'infeasible',
  upcoming:        { nextRequiredStop, milesUntil, hoursUntil, reason },
  replanTriggers:  ReplanTrigger[]
}
```

### TimelineEntry

```
{ start, end,
  status:   'driving' | 'on_duty' | 'off_duty' | 'sleeper',
  category: 'drive' | 'pickup' | 'dropoff' | 'fuel' | 'break30' | 'rest10' | 'restart34',
  location: { lat, lng, label },
  distance_mi,
  planned: bool,
  source:  'engine' | 'event' }
```

### Rules

- **Average speed:** 55 mph (override ORS-returned duration).
- **30-min break:** required before 8 cumulative drive hours; **permissive** — any 30-min non-driving period (off-duty, sleeper, on-duty-not-driving) satisfies it. Fuel stops, pickup, dropoff automatically count when ≥30 min.
- **11-hr drive limit:** continuous-clock; resets after 10 hrs off-duty.
- **14-hr window:** clock starts when driver comes on duty; resets after 10 hrs off-duty. App leaves ~10.5 hr usable buffer for traffic variability.
- **70-hr / 8-day cycle:** rolling. Cycle hours used input assumed evenly distributed over past 8 days (`cycle_used / 8` falls off per day). Assumption surfaced in form helper text and trip summary.
- **34-hr restart:** inserted only when trip would otherwise exceed 70-hr cycle.
- **Fuel stops:** every 1,000 driving miles, 30 min on-duty (not driving). Combined with break/rest if within ±30 min.
- **Pickup / dropoff:** 1 hr on-duty (not driving) at each location.
- **Midnight crossing:** engine splits any status period that crosses midnight into two daily-log entries.
- **Daily totals:** four duty-row totals must sum to exactly 24.0 hours per log.

### Algorithm sketches

**Planner:** Walk forward from trip start, maintain HOS clocks, insert mandatory stops *before* a constraint is hit, snap fuel stops to combine with break/rest when timing aligns.

**Replanner:** Same engine; events replace parts of the schedule; rebuild remainder from "now" forward using same rules.

**Determinism:** Same input → same output. Critical for replay, testing, and offline → online sync.

### HOS zones (UI mapping)

- Green (ok): ≥ 90 min remaining on the limit being approached
- Amber (caution): 90 min – 15 min remaining
- Red (block-imminent): ≤ 15 min remaining

## 8. Stop selection

Both modes available; toggleable per trip via a "let me choose / auto-pick for me" switch on the plan view.

### Auto-pick mode

Engine picks every stop. Driver sees the result on the map + timeline. Best-fit stop highlighted but no choice UI surfaced.

### Driver-choice mode (Overpass POI + milestone fallback)

For each required stop window:

1. Query Overpass API within a search corridor along the route (truck-friendly POIs: `amenity=fuel`, `highway=services`, `amenity=parking[hgv=yes]`).
2. Cache by `{ route_hash, window_start_mi, window_end_mi, stop_type }` in localStorage with 7-day TTL.
3. Show 3-5 ranked options. If query times out (3 s) or returns < 3, fall back to milestone-only options ("Mile 320 — Effingham, IL").

### Per-option card

Stop-type icon, place name (or milestone label), city + state, ±mi from ideal, urgency label (`tight margin` < 30 min slack / `comfortable` / `25 mi earlier`), arrival ETA, duration, optional "Recommended" badge.

### Validation

- Stops outside the legal HOS window are blocked with explanation.
- Stops far earlier than ideal are allowed with a time-impact warning.
- Custom-stop search ("find another stop") goes through the same legal-window validation.
- Skipping a fuel stop is allowed; warns if range exceeds 1,000 miles without fuel.
- Re-selecting an earlier stop recalculates downstream; invalidated stops re-prompt.

### Excluded from UI (no free data)

Amenity icons (showers, food, laundry), fuel price, parking fullness ("often full after 6 PM"), no-truck-parking warning on custom stops. Driver sees only what we can compute or fetch from Overpass.

## 9. Daily-log SVG renderer

- 4-row standard FMCSA order, top to bottom: Off Duty / Sleeper Berth / Driving / On Duty (Not Driving).
- 24-hr × 4-row grid, 15-minute resolution (96 cells per row).
- Coordinate model: x = minutes from midnight (0–1440), y = row index.
- Status periods drawn as horizontal lines on appropriate row; vertical connectors at transitions.
- **Visual snap to 15-min boundaries; row-margin totals use true engine durations.** A 17-min stop renders in a 15-min cell; the row total reflects the true 17 min.
- Mobile: full-width 1440-unit SVG inside a horizontal-scroll container with sticky labels (left) and totals (right). No pinch-zoom.
- Desktop: fits naturally without scroll.

### Required log fields (placeholder + editable)

Date, total miles driven, truck/tractor #, trailer #, carrier name, carrier address, driver signature line, remarks (auto-populated `City, ST` at each transition via Photon reverse-geocoding, cached locally), shipping doc # / shipper name.

### Multi-day cases

- Trip starting late: Day 1 fills 00:00 → trip-start as off-duty; trip-start → 23:59 actual.
- Trip ending mid-day: final log fills trip-end → 23:59 with off-duty.
- 34-hr restart day: single off-duty bar spanning 0 → 1440.
- Multiple logs navigable via tabs (desktop) or swipe (mobile).
- Downloadable / printable via browser print + `@page` CSS rules; optional `react-to-print`.

## 10. Active trip tracking — LITE

The full auto-detection + alert-system was scoped down to a manual-but-fluid logger.

### Kept

- "Start Trip" button transitions trip to `active`.
- Manual duty-status changes via clear UI (status picker bottom sheet on mobile).
- Live HOS clocks (11-hr / 14-hr / 70-hr / 8-hr-since-break) updating in real time, with green/amber/red zones.
- "Live banner" showing what's next (e.g., "30-min break in 1h 22m").
- Today's plan timeline with done / in-progress / up-next states.
- GPS coordinates + timestamp captured at each manual status change (`navigator.geolocation.getCurrentPosition` once per change, accuracy filter > 100 m drops).
- Status timer countdown when on a break / rest, with Extend / End-Early controls.
- Hard blocks (modal interrupt):
  - Driving past 11-hr or 14-hr → blocked with "10-hr off-duty required first" explanation.
  - Skipping the 30-min break → blocked.
- One-tap "Take unplanned break" and "End shift early" actions.
- After 10 hrs off-duty event, 11-hr and 14-hr clocks reset; cycle continues.
- "Plans changed → recalculate" action that re-runs the engine with current state.
- Offline event queue in Dexie; drained to backend with `client_event_id` idempotency when `navigator.onLine` returns true. Offline pill in header.

### Cut

Speed-based auto-detection, 4-min stop debounce, accuracy filters as continuous logic, status auto-prompts, 5-min / 20-min auto-default timers, three-tier alert policy, six-trigger automatic re-plan system, modal-cooldown logic, banner-collapse logic, vibration on alerts, iOS-foreground-only complications, GPS gap interpolation, `tracking_paused` / `tracking_resumed` events.

## 11. Log editing & signing

### Pre-signing

- Driver reviews the day's auto-generated log at end of shift.
- Edit status durations + remarks inline.
- Validation: four row totals must sum to **exactly 24.0 hours**. Gaps or overlaps are blocked with the problematic period highlighted.
- Custom remarks supported. Each status change must show city + state.

### Signing

- Tap-and-draw signature on canvas (`react-signature-canvas`).
- "Save this signature" option on first sign — stored as base64 PNG in localStorage for one-tap reuse on subsequent logs.
- After signing, pre-signing edit form is replaced with read-only view + "Make a correction" button.

### Post-signing corrections

- Modal flow: original value (read-only, struck-through), corrected value (editable), required reason ≥ 10 chars.
- On submit, append to `DailyLog.corrections[]`; `log_data` updates; visible "✱ corrected" indicator on changed periods, tappable to view audit trail.
- Backend `PATCH /logs/:date/` returns 409 if signed; `POST /logs/:date/corrections/` returns 400 if not signed.

### Unsigned logs

Persistent reminder banner ("1 unsigned log from 2026-04-26") with tap-to-review-sign. Trip can complete with unsigned logs; they remain visible with a yellow indicator. No auto-sign, no auto-discard.

### Time zones

Single time zone per trip. Stored UTC, displayed device-local. Cross-zone trips not specially handled in MVP.

## 12. Edge cases — accepted & handled

- Cycle hours = 0 → fresh, full 70 available.
- Cycle hours = 70 → driver cannot drive without 34-hr restart; UI shows prominently.
- Cycle hours > 70 → rejected with explanation.
- Cycle hours negative / non-numeric → rejected.
- 65+ hours used → preemptive warning that drive time is very limited.
- 55–65 hours used → plan computed; flagged if it exceeds remaining cycle.
- Current location = pickup → deadhead leg skipped.
- Pickup = dropoff → zero-distance trip; confirmation prompt before proceeding.
- Current location = dropoff → single-leg empty return.
- Trip exactly at 11-hr drive limit → engine leaves ~10.5 hr usable buffer.
- Trip < 8 driving hours → no 30-min break inserted.
- Trip ≤ 11 driving hours → single daily log, no overnight rest.
- Failed geocoding → clear error with retry, never silent fallback.
- No-route-available → clear error with retry.
- Status period crossing midnight → split at 23:59:59 / 00:00:00 boundary by engine.

## 13. Project layout

```
trucbuddy/
├── frontend/
│   └── src/
│       ├── api/             # TanStack Query hooks + fetch wrapper + X-Client-Id injection
│       ├── components/
│       │   ├── ui/          # shadcn primitives
│       │   ├── map/         # Leaflet + markers + route polyline + bottom sheets
│       │   ├── log/         # SVG daily-log renderer + editor + signature pad
│       │   ├── timeline/
│       │   ├── stops/
│       │   └── hos/         # HOS clocks, banners, replan modal
│       ├── hos/             # PURE engine — no React, no DOM, no fetch
│       │   ├── engine.ts
│       │   ├── rules.ts
│       │   ├── schedule.ts
│       │   ├── replan.ts
│       │   ├── logs.ts
│       │   ├── types.ts
│       │   └── __tests__/
│       ├── poi/             # Overpass query + cache
│       ├── geocode/         # Photon wrapper + reverse-geocode cache
│       ├── routing/         # OpenRouteService wrapper
│       ├── store/           # Zustand stores
│       ├── db/              # Dexie schema + offline event queue
│       ├── pages/           # Route components
│       ├── routes.tsx
│       ├── lib/
│       └── main.tsx
├── backend/
│   ├── config/              # Django project (settings, urls, wsgi)
│   ├── trips/               # single app — Trip, TripEvent, DailyLog
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── auth.py          # ClientIdAuthentication
│   │   └── tests/
│   ├── manage.py
│   ├── requirements.txt
│   └── Procfile
├── .github/workflows/       # typecheck + vitest + pytest
├── PRD.md                   # this document
├── CLAUDE.md
├── driver-scenarios-and-edge-cases.md
├── hos-rules.md
└── README.md
```

## 14. Local dev

**Backend**
```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # http://localhost:8000
```

**Frontend**
```
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

**Env vars**
- `frontend/.env.local`: `VITE_API_BASE_URL=http://localhost:8000`, `VITE_ORS_API_KEY=…`
- `backend/.env`: `DATABASE_URL=sqlite:///db.sqlite3`, `CORS_ALLOWED_ORIGINS=http://localhost:5173`, `ALLOWED_HOSTS=localhost,127.0.0.1`

## 15. Deployment

**Frontend → Vercel**
- Connect Git repo, root = `frontend/`, framework = Vite.
- Env: `VITE_API_BASE_URL` (Railway public URL), `VITE_ORS_API_KEY`.

**Backend → Railway**
- Two services: `backend` (Django) + `postgres`.
- Root = `backend/`. Build: `pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput`. Start: `gunicorn config.wsgi --bind 0.0.0.0:$PORT`.
- Railway injects `DATABASE_URL` automatically.
- `ALLOWED_HOSTS` includes `*.up.railway.app`.
- `CORS_ALLOWED_ORIGINS` includes Vercel preview + production URLs.

## 16. Testing strategy

- **HOS engine** — heavy Vitest coverage. Pure module makes this trivial. Cover: 30-min break permissive rule, 11/14-hr boundaries, midnight splits, fuel-stop combination, 34-hr restart insertion, exact 24.0 sum, infeasibility detection, replan determinism.
- **Frontend integration** — React Testing Library smoke tests on form submission, log editing 24.0-validation, signing flow.
- **Backend** — pytest-django on each endpoint: client_id isolation, idempotent event append, pre/post-signing endpoint contract (409 / 400).
- **CI** — GitHub Actions runs `npm run typecheck && npm test` and `pytest` on every push.
- **No E2E** in MVP — too slow to iterate.

## 17. Risks & known limitations

- **Phone GPS in a web browser is best-effort.** No background tracking when iOS Safari suspends the tab. Lite tracking captures GPS only at manual status changes, mitigating the risk.
- **OpenRouteService free tier** is 2k req/day. Sufficient for demo; would need a key rotation or upgrade for real traffic.
- **Overpass API** is community-run; can be slow or sparse on rural stretches. Milestone fallback handles this.
- **Anonymous client_id in localStorage** — clearing site data loses trips. Disclosed via one-line text on trips page; no recovery flow.
- **Railway** has no perpetual free tier; ~$5/mo after $5 trial credit.
- **No real ELD compliance** — this is a planner / logger, not FMCSA-certified hardware. Made explicit in README and not marketed otherwise.
