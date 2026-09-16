# Phase 3 — Application Foundation & Persistence Implementation

Status: Targeted remediation complete (tax applicability containment), pending Project Director review
Phase: 3

## Purpose and Authority

This document describes the implementation choices made to build the application foundation and persistence layer approved in Phase 0 (product requirements), Phase 1 (accounting/billing rules), and Phase 2 (architecture and data model, commit `1992f114a81bc8045cd2a1b7b38782b982b5c0ce`). **Every choice below implements the approved Phase 2 architecture; none of them replace, reinterpret, or redesign it.** Where Phase 2 left something explicitly `UNRESOLVED` (the architecture decision register, `docs/phase-2/17-architecture-decision-register.md`), this phase resolves only the narrow technical question of *how to implement the mechanism Phase 2 already specified* — never the underlying business/product question Phase 2 deferred.

## Chosen Application Framework

**Next.js 16 (App Router) + TypeScript**, per the Phase 0 §8 / Phase 2 §01 Section 10 technology direction. The application currently exposes only what this phase requires: a placeholder root page, a `/api/health` liveness check, and one illustrative authenticated route (`/api/businesses`) that proves the full Authentication → Authorization → Domain → Persistence chain is wired together, not just present as isolated modules. No product UI, invoice screens, or Calendar integration UI were built — those remain out of scope for this phase.

## Chosen ORM / Data-Access Mechanism (resolves DEC-ARCH-019)

**Prisma 5 + PostgreSQL.** Phase 2 deliberately left the ORM/data-access approach `UNRESOLVED`, instructing Phase 3 to inspect the project and select one coherent mechanism. Prisma was chosen because:

- It keeps the technology direction's `PostgreSQL/Supabase` commitment intact — Prisma is a client over a standard Postgres connection string, not a replacement for Supabase.
- It gives first-class `Decimal` support (backed by `decimal.js`) for every monetary field, avoiding floating-point money by construction rather than by convention.
- Its migration tool (`prisma migrate`) produces plain, readable, hand-editable SQL — necessary here because several required invariants (CHECK constraints, partial unique indexes, RLS policies, the audit append-only trigger) are not expressible in Prisma's schema language and had to be added as a hand-written follow-up migration (`prisma/migrations/20260916225500_invariant_constraints`).
- No second, competing data-access library was introduced anywhere in the codebase, and no unnecessary abstraction layer was built on top of Prisma — domain code calls the generated Prisma Client directly.

## Database Migration Strategy

Three migrations, applied in order via `prisma migrate deploy`:

1. `20260916225021_init` — the executable schema generated directly from `prisma/schema.prisma` (all 16 entities, enums, foreign keys, and Prisma-expressible indexes).
2. `20260916225500_invariant_constraints` — hand-written SQL adding what Prisma's schema language cannot express: CHECK constraints (invoice financial-completeness rules, positive amounts, etc.), a partial unique index (at most one *current* `TaxConfigurationVersion` per business), the audit-event append-only trigger, and 15 Row-Level Security policies.
3. `20260916231000_app_runtime_role` — creates a dedicated, non-superuser `app_runtime` Postgres role and grants it exactly the privileges the application needs (see "Business-Isolation Mechanism" below for why this migration exists at all).

Every migration is a plain, versioned SQL file under `prisma/migrations/`, applied the same way in local development, the test suite, and (once provisioned) production — there is no separate "apply constraints manually" step.

## Authentication Approach

**Supabase Auth JWT verification**, per Phase 0 §8/SEC-AUTH-002. `src/server/auth/supabaseAuth.ts` verifies a Supabase Auth access token's HS256 signature locally (against `SUPABASE_JWT_SECRET`) and extracts `{ userId, email }` into an `AuthContext`. This is real, load-bearing logic — unit-tested against tokens signed the same way Supabase signs them (`tests/unit/supabaseAuth.test.ts`: valid token, wrong secret, expired token, missing subject claim, malformed header) — not a stub.

**What was not connected**: no live Supabase project exists in this environment (no credentials were available to provision one), so this has not been exercised against a real Supabase Auth token issued by an actual sign-in flow. The verification logic is standard JWT/HS256 handling and does not depend on anything Supabase-specific beyond the shared secret, so this gap is expected to close by pointing `SUPABASE_JWT_SECRET`/`SUPABASE_URL` at a real project — no code change anticipated, but the Project Director should treat "wire up and test against a live project" as an open follow-up, not a completed item.

A first-authenticated-request provisioning step (`src/server/domain/userProvisioning.ts`) mirrors the Supabase Auth identity into the local `User` table (`app_user`) on first sight, since `User` is a real foreign-key target (for `Business.ownerUserId` and `AuditEvent.actorUserId`) that Supabase's own `auth.users` table cannot serve directly from this schema.

## Authorization Approach and Business-Isolation Mechanism (SEC-ISO-002/003/004)

Two independent, always-both-present layers, exactly as Phase 2 §13 requires ("UI switching is not sufficient"):

1. **Application layer** — `assertBusinessAccess(tx, auth, businessId)` (`src/server/domain/businessAuthorization.ts`) is called at the top of every domain operation that touches a specific business's data, and verifies `business.ownerUserId === auth.userId` before doing anything else. It never trusts a client-supplied `businessId` alone.
2. **Database layer (Row-Level Security)** — every business-owned table (and every table reachable from one via an immutable parent chain) has RLS enabled and `FORCE`d, with policies keyed off a Postgres session variable, `app.user_id`, set at the start of every transaction (`src/server/db/authorizedTransaction.ts`, via `SELECT set_config('app.user_id', $1, true)` — transaction-scoped, never leaks across pooled connections). Until that variable is set, every policy evaluates to false: **the default is deny, not allow.**

**A real, non-obvious fix was required to make layer 2 actually work**: Postgres unconditionally bypasses Row-Level Security for superusers and — via `FORCE ROW LEVEL SECURITY` notwithstanding — for the table owner too. The role Prisma Migrate uses to create the schema (`postgres` locally; the platform admin role on Supabase) is both. The third migration (`20260916231000_app_runtime_role`) creates a separate, non-superuser `app_runtime` role with only the privileges the running application needs, and `DATABASE_URL` (what the app's Prisma Client actually connects as) points at that role, while `DIRECT_URL` (used only by `prisma migrate`) stays pointed at the admin role. This was caught specifically because `tests/integration/businessIsolation.test.ts` exercises RLS by connecting through the same restricted role the real application would use, not through the migration role — an earlier version of that test suite passed against the *wrong* thing (RLS policies that existed but were silently bypassed by the superuser connection) until this was corrected. See that test file's "database-layer authorization (Row-Level Security, defense-in-depth)" describe block, and the migration's own header comment, for the full explanation.

**Note for a real Supabase deployment**: Supabase has its own role model (`anon`, `authenticated`, `service_role`, PostgREST-mediated access) that a production deployment would likely use instead of hand-rolling `app_runtime`. This phase's `app_runtime` role is a faithful, correct approximation of "the app connects as something other than the schema owner" for local development and the test suite; reconciling it with Supabase's actual role model is implementation work for whichever phase first provisions a real Supabase project, not a Phase 3 decision.

## Transaction Strategy

Every domain operation runs inside exactly one `prisma.$transaction(...)` call, wrapped by `withAuthorizedTransaction` (sets the RLS session variable, then hands the caller a typed transaction client). Finalization (`finalizeInvoice`, Section 10 of the Phase 3 brief) performs its full 17-step sequence — validation, tax resolution, calculation, number allocation, snapshot capture, and the audit event — inside that one transaction, so a failure at any step rolls back everything, including the advisory-lock-guarded number allocation (see "Invoice Numbering" below). This is proven, not just asserted: `tests/integration/numbering.test.ts`, "finalization is truly atomic," runs `finalizeInvoice` as its own top-level transaction, forces a validation failure, and confirms — from a *separate*, later transaction — that the invoice is still `Draft` with no number and no tax lines were written.

## Money / Decimal Strategy (Section 8 of the Phase 3 brief)

All monetary and quantity fields are PostgreSQL `NUMERIC` (via Prisma's `Decimal`, `@db.Decimal(12,2)` for money, `@db.Decimal(10,2)` for quantity, `@db.Decimal(7,5)` for tax rates). `src/server/domain/money.ts` centralizes every calculation (line subtotal, pre-tax subtotal, tax group amount, total tax, invoice total, balance due, overpayment) using `decimal.js`, with `ROUND_HALF_UP` set explicitly rather than relying on a default. No file in `src/server/domain` performs money arithmetic with native JavaScript numbers. `hasAtMostDecimalPlaces` rejects a quantity/unit-price input with more than 2 decimal places at the point of entry (`setDraftLineItems`) rather than silently truncating it — this was a real bug caught during integration testing (an over-precise test input was silently truncated when persisted, then a *different*, wrong value was used when finalization recomputed from the stored — already-truncated — figure); it is now a `ValidationError`, not a silent precision loss.

## Testing Strategy

Two Vitest configurations, run separately (`npm run test:unit`, `npm run test:integration`; `npm test` runs both):

- **Unit** (`vitest.config.ts` → `tests/unit/`): pure-function tests for the money engine, the tax-grouping engine, and Supabase JWT verification. No database.
- **Integration** (`vitest.integration.config.ts` → `tests/integration/`): exercises the domain layer against a **real, ephemeral PostgreSQL 17 instance** (the `embedded-postgres` npm package — real Postgres binaries, no Docker or system install required), booted once via Vitest's `globalSetup` before any test file's imports resolve (this ordering is what makes `DATABASE_URL` reliably visible to `src/server/db/client.ts`'s module-level `PrismaClient` construction). All three migrations apply for real; RLS, the CHECK constraints, the partial unique index, and the append-only trigger are exercised as actual Postgres behavior, not mocked.

23 unit tests, 39 integration tests, all passing (see the Final Report). Coverage maps directly to Section 26 of the Phase 3 brief's required list: invoice lifecycle transitions, numbering (including the atomicity test above), snapshot freezing and independence from later Client/Business edits, financial calculations (line rounding, multi-group tax, distinct-rate grouping, Revenue excluding tax), payments (finalized-only, amount/date immutability via reversal, double-reversal rejection, overpayment surfaced not blocked), business isolation (both layers, including a deliberately-unauthenticated raw query), historical data (provenance, preserved-not-recalculated tax, unverified-field support, duplicate-number rejection), and audit (required events present, prior-value preservation, and append-only enforcement proven against the actual restricted role rather than an error-message string match — see that test's comment for why the naive version of this assertion was unreliable).

## Architecture Notes / Open Questions for the Project Director

- **Mixed-tax-group applicability** (`src/server/domain/taxCalculation.ts`): Phase 2 §07 Section 9's worked example implies line-level tax-group applicability, but no Phase 1/2 field defines which configured tax groups apply to which invoice lines. The previous Phase 3 implementation silently applied every configured tax line to the same full taxable subtotal. That interpretation has been **removed**. Invoices under a business tax configuration with more than one configured tax group now fail finalization with `UnresolvedTaxApplicabilityError` until the Project Director resolves the competing interpretations. Full remediation detail: [01-tax-applicability-remediation.md](01-tax-applicability-remediation.md).
- **Invoice number format** (`src/server/domain/invoiceNumbering.ts`): plain increasing integers ("1", "2", "3", ...), per business. This is the narrowest placeholder for what Phase 1 (DEC-INV-009) and Phase 2 (DEC-ARCH-027) explicitly leave as business configuration — no prefix, padding, or year component was invented. Reconciling this with Business A's actual historical numbering pattern remains unresolved pending that source data (Phase 1 UD-DATA-003 / Phase 2 DEC-ARCH-021), unchanged from Phase 2.
- No other Phase 0/1/2 `UNRESOLVED` item (fiscal-year YTD, tax rounding professional confirmation, zero-rated/exempt service classification, period attribution for corrections, Calendar matching/confidence/duplicate-detection algorithms) was resolved in this phase. Where the schema needed a placeholder to exist at all (e.g., `WorkCandidate.matchConfidence` as a bare `MATCHED | UNMATCHED` enum), it is documented in `prisma/schema.prisma` as exactly that — a placeholder, not an algorithm.

## What Was Not Built (Explicitly Out of Scope for This Phase)

Per Sections 3 and 23 of the Phase 3 brief: no Google Calendar synchronization (only the persistence structures — `CalendarConnection`, `SelectedCalendar`, `CalendarEvent`, `WorkCandidate` — and the review-gate state machine around them), no email sending, no PDF generation, no product UI beyond the two illustrative routes described above, and no Business A data migration (only the `importHistoricalInvoice` persistence primitive a future migration process would call).
