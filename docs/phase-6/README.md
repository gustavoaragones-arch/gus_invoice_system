# Phase 6 — Google Calendar Work Evidence Integration

## 1. Objective

Implement the assistive Google Calendar evidence workflow:

```text
Google Calendar → Calendar Connection → Selected Calendar → Calendar Event → Work Candidate → Human Review → Optional Invoice Draft
```

Calendar evidence may suggest work. It does not prove billability, price, tax treatment, invoiceability, or financial recognition.

## 2. Scope

In scope:

- Google Calendar provider boundary
- Calendar connection foundation
- Calendar selection
- Calendar event persistence/ingestion
- WorkCandidate persistence and review workflow
- Human review gate
- Controlled WorkCandidate → Invoice Draft boundary
- Business isolation
- Deterministic development provider
- Required UI
- Automated tests

Out of scope:

- Automatic invoice generation, finalization, sending, or payment processing
- Tax classification invention
- Matching/confidence/duplicate billing algorithms
- Production Google OAuth/webhook infrastructure
- Reporting, PDF, email, recurring billing, or new accounting entities

## 3. Implemented Calendar Architecture

```text
CalendarProvider
→ CalendarConnection (encrypted server-side credentials)
→ SelectedCalendar (user-selected ingestion scope)
→ CalendarEvent (evidence snapshot)
→ WorkCandidate (pre-financial review object)
→ explicit human review
→ existing Invoice Draft workflow
```

No financial action occurs directly from a `CalendarEvent`.

## 4. Provider Abstraction

- `src/server/calendar/types.ts` — provider interfaces
- `src/server/calendar/calendarProvider.ts` — provider factory
- `src/server/calendar/developmentCalendarProvider.ts` — deterministic development/test provider

`CALENDAR_PROVIDER=development` is the supported local/test configuration. The development provider does not call Google and must not be described as production synchronization.

Production Google Calendar integration remains pending provider/OAuth configuration.

## 5. Authentication / OAuth Boundary

- OAuth credentials are encrypted server-side via `TOKEN_ENCRYPTION_KEY`
- Tokens are never exposed to client components, URLs, HTML, or browser storage
- Connection is associated with the authenticated user and selected business through existing server-side authorization
- Development connect bypasses real Google OAuth and creates a deterministic development connection

## 6. CalendarConnection Behavior

- Uses approved `CalendarConnection` entity
- `connectCalendar` creates an active business-scoped connection with encrypted tokens
- `disconnectCalendar` marks the connection disconnected and clears token ciphertext
- `CALENDAR_CONNECTION_CHANGED` audit event is recorded on connect/disconnect

## 7. SelectedCalendar Behavior

- Available calendars are discovered through the provider boundary
- User selects which calendars are eligible for ingestion
- Only calendars with `selected = true` are synchronized
- Unselected calendars are not ingested

## 8. CalendarEvent Behavior

- Imported events are evidence snapshots only
- Upsert identity: `(selectedCalendarId, sourceEventId)`
- Repeated synchronization updates the snapshot and does not create duplicate events
- Events do not affect revenue, payments, or invoice lifecycle directly

## 9. WorkCandidate Behavior

- Created from imported `CalendarEvent` evidence
- One technical candidate per `CalendarEvent` on first ingestion
- `matchConfidence` remains `UNMATCHED`; no billing classifier is implemented
- Review states remain `PENDING`, `EDITED`, `APPROVED`, `REJECTED`
- Rejected candidates remain visible for audit/history

## 10. Human Review Gate

Users must explicitly:

1. review/edit candidate evidence (client, service, description, quantity)
2. reject, or
3. create an invoice draft through an explicit server action

No automatic invoice, payment, or revenue action occurs from sync or ingestion.

## 11. Invoice Draft Boundary

`createInvoiceDraftFromWorkCandidate`:

1. validates the candidate is review-ready
2. creates a Draft invoice through existing `createDraftInvoice`
3. converts the candidate through existing `approveWorkCandidate`
4. links the resulting line item via `workCandidateId`

This creates a Draft only. Finalization, sending, and payment remain in the existing Phase 4/5 workflows.

## 12. Business Isolation

All calendar operations are business-scoped through:

- `assertBusinessAccess`
- business ownership checks in application wrappers
- existing RLS/session architecture

Cross-business connection, event, and work-candidate access is rejected.

## 13. Idempotency Behavior

Technical idempotency only:

- `CalendarEvent` upsert by `(selectedCalendarId, sourceEventId)`
- `WorkCandidate` created only when no candidate exists for the event

This is deterministic persistence containment, not an approved duplicate-detection business rule.

## 14. Development Provider

The development provider supports:

- connection
- calendar discovery
- calendar selection persistence
- event ingestion
- repeat ingestion without duplicate candidates
- work candidate creation
- human review
- controlled invoice draft creation

It does not call Google and uses no fake external credentials.

## 15. Tests

`tests/application/phase6Workflow.test.ts` covers:

- development connection
- unauthorized and cross-business access rejection
- calendar discovery and selection
- selected-calendar-only ingestion
- event persistence and repeat-sync idempotency
- work candidate separation from invoices
- explicit draft creation
- rejected candidate blocking
- evidence-only behavior without payments/finalization

## 16. Validation

Required commands:

```bash
npx tsc --noEmit
npx vitest run --config vitest.config.ts
npx vitest run --config vitest.integration.config.ts
npx next build
```

## 17. Known Limitations

- No production Google OAuth flow or webhook/background sync infrastructure
- No PDF, email, payment, or reporting additions
- No automatic client/service matching
- No confidence scoring beyond schema placeholder `UNMATCHED`
- Destination/provider metadata for send attempts unchanged from Phase 5

## 18. Explicit Unresolved Calendar Decisions

The following remain unresolved and were not silently resolved:

- Client/service matching algorithm
- Confidence model and thresholds
- Duplicate-detection business algorithm
- Recurring event treatment
- Cancelled/edited event treatment
- Event identity policy beyond technical upsert keys
- Rejected-candidate resurfacing policy beyond one-candidate-per-event containment

## 19. No Automatic Financial Action

Confirmed:

- Calendar sync does not create invoices, payments, or revenue
- WorkCandidates do not finalize invoices
- Only explicit reviewed action creates a Draft invoice
- Existing Phase 0–5 accounting rules were not changed

## 20. Phase 0–5 Accounting Rules

Confirmed unchanged:

- Revenue, Amount Collected, and Outstanding definitions
- Draft / Finalized / Void invoice lifecycle
- Payment immutability and reversal behavior
- Finalized snapshot behavior
- Multi-tax-group finalization containment
