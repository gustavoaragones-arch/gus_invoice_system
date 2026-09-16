# Phase 1 — Accounting & Billing Rules Definition

## Purpose

Phase 1 converts the accounting, invoice-lifecycle, payment, tax, money, historical-data, and auditability decisions left unresolved at the end of Phase 0 (see [`docs/phase-0/11-unresolved-decisions.md`](../phase-0/11-unresolved-decisions.md)) into a precise, internally consistent, implementation-ready **rules specification**. Phase 1 produces rules and decisions — it does not produce code, schema, or architecture.

## Relationship to Phase 0

Phase 0 (commit `db0de2c7adae35b2f762e48bf287614fb11e552e`, approved and locked) is the governing baseline. Phase 1 does not contradict, weaken, or silently amend Phase 0. Every rule in this phase either:

- resolves an item Phase 0 explicitly flagged as unresolved, or
- elaborates a Phase 0 requirement into an implementable rule without changing its intent, or
- is explicitly classified as still requiring business-specific configuration or professional (accountant/CRA) confirmation, rather than being invented.

No Phase 0 file was modified to produce Phase 1. Where Phase 1 encountered anything that looked like a genuine contradiction in Phase 0, it is recorded as an open item in [`11-accounting-decision-register.md`](11-accounting-decision-register.md) rather than resolved unilaterally — none were found (see [`12-phase-1-summary.md`](12-phase-1-summary.md), Cross-Document Validation).

## Authoritative Status

Once approved by the Project Director, this phase's rules become **authoritative behavioral requirements** binding on Phase 2 (Architecture) and all later implementation phases, in the same way Phase 0's requirements are binding. Until then, this documentation is a draft submitted for review.

## Scope

Phase 1 defines **behavioral rules only**: what the system's accounting/billing logic must do, conceptually. It does not select a database schema, ORM, API structure, component architecture, state-management technology, authentication implementation, or deployment approach — those remain Phase 2+ decisions. No application code, dependencies, database schema, migrations, external-service connections, or scope expansion were introduced in this phase.

## Files

1. [`01-accounting-basis.md`](01-accounting-basis.md) — What revenue means in this system, and the billing-vs-accounting boundary.
2. [`02-invoice-lifecycle.md`](02-invoice-lifecycle.md) — Authoritative invoice states and transitions.
3. [`03-invoice-numbering.md`](03-invoice-numbering.md) — Numbering assignment, sequencing, and business separation.
4. [`04-finalization-and-corrections.md`](04-finalization-and-corrections.md) — Finalization, immutability, voiding, and corrections.
5. [`05-payment-rules.md`](05-payment-rules.md) — Payment lifecycle, balances, overpayment, and reversal.
6. [`06-revenue-reporting-rules.md`](06-revenue-reporting-rules.md) — How reported figures are computed.
7. [`07-tax-and-pricing-rules.md`](07-tax-and-pricing-rules.md) — Tax presentation and calculation behavior, once configured.
8. [`08-money-and-rounding-rules.md`](08-money-and-rounding-rules.md) — Currency, precision, and rounding rules.
9. [`09-historical-record-rules.md`](09-historical-record-rules.md) — Treatment of Business A's historical records (rules only, no migration).
10. [`10-auditability-rules.md`](10-auditability-rules.md) — Which accounting/billing events must be auditable.
11. [`11-accounting-decision-register.md`](11-accounting-decision-register.md) — Formal register of every Phase 1 decision, classified and traceable.
12. [`12-phase-1-summary.md`](12-phase-1-summary.md) — Executive summary and readiness assessment.

## Prohibition on Implementation

No file in this phase authorizes or performs implementation. Phase 1 is a documentation phase. No application source code, React/Next.js code, API routes, database schema, SQL, migrations, authentication, Calendar/email/PDF implementation, UI, production configuration, seed data, Business A data migration, external service connections, payment processing, or scope expansion may be introduced under the authority of this phase. Implementation begins only after the Project Director authorizes a subsequent phase.
