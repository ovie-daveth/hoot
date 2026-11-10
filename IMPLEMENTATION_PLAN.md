# Luma Clone — Implementation Plan & Progress Tracker

Created: 2026-11-10 · Last updated: 2026-11-10

This file is the working tracker for the Luma-inspired event hosting / registration / ticketing app.
Product behaviour spec lives in `claude.md`. This file records **locked decisions**, the **agreed
architecture**, and **build progress**. Update it after every phase:

- Tick `[ ]` → `[x]` when a sub-item is done and verified.
- Append a dated row to the **Progress Log** (what changed, checks run, gaps left).
- Add anything discovered but deferred to **Remaining Gaps / Deferred**.
- Never mark a phase done without running the **Verification Gates**.

---

## 1. Locked decisions (agreed 2026-11-10)

| # | Decision | Value |
|---|---|---|
| 1 | Backend | **Contracts-first now**; `backend/` Node/TS service step later. Backend is server-authoritative for all money, inventory, ownership. |
| 2 | Platform commission | **5%** of gross per successful paid registration (Note: user initially said 10%; `claude.md` 5% confirmed as MVP default). Configurable server-side, never hardcoded in the app. Snapshot rate + amount per payment. |
| 3 | Payment provider | **Monnify, NGN** — implemented at backend level later. Adapter interface defined in contracts now; generic so another provider can slot in. |
| 4 | Money representation | Integer minor units (kobo) everywhere in contracts/APIs. Commission = `floor(gross × rate)`. No floats, no client-trusted totals. |
| 5 | Inventory | Server-enforced conditional stock increments + time-limited holds (TTL), cron release of expired holds. |
| 6 | Event dimensions | Format: online / offline (independent of) Admission: free / paid → 4 combinations supported. |
| 7 | Online events | MVP = external meeting URL only (Zoom/Meet/Teams), stored as **private** data, never in public event responses. Extensible for hosted rooms later. |
| 8 | Maps | Google Places autocomplete via backend proxy (keys stay server-side). Persist `place_id` + lat/lng. Map preview = static map image; open directions via OS maps. |
| 9 | Auth | Optional for attendees (guest checkout + unguessable ticket token). Required for organiser features. |
| 10 | Payouts | Organiser withdrawal-request model; transfer fee actual-fetched (not hardcoded), shown before confirm; failed transfers must not permanently reduce balance. Compliance caveat in `claude.md` applies. |
| 11 | Visual language | Keep existing Expo/RN starter look: `ThemedText` / `ThemedView`, `Spacing`, light/dark `Colors`, `NativeTabs`. No new design system. |

## 2. System topology (target end state)

```
Mobile app (Expo 58, unchanged visual language)
   │  HTTPS, typed shared contracts (zod in shared/)
   ▼
Backend API (server-authoritative, future) ── PaymentAdapter (Monnify now; pluggable)
   │                                          └─ Places/Maps proxy (Google keys server-side only)
   ▼
PostgreSQL (identity · events · ticketing · payments · append-only ledger · payouts)
   ▲
Monnify webhooks (signature-verified, idempotent) + cron (hold expiry, payout reconciliation)
```

## 3. Repo layout (target)

```
(root)
  claude.md                 product spec (source of truth)
  IMPLEMENTATION_PLAN.md    this file — progress tracker
  src/                      mobile app (current Expo 58 app)
    app/                    Expo Router routes
      _layout.tsx           root stack (modals: create-event, checkout)
      (tabs)/               Discover · My Tickets · Host · Profile
      event/[slug].tsx      public event detail (deep-link share target)
      register/[slug].tsx   guest registration + checkout states
      create-event/         guided wizard steps
      manage/[eventId]/…    attendees · check-in · earnings · withdrawal
      auth/…
    api/
      client.ts             ← SWAP POINT: mock adapter now, real HTTPS client later
      mock/                 clearly-labelled sample data; nothing outside client.ts imports it
      events.ts tickets.ts payments.ts ledger.ts (query hooks)
    components/             existing Themed* + new primitives (Button, Input, Field, Card,
                            Chip, EmptyState, Money, StepDots)
    lib/                    money.ts (kobo math), datetime.ts (tz-safe), validation
    store/                  auth state, guest ticket token store
  shared/                   zod contract schemas, PaymentAdapter interface, money utils
  backend/                  future Node/TS service (contracts + Monnify + Postgres)
  docs/api-contracts.md     endpoint list + backend responsibilities
```

## 4. Contract essentials (must not change silently)

- Public event responses exclude: attendee lists, private online links, organiser financials,
  payment secrets. Drafts/cancelled events unreachable in public routes.
- Registration statuses: `pending → confirmed | cancelled`; refund status separate; `checked_in` recorded.
- Ticket issuance: opaque non-guessable ticket code; QR payload `lumaclone://t/<token>`;
  issuance idempotent against webhook retries; backend validates at check-in.
- Check-in validation: ticket exists → belongs to event → confirmed & not refunded → not already checked in.
- Withdrawal states: `requested / processing / paid / failed / reversed`; failed transfers reversable
  via compensating ledger entries (never silently edit history).
- Ledger entry types: gross payment, platform commission, processing fee, organiser payable,
  refund, payout, transfer fee, reversal/adjustment. Append-only.

## 5. Approved dependencies (add only with reason, via `npx expo install`)

| Package | Reason |
|---|---|
| `@tanstack/react-query` | Server-state hooks; same hooks work over mock or real client |
| `zod` | Shared contract schemas (shared/ + api layer validation) |
| `expo-image-picker` | Event cover image selection |
| `expo-video` | Muted cover-video preview and event-detail playback |
| `expo-camera` | Check-in QR scanner (`CameraView`) |
| `expo-secure-store` | Auth/session + guest ticket token storage |
| `react-native-svg` + `react-native-qrcode-svg` | Ticket QR rendering |
| `date-fns` + `date-fns-tz` | Timezone-safe event date rendering (Hermes Intl limits) |
| `expo-notifications` | Later phase only (reminders/status updates) |

Not approved: `react-native-maps` / `expo-maps` for MVP (static map image instead → stays Expo Go compatible).

## 6. Build phases

### Phase 1 — Contracts first
- [x] `shared/contracts`: schema for User, OrganiserProfile, Event, TicketType, Registration, Payment, Ticket, LedgerEntry, Withdrawal, Place
- [x] `shared/contracts`: PaymentAdapter interface (initTransaction, verifyTransaction, handleWebhook, refund, transfer) — provider-agnostic, Monnify-shaped
- [x] `shared/money.ts` — integer kobo helpers, `floor` commission calc
- [x] `docs/api-contracts.md` — endpoint list + backend responsibilities (auth, holds, webhook idempotency, ownership, ledger semantics)
- [x] Verification gates pass

Notes (2026-11-10):
- Added `zod@4.6.7` via `npx expo install` (contracts runtime). Place schema is `Venue` inside
  `shared/contracts/event.ts` (no separate file).
- Added `@shared/*` tsconfig path alias (mirrors existing `@/` alias pattern).
- `docs/api-contracts.md` includes full endpoint surface incl. webhooks, ledger, places proxy,
  and backend-phase participants' still-open decisions (auth mechanism, hosting, Monnify funds
  flow + compliance check).
- Gates initially failed on **pre-existing template issues** (not caused by Phase 1, both files
  are on the Phase 2 rewrite path): `src/components/app-tabs.web.tsx` (RN 0.88 web
  `Pressable` ref-type mismatch → minimal `ComponentProps` cast) and
  `src/hooks/use-color-scheme.web.ts` (template broke `react-hooks/set-state-in-effect` →
  rewritten with `useSyncExternalStore`, behavior-par). `npx expo lint` also auto-installed
  eslint 9.x + `eslint-config-expo` and generated `eslint.config.js`.
- Re-running gates after fixes: `npx tsc --noEmit` clean, `npx expo lint` clean.

### Phase 2 — Mobile shell restructure
- [x] Convert to `(tabs)` group + root stack layout
- [x] `AppTabs` with 4 triggers (Discover · My Tickets · Host · Profile), reuse icon/label pattern
- [x] New tab icon assets in existing style
- [x] All screens reachable; starter scaffolding (`explore.tsx` content) retired cleanly

Notes (2026-11-10):
- `src/app/_layout.tsx` is now a root `Stack` (`(tabs)` screen, header hidden) preserving
  `ThemeProvider` + `AnimatedSplashOverlay`; `src/app/(tabs)/_layout.tsx` renders `AppTabs`.
- Screens: `(tabs)/index.tsx` (Discover), `tickets.tsx`, `host.tsx`, `profile.tsx` — placeholders
  that later phases fill (5 · 7/8 · 6/9 · profile/auth).
- `git mv` preserved history for `index.tsx`; `explore.tsx` removed.
- Icons: new glyphs (discover/tickets/host/profile) generated by `scripts/gen-tab-icons.mjs`
  (zero-dependency Node, PNG encoder inline; 24/48/72 px matching template `tabIcons` sizes).
  Fixed a glyph-math bug (`Math.max` of two segment *distances* = wrong ORing) and re-shaped
  `tickets` (edge notches) and `host` (header + binding) until legible.
- Typed routes: regenerated `.expo/types/router.d.ts` by hand (this CLI has no `typegen`
  command; types refresh on next `expo start`) — flagged so nobody treats it as drift.
- `app-tabs.web.tsx` updated to 4 triggers + "Luma Clone" brand text; still uses the
  `ComponentProps` cast noted in Phase 1 (rewritten in a later phase if needed).
- Smoke test: `npx expo export --platform web` bundles cleanly (all routes emitted).

### Phase 3 — API layer (mocks)
- [x] `src/api/client.ts` single swap-point documented
- [x] `src/api/mock/` labelled sample data (`MOCK` markers; not imported anywhere but client.ts)
- [x] TanStack Query hooks per domain (events, tickets, payments, ledger)
- [x] Error/loading normalization shared

Notes (2026-11-10):
- `@tanstack/react-query@5.107.1` installed via `npx expo install` + `QueryClientProvider` in root layout (`src/api/query-client.ts` factory).
- Structure: `src/api/types.ts` (`ApiClient` interface + shared DTO types — the app's contract), `src/api/mock/data.ts` (fixtures), `src/api/mock/mock-client.ts` (in-memory server simulation), `src/api/client.ts` (SWAP POINT: `api = mockApiClient`; swaps to real HTTPS client in backend phase, one file).
- Mock behaviour mirrors the real backend contract from `docs/api-contracts.md`: zod-validates every response against `shared/contracts` on the way out; `PublicEvent` responses genuinely drop `onlineMeeting`; free/paid registration split with 15-minute holds; `conflict` on oversell; paid flow settles via simulated **server-side** webhook (1.5 s) that confirms registration, issues tickets (idempotent by payment id), computes 5% commission via `shared/money`, records provider fee, and writes gross/commission/fee ledger entries — the client never fabricates success. Withdrawal lifecycle simulates requested→processing→paid. Boots with a prominent `console.info` MOCK label.
- Hooks: `queries/events.ts`, `queries/tickets.ts`, `queries/payments.ts` (polls payment status while pending → UI phase 8), `queries/organiser.ts` (attendees/ledger/balance/withdrawals/banks + mutations). `organiser.ts` added beyond the plan's original 4 files — attendee list + banks needed a home.
- ` organizers` fixed during build: phantom `this` in mock client, self-referential query-key objects, missing `minPerOrder` fixture, `CheckInOutcome` failure branch loosened (raw scanned string, not `OpaqueToken`).
- Gates: `tsc --noEmit` ✓, `expo lint` ✓, web export bundle ✓.

### Phase 4 — Shared UI primitives
- [x] Button, Input, Field, Card, Chip, EmptyState, Money, StepDots — built on Themed*/Spacing
- [x] All primary/secondary/disabled states; accessible labels

Notes (2026-11-10):
- Built `src/components/ui/`: `button.tsx` (primary = inverted text/bg high-contrast, secondary =
  `backgroundElement`, loading spinner + disabled states, callback-style prop merging),
  `input.tsx` (themed, multiline), `field.tsx` (label/hint/error), `card.tsx`,
  `chip.tsx` (selectable pill filter), `money.tsx` (kobo-safe formatting via `shared/money`
  + Free label at 0), `states.tsx` (`EmptyState`/`LoadingState`/`ErrorState` with retry).
- Added semantic theme tokens `success`/`danger` to both palettes in `constants/theme.ts`
  (smallest possible extension of the existing system; documented here per claude.md).
- StepDots deferred to Phase 6 (only the wizard will use it — avoid dead code).
- Gates: `tsc --noEmit` ✓, `expo lint` ✓, web export bundle ✓.

### Phase 5 — Discover + Event detail
- [x] Discover feed (published events only), search/filter client-side vs mocks
- [x] `event/[slug].tsx` — public detail: cover (image w/ monogram fallback), venue card + Open in Maps, online privacy notice, ticket types w/ availability, share action (lumaclone:// + placeholder web URL)
- [x] No private data in public detail UI (no attendee lists / onlineMeeting link)

Notes (2026-11-10):
- `src/lib/datetime.ts`: timezone-safe labels via date-fns-tz (same-day + multi-day formats, invalid-zone fallback UTC).
- `src/components/event-card.tsx`: EventCard + EventCover (expo-image, onError → title monogram).
- Static map preview deferred to backend phase (needs proxied key); deep-link covers MVP.
- Typed routes: dynamic slugs require object form `router.push({ pathname: '/event/[slug]', params })`; `useLocalSearchParams` must import from `expo-router` (not off imperative router).
- `register/[slug]` route added as labelled placeholder so CTA cannot 404 before Phase 7.
- Gates: tsc ✓ lint ✓ web export ✓.

Discover polish (same day, user request — Luma-style):
- Screenshot-inspired Discover redesign: title + search, "Categories" emoji chips (All / This week / Weekend / Free / Paid / Online / In person — single-select), "Cities" tappable city cards (All + Lagos/Abuja/Nairobi from venue data), filtered event list with count header.
- Honest equivalents only: category chips map to REAL filter params (no decorative data); city cards derive from `venue.city`; time filters computed server-side (mock) from actual timestamps. No "Featured Calendars" (needs organiser profile surface in contracts — deferred) and no fake city photos (emoji badges instead; real imagery needs an asset/proxy strategy from backend).
- Contract changes: `Venue.city` (optional, nullable) added to shared schema; `EventFilters` gains `city` + `when`; `/events` query-param table in docs updated; mock listEvents implements `when`/`city` (weekend = Fri/Sat/Sun starts within 10d in event's timezone) + description search + upcoming sort.
- Mock data: Lagos/Abuja/Nairobi offline venues now carry `city`; added 2 published events ("Startup Grind Abuja", "Nairobi Founder Social") with ticket types.
- City UX revision (user feedback): city cards are now a horizontally scrolling row with generated city art (`scripts/gen-city-images.mjs` → bundled PNGs in `assets/images/cities/`, flat gradient-skyline illustrations, zero network deps); tapping a city navigates to a dedicated page `city/[name]` (typed route auto-generated) filtered server-side by `city` — in-place filtering removed.

### Phase 6 — Create-event wizard
- [x] Steps: basic info → date/time (+timezone) → format → venue (Places stub) or online link → admission → tickets (if paid) → capacity/registration window → review
- [x] Draft save vs publish clearly separated actions
- [x] Field validation via shared schemas

Notes (2026-11-10):
- Added `src/app/create-event.tsx`: guided, conditional steps; local event times are converted with
  the selected IANA timezone; zod validates event, venue, online-link, and ticket data; price entry
  is parsed directly to integer kobo. Online meeting URLs are HTTPS-only and remain private in the
  event model.
- Community tab starts event creation and lists saved drafts with a continue-editing action.
  Drafts and ticket types use the existing mock API and remain clearly non-production.
- Draft save and publish are distinct actions. Publishing calls the mock API publication operation
  only after event/ticket persistence; it does not claim a real backend publication.
- Added `src/components/ui/step-dots.tsx`. Reused existing Button, Input, Field, Card, Chip,
  themed components, query hooks, and event contracts.
- The former Host tab is now Community, retaining the draft list and adding a floating create
  button. The first wizard item is a rectangular image/video cover picker with paste-link support.
  Device videos are limited to 30 seconds; media is previewed with Expo Image/Video.
- Start and end are selected independently in themed calendar modals; time uses a separate 12-hour
  AM/PM modal with five-minute increments, and the event timezone is chosen from a dropdown list.
- Gaps: selected device media is local-only in mock mode until a trusted upload/storage API exists;
  Places autocomplete/map preview await the backend proxy; per-ticket sale windows follow the
  event's registration window rather than having separate controls.
- Verification: `npx tsc --noEmit` ✓ · `npx expo lint` ✓ ·
  `npx expo export --platform web` ✓ (Metro cache deserialize warning recovered via full crawl).

### Phase 7 — Registration (free path)
- [ ] Guest registration (name/email) via wizard
- [ ] Ticket generated + QR code view; My Tickets list
- [ ] Guest retrieval via unguessable token (stored / shared link path)

### Phase 8 — Paid flow UI
- [ ] Ticket type selection with quantity/min-max
- [ ] Payment initiated via API contract; states: pending → pay → awaiting verification → confirmed
- [ ] NO client-side fake success: confirmation only reflects server-verified status (mocked in mock layer, clearly labelled)
- [ ] Commission data surfaced read-only from API (5%, server-computed)

### Phase 9 — Organiser management
- [ ] Host dashboard: my events + statuses
- [ ] Attendees list + details
- [ ] Check-in scanner (`expo-camera` CameraView) + manual code fallback + duplicate/error states
- [ ] Earnings ledger view (gross, commission 5, processing fee, payable, refunds)
- [ ] Withdrawal request UI (bank verify → fee display → confirm → status history)

### Phase 10 — Final verification
- [ ] `npx tsc --noEmit` clean
- [ ] `npx expo lint` clean
- [ ] Mock/production separation audit
- [ ] `claude.md` compliance spot-check (public data safety, money in kobo, statuses, no hardcoded rates)

## 7. Backend responsibilities (deferred — build as `backend/`)

Node/TS service + Postgres + Drizzle, Monnify adapter, webhook signature verify + idempotency,
conditional-inventory transactions + TTL holds, append-only ledger, withdrawal state machine,
Places/Maps proxy, ownership checks on every protected route, rate limits on register/pay/ticket/
check-in, server timestamps for all financial/registration events. Contracts in `docs/api-contracts.md`
are the agreed interface.

## 8. Verification gates (run every phase)

```bash
npx tsc --noEmit
npx expo lint
```

Plus feature-specific review against `claude.md` rules. Report commands run and failures.

## 9. Progress log

| Date | Phase | What was done | Checks run | Remaining gaps |
|---|---|---|---|---|
| 2026-11-10 | — | Repo analyzed, architecture proposed, decisions locked (see §1), this tracker created | none (planning only) | everything below Phase 1 |
| 2026-11-10 | 1 | `shared/contracts` (common/user/event/ticketing/payments/ledger + barrels), `shared/money.ts`, `shared/errors.ts`, `docs/api-contracts.md`, tsconfig `@shared/*` alias, zod@4.6.7 installed; pre-existing template lint/type errors in `app-tabs.web.tsx` + `use-color-scheme.web.ts` fixed to unblock gates | `npx tsc --noEmit` ✓ · `npx expo lint` ✓ | Phase 2+; backend; auth mechanism decision; hosting decision; Monnify funds-flow compliance check |
| 2026-11-10 | 2 | Root `Stack` + `(tabs)` group with 4 placeholder screens; `AppTabs`/`app-tabs.web.tsx` rewired to Discover·Tickets·Host·Profile; new tab icons via `scripts/gen-tab-icons.mjs`; router.d.ts route table refreshed; web export smoke test | `npx tsc --noEmit` ✓ · `npx expo lint` ✓ · `npx expo export --platform web` ✓ | Phases 3–10 |
| 2026-11-10 | 3 | API layer: `ApiClient` contract interface, labelled in-memory mock (zod-validated outputs, hold inventory, simulated server-side webhook settle + ledger writes, withdrawal lifecycle), TanStack Query v5 domain hooks + provider wiring, console MOCK banner | `npx tsc --noEmit` ✓ · `npx expo lint` ✓ · `npx expo export --platform web` ✓ | Phases 4–10; real HTTPS client at backend phase (single swap in `src/api/client.ts`) |
| 2026-11-10 | 4 | UI primitives in `src/components/ui/` (Button/Input/Field/Card/Chip/Money/States) on Themed* conventions; added `success`/`danger` theme tokens | `npx tsc --noEmit` ✓ · `npx expo lint` ✓ · `npx expo export --platform web` ✓ | Phases 5–10; StepDots deferred to Phase 6 |
| 2026-11-10 | 6 update | Replaced Host tab with Community, added bottom-left create-event FAB, placed rectangular image/video picker first in the wizard, added link entry and video preview (30-second limit), and added optional public `coverVideoUrl` contract support | `npx tsc --noEmit` ✓ · `npx expo lint` ✓ · `npx expo export --platform web` ✓ · `git diff --check` ✓ | Device files remain local-only until media storage API is implemented |
| 2026-11-10 | 6 | Guided create-event wizard, timezone-aware date entry, online/offline and free/paid paths, multiple ticket types, capacity/registration windows, review, explicit draft/publish actions, and Host draft-resume list; added StepDots UI | `npx tsc --noEmit` ✓ · `npx expo lint` ✓ · `npx expo export --platform web` ✓ | Mock persistence only; image upload, Places autocomplete/map preview, and independent ticket sales windows remain deferred |
| 2026-11-10 | 6 update | Moved start/end calendar selection into separate modals, added a 12-hour AM/PM time modal, and replaced timezone text entry with a selectable timezone list | `npx tsc --noEmit` ✓ · `npx expo lint` ✓ · `npx expo export --platform web` ✓ · `git diff --check` ✓ | Timezone list is curated; add additional IANA zones if product coverage requires them |
