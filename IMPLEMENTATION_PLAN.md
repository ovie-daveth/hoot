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
- [ ] Convert to `(tabs)` group + root stack layout
- [ ] `AppTabs` with 4 triggers (Discover · My Tickets · Host · Profile), reuse icon/label pattern
- [ ] New tab icon assets in existing style
- [ ] All screens reachable; starter scaffolding (`explore.tsx` content) retired cleanly

### Phase 3 — API layer (mocks)
- [ ] `src/api/client.ts` single swap-point documented
- [ ] `src/api/mock/` labelled sample data (`MOCK` markers; not imported anywhere but client.ts)
- [ ] TanStack Query hooks per domain (events, tickets, payments, ledger)
- [ ] Error/loading normalization shared

### Phase 4 — Shared UI primitives
- [ ] Button, Input, Field, Card, Chip, EmptyState, Money, StepDots — built on Themed*/Spacing
- [ ] All primary/secondary/disabled states; accessible labels

### Phase 5 — Discover + Event detail
- [ ] Discover feed (published events only), search/filter client-side vs mocks
- [ ] `event/[slug].tsx` — public detail: cover, venue card (+ static-map image, Open in Maps), ticket types, share link (`lumaclone://event/<slug>` + web URL)
- [ ] No private data in public detail UI

### Phase 6 — Create-event wizard
- [ ] Steps: basic info → date/time (+timezone) → format → venue (Places stub) or online link → admission → tickets (if paid) → capacity/registration window → review
- [ ] Draft save vs publish clearly separated actions
- [ ] Field validation via shared schemas

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
