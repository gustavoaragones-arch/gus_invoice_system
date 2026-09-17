# Phase 7 — Production Google Calendar Integration & Sync Infrastructure

## 1. Objective

Establish production-capable Google Calendar integration and synchronization infrastructure while preserving the Phase 6 evidence-only workflow:

```text
Google OAuth → CalendarConnection → SelectedCalendar → CalendarEvent → WorkCandidate → Human Review → Invoice Draft
```

Calendar data remains evidence. It is never itself a financial transaction.

## 2. Production Google Calendar Architecture

```text
Calendar UI / API routes
    ↓
Application / Domain
    ↓
CalendarProvider interface
    ↓
GoogleCalendarProvider (production) | DevelopmentCalendarProvider (tests/local)
    ↓
googleCalendarApi / googleOAuth (Google-specific boundary)
```

Google-specific SDK usage is confined to the provider boundary.

## 3. Provider Abstraction

- `CalendarProvider` interface unchanged from Phase 6
- `CALENDAR_PROVIDER=development` → deterministic development provider
- `CALENDAR_PROVIDER=google` → production Google provider
- No silent fallback from production to development

## 4. OAuth Flow

1. User selects business and clicks **Connect Google Calendar**
2. Browser requests `/api/calendar/oauth/start`
3. Server validates auth + business access
4. Server creates signed OAuth state
5. User is redirected to Google consent
6. Google redirects to `/api/calendar/oauth/callback`
7. Server validates state and authenticated user
8. Server exchanges authorization code server-side
9. Tokens are encrypted and persisted in `CalendarConnection`
10. User is redirected back to `/calendar`

Tokens are never exposed to browser storage, URLs, or rendered HTML.

## 5. OAuth Scopes

Requested scopes:

- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/userinfo.email`

No Gmail, Drive, Contacts, or calendar write scopes are requested.

## 6. State Protection

OAuth state is a signed JWT containing:

- authenticated user ID (`sub`)
- intended business ID
- expiration (`10m`)

Callbacks reject missing, invalid, expired, or mismatched state.

## 7. Token Encryption

Tokens are encrypted with `TOKEN_ENCRYPTION_KEY` via existing `encryptToken` / `decryptToken`.

Access and refresh tokens are never stored in plaintext, logs, audit metadata, or client-visible responses.

## 8. Token Refresh

When Google API calls fail with authorization errors in production mode:

1. refresh token is used server-side;
2. new access token is obtained;
3. encrypted credentials are persisted;
4. the original request is retried once.

Refresh behavior is not exposed to the UI.

## 9. Calendar Discovery

Production calendar discovery uses Google Calendar API `calendarList.list` with pagination.

Only calendar metadata required by the application is returned.

## 10. Calendar Selection

Existing `SelectedCalendar` workflow is unchanged.

Only calendars explicitly selected by the user are synchronized.

## 11. Event Synchronization

Production event retrieval uses Google Calendar API `events.list` with:

- explicit date range (`timeMin` / `timeMax`);
- pagination;
- `singleEvents: true` for instance-level retrieval.

Synchronization remains user-initiated. No background billing automation is introduced.

## 12. Date-Range Behavior

Synchronization date ranges are evidence retrieval parameters only.

They are not accounting periods.

Default UI range remains bounded (last 30 days).

## 13. Pagination

Both calendar discovery and event retrieval handle Google API pagination deterministically.

Incomplete paginated results are not presented as complete.

## 14. Error Handling

Provider failures are mapped to application-level errors:

- auth failures → reconnect required
- rate limiting → retry later
- temporary provider failures → unavailable
- configuration errors → explicit configuration message

Raw Google internals and secrets are not exposed.

## 15. Idempotency

Technical idempotency remains:

- `CalendarEvent` upsert by `(selectedCalendarId, sourceEventId)`
- one `WorkCandidate` per `CalendarEvent` on first ingestion

This is persistence containment, not an approved duplicate-detection business rule.

## 16. Event Modification Handling

Updated Google events update the existing evidence snapshot fields supported by `CalendarEvent`.

No invoice, invoice line item, payment, or finalized snapshot is modified by synchronization.

## 17. Cancellation Handling

Cancelled Google events remain evidence.

When Google reports `status: cancelled`, the provider surfaces that fact in the stored description for human review.

No automatic invoice voiding, payment reversal, or WorkCandidate rejection occurs.

## 18. Recurring-Event Handling

Recurring events may be ingested as API instances when `singleEvents: true` is used.

No recurring billing algorithm is implemented.

Aggregation, series identity, and billing interpretation remain unresolved.

## 19. WorkCandidate Boundary

Production synchronization still ends at `WorkCandidate`.

No automatic invoice, line item, payment, or revenue action occurs.

## 20. Human Review Boundary

Existing WorkCandidate review remains mandatory.

Calendar text is not treated as authoritative for billability, price, tax treatment, or tax applicability.

## 21. Invoice Draft Boundary

Reviewed work still reaches invoices only through existing `createInvoiceDraftFromWorkCandidate`.

Result remains `Invoice = DRAFT`.

## 22. Business Isolation

All OAuth, connection, discovery, selection, and synchronization operations remain business-scoped through existing server-side authorization and RLS.

## 23. Security

Verified controls:

- server-side OAuth only
- signed OAuth state
- encrypted token persistence
- no token leakage to client
- business authorization on all sensitive operations
- no cross-business connection attachment

## 24. Development Provider

`DevelopmentCalendarProvider` remains available for tests and local development.

The standard automated test suite does not require live Google credentials.

## 25. Tests

Added:

- `tests/unit/googleOAuth.test.ts`
- `tests/unit/googleCalendarApi.test.ts`
- `tests/application/phase7Workflow.test.ts`

Coverage includes OAuth state, scopes, mocked Google API pagination, token refresh, encrypted persistence, selected-calendar-only sync, idempotency, and financial-safety regression assertions.

## 26. Validation

```bash
npx tsc --noEmit
npx vitest run --config vitest.config.ts
npx vitest run --config vitest.integration.config.ts
npx next build
```

## 27. Known Limitations

- No Google webhook/background sync infrastructure
- No production OAuth without explicit Google credentials/configuration
- No token expiry field in schema; refresh is reactive on auth failure
- No recurring-event billing algorithm
- No cancelled-event accounting semantics beyond evidence surfacing
- No client/service matching, confidence scoring, or duplicate-detection business rules

## 28. Unresolved Calendar Decisions

Still unresolved:

- client matching
- service matching
- confidence model/thresholds
- business duplicate detection
- recurring-event billing treatment
- cancelled-event accounting treatment beyond evidence surfacing
- edited-event resurfacing rules
- rejected-candidate resurfacing
- webhook/background synchronization strategy

## 29. Production Configuration Requirements

Set:

```text
CALENDAR_PROVIDER=google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=...
TOKEN_ENCRYPTION_KEY=...
NEXT_PUBLIC_APP_URL=...
```

## 30. Evidence-Only Confirmation

Confirmed:

- Calendar synchronization does not create invoices, payments, or revenue
- WorkCandidates still require explicit human review
- only reviewed work may create a Draft invoice through the existing workflow
- Phase 0–6 accounting rules were not changed
