# API Contracts — Luma Clone

Created: 2026-11-10 · Status: **TARGET CONTRACT** (not yet implemented server-side)

This document defines the HTTP surface the mobile app consumes and the responsibilities the
future `backend/` service must implement. The schemas are the runtime source of truth in
`shared/contracts/` (zod). While the backend does not exist, the app runs entirely on the
clearly-labelled mock adapter (`src/api/mock/`) — every mock response is shaped `as if` these
endpoints existed. **Mock data must never be mistaken for production behaviour.**

## Conventions

- **Base path**: `/v1`
- **Money**: integer minor units (kobo) only. Commission = `floor(grossMinor × rateBps / 10_000)`
  (round-down ⇒ organiser-favourable). Default platform rate `500` bps (5%) — configurable
  server-side, never hardcoded in the app; snapshotted per payment.
- **Timestamps**: ISO 8601 UTC (`IsoDateTime`). Server-authoritative for registration/payment/
  ledger events.
- **Currencies**: `NGN` only in MVP (wired via `Currency` enum).
- **Auth**: bearer token. Attendee actions (public browse, guest registration) require no auth;
  organiser actions are owner-checked server-side.
- **Errors**: every failing response returns `ApiErrorShape`
  (`{ code, message, details? }`), matching `ApiErrorCode` values in `shared/contracts/common.ts`.
  `shared/errors.ts` `ApiError` is the client-side representation.
- **Statuses** (from `claude.md`):
  - Event: `draft / published / completed / cancelled`
  - Registration: `pending / confirmed / cancelled / refunded / checked_in`
  - Payment: `pending / success / failed / abandoned / refunded`
  - Withdrawal: `requested / processing / paid / failed / reversed`
- **Privacy invariants**: public payloads never include attendee lists, private online meeting
  links (`PublicEvent` omits them by schema), organiser financial data, internal notes, or
  payment secrets. Draft/cancelled events are unreachable via public endpoints.
- **Ids**: UUID v4. Ticket codes / guest-retrieval tokens: opaque, non-guessable
  (`OpaqueToken`), independent of personal data.

## Public endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/events?q&format&admission&city&when` | none | Discovery feed. Published + non-cancelled only. `when` ∈ `this_week` (starts within next 7d) / `weekend` (Fri–Sun starts in event timezone). Returns `PublicEvent[]`. |
| GET | `/events/:slug` | none | Public detail → `PublicEvent`. Drafts/cancelled → `not_found`. |
| GET | `/events/:slug/ticket-types` | none | Active ticket types + availability. |

## Auth (organiser accounts)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Email + password or magic link (tech decided at backend phase). |
| POST | `/auth/login` | → session token. |
| GET | `/me` | `User` + `OrganiserProfile` if any. |
| PATCH | `/organiser/profile` | Update organiser profile / payout bank account (verified via provider). |

## Event management (organiser, owner-checked)

| Method | Path | Description |
|---|---|---|
| GET | `/events` (mine query) | Organiser's events incl. drafts. |
| POST | `/events` | Create **draft** (`EventUpsertInput`). Server assigns slug if omitted. |
| PATCH | `/events/:id` | Update draft (or limited editable fields post-publish). |
| POST | `/events/:id/publish` | Validates completeness (format/admission/venue-or-link, ≥1 ticket type when paid). No-ops must fail with `validation`. |
| POST | `/events/:id/cancel` | Published → cancelled; attendee communication hook. |
| POST | `/events/:id/ticket-types` / PATCH `/ticket-types/:id` | Manage types (sales-window rules enforced server-side). |

## Registration & checkout

| Method | Path | Description |
|---|---|---|
| POST | `/events/:id/registrations` | body `RegisterInput`. Free → `confirmed` + tickets issued. Paid → `pending` + **inventory hold** (`holdExpiresAt`). |
| POST | `/registrations/:id/pay` | Idempotent init → `StartPaymentResponse` (`checkoutUrl`). Never trusts client amounts. |
| POST | `/webhooks/monnify` | Backend-only. Signature-verified (`shared/contracts/payments.ts` `verifyWebhook`), idempotent by provider `eventId`. On verified `success`: confirm registration, issue tickets (duplicate-safe), write ledger entries (gross, commission 5%, processing fee), snapshot fee/commission. |

Guests never confirm a paid registration from a client-side redirect or success screen —
confirmation is webhook/server-verification only.

## Tickets & check-in

| Method | Path | Description |
|---|---|---|
| GET | `/tickets` | Signed-in attendee tickets. |
| GET | `/tickets/by-token/:token` | Guest retrieval via unguessable token, rate-limited. |
| POST | `/events/:id/check-in` | body `{ code }` (from QR `lumaclone://t/<code>` or manual). Owner-authed. Returns `CheckInOutcome` — validates existence, event match, confirmed-not-refunded, not already checked in; records who/when. |

## Organiser financials (owner-checked)

| Method | Path | Description |
|---|---|---|
| GET | `/events/:id/registrations` | Attendee list + statuses. |
| GET | `/ledger` | `LedgerEntry[]` (append-only) for organiser. |
| GET | `/ledger/balance` | `OrganiserBalance` — server-derived from ledger; client never sums mutable fields. |
| GET | `/banks` | Provider bank list (for transfer destination). |
| POST | `/banks/verify` | Resolve account name before payout. |
| POST | `/withdrawals` | `WithdrawalRequestInput`. Server computes/display-transfer fee (actual, not hardcoded) before confirm; state machine per `WithdrawalStatus`; failed transfers reversed via compensating entries. |
| GET | `/withdrawals` | History. |

## Places / maps proxy

| Method | Path | Description |
|---|---|---|
| GET | `/places/autocomplete?q&session` | Google Places proxy — Google API keys stay server-side only. |
| GET | `/places/:placeId` | Stable place metadata (name, address, lat/lng). |
| GET | `/places/static-map` | Static map image params for preview. |

## PaymentAdapter (backend interface)

Defined as a TypeScript interface in `shared/contracts/payments.ts`. The backend implements it
first for **Monnify (NGN)**; later providers slot in without touching registration/ticketing logic.
Required capabilities: `initTransaction`, `verifyPayment`, `verifyWebhook`
(signature-verified, idempotent), `refund`, `transfer` (payouts), `verifyBankAccount`, `listBanks`.
Secret keys live only on the backend (env config, never in the Expo app, never in logs).
Provide idempotency for payment init; make webhook processing idempotent.

## Backend responsibilities summary (from `claude.md`)

1. Server-authoritative money: all amounts verified against provider transactions.
2. Conditional-inventory concurrency (no oversell), TTL holds + expiry cron.
3. Append-only ledger; corrections = compensating entries.
4. Ownership checks on every protected route; role checks for organiser/staff.
5. Rate limiting: payment init, ticket retrieval, check-in, guest registration.
6. Idempotency: payment init, webhook events, ticket issuance, refunds, payouts.
7. No secret API keys client-side; no secrets/PII in logs; minimal data retention.
8. Duplicate protection: registrations, tickets, refunds, payouts.

## Backend phase decisions still open

- Auth mechanism (magic link vs password) — affects `/auth/*` shape only.
- Hosting target (Railway/Fly/etc.) + Postgres provider.
- Monnify settlement/subaccount vs platform-collect-then-transfer funds flow — **requires the
  compliance check in `claude.md` before production**.
