Project Overview
Build a Luma-inspired event hosting, registration, and ticketing platform. The product allows organisers to create and publish online or offline events, share public event links, register attendees, sell free or paid tickets, and manage attendance and event finances.

The primary mobile application is built with React Native and Expo using TypeScript. The interface must retain the existing project's native Expo / React Native look and feel. Do not replace the current visual language or introduce a web-style UI without an explicit request.

This document defines product behaviour, engineering principles, and implementation priorities. It is not permission to make broad changes without inspecting the existing repository first.
Instructions for Claude Code
Before making changes:
1. Inspect the repository structure, package.json, Expo configuration, navigation setup, existing screens, shared components, styling approach, state management, API layer, and tests.
2. Identify what is already implemented and reuse it. Do not recreate existing functionality or introduce duplicate abstractions.
3. Follow the project's established conventions unless they conflict with a requirement in this document.
4. If a required backend, API, payment integration, or design decision is not present, identify the gap before inventing an implementation.
5. Propose a concise implementation plan for substantial changes. Work in small, verifiable steps.
6. Run the relevant type checks, linting, and tests after changes. Report commands run and any failures.
7. Do not claim that a feature, payment, refund, payout, or external integration works unless it has been implemented and verified.
When requirements conflict, prioritise security, financial correctness, data integrity, and existing project conventions. Ask for clarification when a decision materially affects product behaviour or financial flows.
Product Goals
The platform has two main user groups:
- Organisers: create, publish, promote, and manage events; configure tickets; view registrations and earnings; check in attendees; and request eligible payouts.
- Attendees: discover events, open shared event pages, register as guests or signed-in users, pay where required, and access their tickets.
The product should support both event discovery and direct sharing through public event URLs.
Event Model and Configuration
Every event has two independent configuration dimensions:
Dimension	Supported values
Format	Online, Offline
Admission	Free, Paid


This creates four supported combinations: free online, paid online, free offline, and paid offline.

An event should support, as appropriate:
- Title and description
- Cover image
- Organiser information
- Start and end date/time, including timezone
- Event format
- Admission type
- Capacity / maximum attendee count
- Registration opening and closing dates
- Publication status
- Ticket types and quantities for paid events
- Venue or online attendance details
- Public shareable slug or identifier
Use explicit event states such as draft, published, completed, and cancelled. Define and enforce valid state transitions in the backend. Do not rely on the mobile client to enforce business rules.
Offline event location
For offline events, collect:
- Venue name
- Address
- Place identifier where available
- Latitude and longitude
- Optional location instructions
Use Google Places autocomplete (or the configured Google Maps platform integration) to help organisers select a venue. Persist a stable place identifier and coordinates where available. Show a map preview and provide an action to open directions in a maps application.

Do not store only a free-text address if a verified place selection is available. Handle denied location permissions and unavailable map services gracefully.
Online event location
For online events, initially support:
1. An external meeting URL supplied by the organiser, such as Zoom, Google Meet, or Microsoft Teams.
2. A future platform-hosted virtual event room.
The first release should support external links. Keep the data model extensible for a future integrated event room, but do not build video conferencing or live streaming as part of the MVP.

Online access links are private event information. Do not expose them in public event responses. Make them available only to eligible registered attendees, according to the event's access policy. For paid events, require verified payment before granting access.
Event Creation Experience
Use a guided, manageable event creation flow rather than one excessively long form. Reuse existing form and input components.

The flow should collect:
1. Basic event information: title, description, and cover image.
2. Date and time.
3. Event format: online or offline.
4. Venue or online attendance details, conditionally.
5. Admission: free or paid.
6. Ticket configuration, if paid.
7. Capacity and registration window.
8. Review and publish.
Allow organisers to save drafts and return later. Validate required fields both in the client and backend. Clearly distinguish saving a draft from publishing an event.
Tickets and Registration
Ticket types
Paid events may have multiple ticket types, for example:
- Early bird
- Regular
- VIP
Each ticket type should support:
- Name and optional description
- Price and currency
- Quantity available
- Sales start and end times
- Per-order minimum and maximum, if needed
- Active / inactive status
Free events should support registration without a payment transaction. Do not create artificial payment charges for free tickets.
Registration
Attendees should be able to register as guests using the information required by the organiser, initially including name and email. Account creation should be optional unless a specific feature requires authentication. Provide a way for attendees to retrieve or access their tickets securely.

A registration should contain a clear status, such as:
- pending
- confirmed
- cancelled
- refunded
- checked_in
For paid tickets, do not confirm a registration or issue a usable ticket based solely on a client-side success screen or redirect. Confirm payment through a verified server-side provider response or webhook.
Inventory and concurrency
Ticket inventory must be enforced on the server. Prevent overselling when multiple people attempt to buy the final tickets concurrently.

Use a time-limited reservation/hold while a payment is pending, if supported by the payment flow. Expire abandoned holds and release their inventory. Make the hold duration configurable.
Ticket issuance
After a free registration is accepted or a paid registration is verified:
- Create a unique ticket identifier.
- Generate a QR code whose payload contains an opaque, non-guessable ticket reference, not personal information or payment secrets.
- Provide an attendee ticket view with event details and ticket status.
- Support secure ticket retrieval for guest attendees.
- Prevent duplicate ticket issuance when payment webhooks are retried.
A QR code is not proof of validity by itself. The backend must validate the ticket at check-in.
Payments and Commercial Model
Platform commission
The initial platform commission is 5% of each successful paid ticket registration.
- Free registrations have zero commission.
- Failed, abandoned, or unverified payments have zero commission.
- Calculate commission per successful paid ticket line/registration using the configured rate.
- Make the commission rate configurable on the backend; do not hardcode it in the mobile application.
- Store the commission rate and calculated amount used for each transaction so historical records do not change if the rate is updated later.
Use integer minor currency units (for NGN, kobo) for financial calculations. Avoid floating-point arithmetic for money. Define and document rounding rules.
Payment processing charges
The organiser bears the actual payment processing charge. The charge is separate from the platform commission and must be recorded separately.

Illustrative example for a ₦5,000 ticket:
Item	Amount
Ticket price	₦5,000
Platform commission (5%)	₦250
Example payment processing charge	₦175
Organiser's net ticket proceeds	₦4,575


The ₦175 processing charge is an example based on a possible provider pricing structure, not a permanent rate. Actual charges depend on the payment provider, payment method, current merchant pricing, taxes, caps, and configuration. Obtain the actual fee from provider transaction data where available. Do not assume all providers or payment methods have the same fee.

Do not silently add a fee to the attendee's checkout total. The initial agreed model is that the organiser bears payment processing charges from their ticket proceeds. Any later change to attendee-facing fees requires an explicit product decision and clear disclosure.
Payment providers
Paystack is the proposed initial payment provider. Keep the payment integration behind a provider adapter/interface so that another provider (for example, Monnify or Flutterwave) can be added without rewriting registration and ticketing logic.

The provider integration must support, as applicable:
- Initialising a payment
- Verifying a payment
- Receiving and verifying webhooks
- Retrieving transaction details
- Refunds
- Transfers / payouts
- Provider fee and settlement information where available
Never trust payment status, amount, currency, or reference supplied only by the mobile client. Verify all payment facts server-side against the provider.

Use idempotency for payment initialisation where supported, and always make webhook processing idempotent. Verify webhook signatures using the provider's documented method. Store provider references and raw event metadata safely for reconciliation, while avoiding unnecessary sensitive data retention.

Do not put secret API keys in the Expo application, source control, logs, or client-side environment variables. All secret-key operations must run on a trusted backend.
Organiser balances and withdrawals
The agreed MVP experience is an organiser withdrawal-request model:
- Ticket proceeds accumulate in an organiser earnings/balance view.
- The organiser can see gross ticket sales, platform commission, payment processing charges, refunds, adjustments, pending balance, and eligible withdrawal amount.
- The organiser requests a withdrawal to a verified bank account.
- The system displays any applicable transfer fee before the organiser confirms.
- Withdrawal requests have explicit states, such as requested, processing, paid, failed, and reversed.
- A failed transfer must not permanently reduce the organiser's payable balance.
- Every payout must be reconciled against the provider's transfer reference and final status.
The organiser bears applicable withdrawal/transfer charges in the initial model. Display the actual charge before confirmation; do not hardcode an assumed transfer fee.

Important financial and regulatory constraint: An in-app organiser balance is an accounting record of amounts payable, not permission to operate an unlicensed wallet, deposit-taking, escrow, or money-transmission service. Before production, confirm the permitted funds flow with the selected licensed payment provider and obtain appropriate Nigerian legal/compliance advice. Prefer provider-supported marketplace, subaccount, split-settlement, or payout arrangements where suitable. Do not hold or move customer/organiser funds through an ordinary account in a way that violates provider terms or applicable regulation. Do not describe funds as available for withdrawal until they are actually eligible under the provider's settlement and risk rules.
Financial ledger
Implement an auditable, append-only financial ledger on the backend. Do not calculate balances only by summing mutable fields on the mobile client.

Track distinct entries for:
- Gross ticket payment
- Platform commission
- Payment processing fee
- Organiser payable amount
- Refund
- Chargeback or dispute
- Payout/withdrawal
- Transfer fee
- Reversal or adjustment
Each ledger entry should reference the relevant event, ticket/registration, payment, organiser, and provider transaction where applicable. Corrections should be represented by compensating entries rather than silently editing historical financial entries.

The ledger and balance calculation must be server-authoritative and reconcilable with provider statements and webhooks.
Refunds and disputes
Define refund rules before enabling live payments. Support full and, if required, partial refunds. A refund must update registration/ticket status and create corresponding ledger entries. Prevent refunded or cancelled tickets from being checked in.

Account for provider refund fees, chargebacks, disputes, and cases where an organiser has already withdrawn proceeds. Do not assume a refund is always recoverable from an organiser's current balance.
Organiser Features
The organiser area should provide:
- Event list and event status
- Event creation and editing
- Event overview
- Registration and ticket sales counts
- Attendee list and attendee details
- Ticket type management, subject to sales rules
- Revenue and earnings breakdown
- Withdrawal request and withdrawal history
- QR check-in
- Event cancellation and attendee communication
Organisers must only access and modify events they own or are explicitly authorised to manage. Enforce ownership and role checks on the backend for every protected operation.
Attendee Features
Attendees should be able to:
- Browse and discover published events
- Search and filter events
- Open a public event detail page
- Share event links
- View event time, format, and venue information
- Open offline venue directions
- Select a ticket type
- Register as a guest
- Pay for paid tickets
- Receive registration confirmation
- View and retrieve tickets
- Access private online event information when eligible
Public event responses must not expose attendee lists, private meeting links, organiser financial data, internal notes, or payment secrets.
Event Discovery and Sharing
Every published event should have a stable, shareable public URL, for example:

https://<app-domain>/events/<event-slug-or-id>

Use the project's existing linking/deep-linking approach where available. A shared link should open the event in the app when installed and provide a suitable web/fallback experience when it is not.

Only published, non-cancelled events should appear in public discovery by default. Draft events must never be publicly accessible.
Check-in
Provide an organiser check-in experience using the device camera to scan ticket QR codes.

The backend must validate:
- Ticket exists
- Ticket belongs to the event being checked in
- Ticket is confirmed and not refunded/cancelled
- Ticket has not already been checked in
Record check-in time and the authorised staff member/device/user where appropriate. Handle duplicate scans clearly. Support a manual lookup fallback for camera permission failures or damaged QR codes.
Notifications
Design notification delivery so it can support:
- Registration confirmation
- Payment confirmation
- Event reminders
- Event changes or cancellation
- Online event access availability
- Withdrawal status updates
Use the existing notification infrastructure if present. Do not assume push notifications alone are sufficient; important ticket and payment information should also be retrievable in the app and, where configured, by email.
Mobile UI and Design Principles
Preserve the existing Expo React Native interface and design conventions.
- Inspect and reuse existing typography, colours, spacing, icons, buttons, inputs, cards, navigation, and screen patterns.
- Use native React Native components and the project's current component library.
- Keep layouts responsive across supported phone sizes.
- Prefer clear, focused screens and guided flows.
- Use consistent spacing, typography hierarchy, border radii, and interaction states.
- Provide loading, empty, error, disabled, and success states.
- Ensure forms have useful validation and accessible labels.
- Support keyboard behaviour and safe areas.
- Avoid unnecessary visual effects, web-like layouts, or new dependencies.
- Do not redesign unrelated screens while implementing a feature.
- Do not introduce a new design system unless the existing one is inadequate and the reason is explained.
Suggested Navigation Areas
Adapt these to the navigation structure already in the repository rather than replacing it automatically.

Attendee-facing areas:
- Discover
- Search / event categories
- Event details
- Registration / checkout
- My tickets
- Profile
Organiser-facing areas:
- Organiser home / dashboard
- My events
- Create event
- Event management
- Attendees / check-in
- Earnings
- Withdrawals
- Profile / organiser settings
The application may share navigation between attendee and organiser capabilities. Do not assume separate applications are required.
Architecture and Engineering Principles
The mobile app is Expo + React Native + TypeScript. The backend technology and deployment architecture must be discovered from the repository or agreed separately; do not invent an existing backend.

Keep clear boundaries between:
- Presentation components and screens
- Navigation
- Domain/business logic
- API client and data access
- Authentication and authorisation
- Payment provider integration
- Financial ledger and payout logic
- Notifications and external integrations
Prefer small, reusable components and feature-oriented modules consistent with the existing codebase. Avoid giant screens, duplicated API calls, and business rules embedded in UI components.

Use typed API contracts and centralised error handling. Validate important inputs on both client and server. Use environment-specific configuration and never commit secrets.

If the backend is not yet implemented, document the required API contracts and backend responsibilities before building client-side mocks that could be mistaken for production behaviour.
Security, Privacy, and Reliability
- Enforce authentication and authorisation on the backend.
- Enforce organiser ownership for event and financial operations.
- Validate and sanitise user-provided content.
- Protect guest ticket retrieval with unguessable references and appropriate verification.
- Rate-limit sensitive endpoints such as payment initialisation, ticket retrieval, and check-in where appropriate.
- Verify payment webhooks and make processing idempotent.
- Protect private online event links.
- Avoid storing card details or payment credentials.
- Do not log secrets, access tokens, full payment credentials, or unnecessary personal information.
- Collect only attendee information needed for the event.
- Provide appropriate privacy and data-retention behaviour.
- Handle network failures and retryable operations safely.
- Prevent duplicate registrations, duplicate ticket issuance, duplicate refunds, and duplicate payouts.
- Use server-side timestamps for financial and registration events.
MVP Scope
Prioritise the following end-to-end capabilities:
1. Authentication and basic user profiles.
2. Create, edit, save, and publish events.
3. Free and paid event configuration.
4. Online external-link and offline venue configuration.
5. Public event details and shareable links.
6. Guest registration.
7. Multiple ticket types and capacity enforcement.
8. Initial payment provider integration (Paystack, subject to backend and compliance readiness).
9. Verified payment webhooks and ticket issuance.
10. Attendee ticket view with QR code.
11. Organiser event and attendee management.
12. QR check-in.
13. Organiser earnings ledger view and withdrawal request flow, using a compliant provider-supported funds flow.
Do not include an integrated video-conferencing product in the MVP. Do not build a proprietary payment processor or unlicensed wallet.
Later Enhancements
Keep the architecture extensible for:
- Integrated virtual event rooms
- Live streaming
- Recurring events
- Promo codes and discounts
- Waitlists
- Co-organisers and staff permissions
- Advanced analytics
- Automated/scheduled payouts
- More payment providers and payment methods
- Organiser verification
- Event communities and messaging
Do not build these ahead of the core registration, payment, ticketing, and check-in lifecycle.
Testing Expectations
Add or maintain tests for critical business rules, especially:
- Event format and admission combinations
- Event publication and visibility
- Ticket availability and concurrent reservations
- Free registration
- Paid registration and payment verification
- Commission calculation at 5%
- Provider fee recording
- Financial ledger entries and balance calculations
- Webhook signature validation and idempotency
- Refunds and reversals
- Withdrawal eligibility and state transitions
- QR ticket validation and duplicate check-in
- Organiser ownership and access control
- Private online link access
Use provider sandbox/test mode for payment integration. Never use real customer funds for development testing.
Definition of Done
A feature is not complete merely because its screen exists. A feature is complete when:
- The user flow works end to end.
- Data is validated and persisted correctly.
- Backend rules enforce the relevant permissions and business constraints.
- Loading, empty, error, and success states are handled.
- Security and privacy implications have been considered.
- Critical business logic has tests.
- Type checks, linting, and relevant tests pass.
- Any external integration has been tested in its sandbox or documented as not yet verified.
- Documentation and environment variable examples are updated where needed.
Working Style
Implement the product incrementally. For each task:
1. Explain the intended change briefly.
2. Inspect the relevant existing code.
3. Identify affected screens, components, services, API contracts, and data models.
4. Implement the smallest coherent change.
5. Run relevant checks.
6. Summarise files changed, behaviour implemented, checks run, and remaining gaps.
Do not make unrelated refactors. Do not add dependencies without explaining why they are needed. Do not fabricate API responses, payment confirmations, map results, or payout success. Keep mock data clearly separated from production data.