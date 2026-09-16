# 18 — Phase 2 Summary

Status: Draft for Project Director review
Phase: 2 — System Architecture & Data Model Definition

## Phase 2 Objective

Convert approved Phase 0 product requirements and Phase 1 accounting/billing behavioral rules into a precise technical architecture and conceptual data model sufficient for Phase 3 implementation.

**Phase 2 defines the architecture but does not implement it.**

## Documents Produced

19 Phase 2 documentation files covering architecture overview, boundaries, domain model, data model, field specifications, invoice invariants, financial calculations, tax configuration, payment/reversal, historical provenance, audit trail, Calendar boundary, business isolation, security, reporting, implementation invariants, and architecture decision register.

## Architecture Summary

- Layered conceptual architecture: presentation, application/domain, data/persistence
- Authoritative financial data in finalized Invoice and Payment records
- Derived reporting: Revenue, Sales Tax, Amount Collected, Outstanding, Payment Status
- Integration boundaries: Google Calendar (assistive), email delivery, authentication
- No general ledger, payment processing, or cross-business reporting

## Domain Model

16 conceptual entities:

Business, Client, Service, Invoice, InvoiceLineItem, InvoiceTaxLine, Payment, PaymentReversal, TaxConfigurationVersion, CalendarConnection, SelectedCalendar, CalendarEvent, WorkCandidate, InvoiceSendAttempt, AuditEvent, User

No LegacyInvoice entity.

## Data Model Highlights

- Business-scoped ownership on all financial entities
- Invoice lifecycle: Draft → Finalized → Void
- Correction via Void + Replacement linkage
- Immutable `billedClientSnapshot` and `billedBusinessSnapshot` on finalized invoices
- Tax snapshot frozen at finalization via InvoiceTaxLine
- Payment reversal as linked additive record
- Provenance: system-created | historical-import
- Live `clientId`/`businessId` for relationship/isolation; frozen snapshots for historical reproduction

## Invoice Invariants

- Three persisted states only
- Atomic finalization with number allocation
- Post-finalization immutability
- Void + Replacement as sole correction mechanism
- Void does not move payments

## Financial Calculation Model

- Revenue = pre-tax subtotal (excludes sales tax)
- Sales Tax = separate invoice-based figure
- Amount Collected = payment-based by payment date
- Tax groups = taxAuthority + taxType + rate
- Round at line and per tax group
- Invoice Total = pre-tax subtotal + sum of tax groups

## Tax Configuration

- Versioned per Business with effective dates
- No hard-coded rates or registration status
- Snapshot captured at finalization
- No retroactive recalculation

## Payment/Reversal Model

- Immutable amount/date; correctable method/notes
- Reversal + replacement for amount/date correction
- Payments remain on void invoices
- Replacement does not inherit payments

## Historical Provenance

- Same Invoice model with provenance attribute
- Import-only Finalized entry path
- Unverified field support
- Historical tax/number preserved

## Audit Model

- 14 append-only event types
- Prior value preservation on changes
- Business-scoped

## Calendar Boundary

```
Calendar Event → Work Candidate → Review → Invoice Draft
```

Never automatic invoice creation. OAuth server-side only.

## Business Isolation

- businessId on all business-owned entities
- Server-side enforcement required
- UI switching not sufficient
- Per-business numbering and reporting

## Security Architecture

- Authentication required for all data access
- Authorization server-side
- OAuth tokens encrypted, server-only
- Immutable financial records protected
- Audit trail append-only

## Reporting/Query Model

| Figure | Basis | Date |
|---|---|---|
| Revenue | Invoice, pre-tax | Invoice date |
| Sales Tax | Invoice, tax | Invoice date |
| Amount Collected | Payment | Payment date |
| Outstanding | Snapshot | Point-in-time |

## Implementation Invariants

69 invariants defined in [16-implementation-invariants.md](16-implementation-invariants.md) for Phase 3 enforcement. All 69 invariant IDs are globally unique. Payment Reversal uses `INV-PREV-001` through `INV-PREV-003`; Revenue uses `INV-REV-001` through `INV-REV-004`.

## Architecture Decisions

32 decisions in [17-architecture-decision-register.md](17-architecture-decision-register.md), including `DEC-ARCH-031` (billed client snapshot) and `DEC-ARCH-032` (billed business snapshot), plus 6 UNRESOLVED items carried forward.

PostgreSQL/Supabase remains the inherited Phase 0 technology direction. The exact Phase 3 persistence implementation mechanism (ORM/data-access approach and executable schema) remains unresolved per `DEC-ARCH-019`.

## Unresolved Items (Not Silently Resolved)

1. Business A historical invoice-numbering reconciliation
2. Fiscal-year vs. calendar-year YTD
3. Professional confirmation of tax calculation/rounding
4. Zero-rated/exempt service classifications
5. Period attribution for corrected invoices
6. Calendar matching/confidence/duplicate algorithms

## Cross-Document Validation

Consistency review performed against Phase 0/1 and Phase 2 documents:

| Check | Result |
|---|---|
| Phase 0 requirements represented | Pass |
| Phase 1 rules architecturally represented | Pass |
| No Phase 1 rule silently changed | Pass |
| No Phase 0 exclusion violated | Pass |
| Business isolation enforced | Pass |
| Invoice lifecycle consistent | Pass |
| Revenue excludes sales tax | Pass |
| Tax groups use type/authority + rate | Pass |
| Void/payment behavior preserved | Pass |
| Calendar assistive only | Pass |
| No implementation artifacts created | Pass |
| Unresolved items preserved | Pass |
| Finalized client/business snapshots represented | Pass |
| Implementation invariant IDs unique | Pass |
| Tax group identity = taxAuthority + taxType + rate | Pass |
| Payment reversal reason optional and consistent | Pass |

## Phase 3 Prerequisites

Before implementation:

1. Project Director approval of Phase 2 architecture
2. Resolution or explicit acceptance of UNRESOLVED architecture decisions
3. Business-specific tax configuration facts (when available)
4. Business A source data (for migration planning)
5. Technology implementation choices within Phase 0 direction

## Scope Compliance

No application code, migrations, API routes, UI, dependencies, or configuration files created. Phase 0 and Phase 1 documents unmodified.

## Recommendation

Phase 2 documentation is ready for Project Director review.
