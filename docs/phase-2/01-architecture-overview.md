# 01 — Architecture Overview

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

This document defines the conceptual system architecture for the Canadian Private Billing System — sufficient for Phase 3 implementation planning without prescribing executable code or a specific ORM.

## 2. Core Workflow

The architecture must support this end-to-end workflow:

```
Business
   ↓
Client
   ↓
Work / Calendar Activity
   ↓
Review
   ↓
Invoice Draft
   ↓
Finalization
   ↓
Invoice
   ↓
Send
   ↓
Payment Recording
   ↓
Reporting
```

Google Calendar participates only as an assistive evidence source in the "Work / Calendar Activity" stage. A calendar event is never an invoice, payment, or authoritative financial fact.

## 3. Layered Architecture (Conceptual)

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer                                         │
│  (UI for business context, invoices, review, reporting)   │
└──────────────────────────┬──────────────────────────────────┘
                           │ user actions / queries
┌──────────────────────────▼──────────────────────────────────┐
│  Application / Domain Layer                                 │
│  lifecycle rules, calculations, authorization, audit        │
└──────────────────────────┬──────────────────────────────────┘
                           │ domain operations
┌──────────────────────────▼──────────────────────────────────┐
│  Data / Persistence Layer                                   │
│  authoritative records, append-only audit, configuration    │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   Authoritative      Derived            Integration
   Financial Data     Reporting          Boundary
   (Invoice,         (Revenue,          (Google Calendar,
    Payment,           Outstanding,       Email Delivery)
    AuditEvent)        Payment Status)
```

### 3.1 Presentation Layer

Handles user interaction: business context selection, invoice drafting, candidate work review, payment recording, reporting display. Must not be the security or business-isolation boundary.

### 3.2 Application / Domain Layer

Enforces Phase 1 behavioral rules: invoice lifecycle transitions, financial calculations, payment formulas, void/correction mechanics, tax grouping, audit event creation. All authorization decisions enforced here (and below).

### 3.3 Data / Persistence Layer

Stores authoritative financial records, configuration versions, audit events, calendar-derived candidates. Must support atomic finalization, append-only audit, and business-scoped queries.

## 4. Authoritative Data Sources

| Data | Authoritative Source | Not Authoritative |
|---|---|---|
| Invoice financial values | Finalized Invoice record (frozen at finalization) | Service catalog current rate |
| Payment amounts | Payment records (non-reversed) | — |
| Revenue | Derived from finalized, non-void invoice pre-tax subtotals | Payment totals |
| Sales Tax | Derived from finalized, non-void invoice tax amounts | — |
| Amount Collected | Derived from non-reversed payments by payment date | Invoice totals |
| Outstanding | Derived snapshot from finalized, non-void invoice balances | — |
| Billable work | Approved Invoice Line Items | Calendar Events, Work Candidates |
| Tax rates on invoice | Captured tax snapshot at finalization | Current tax configuration |

## 5. Derived vs. Persisted

| Concept | Persisted | Derived at Query Time |
|---|---|---|
| Invoice status | `Draft`, `Finalized`, `Void` | Payment Status, Overdue, Delivery Status |
| Invoice number | Yes (at finalization) | — |
| Line item subtotals | Yes (frozen at finalization) | — |
| Tax group amounts | Yes (frozen at finalization) | — |
| Amount Paid (invoice) | — | Sum of non-reversed payments |
| Balance Due | — | `MAX(0, Invoice Total − Amount Paid)` |
| Overpayment | — | `MAX(0, Amount Paid − Invoice Total)` |
| Revenue (period) | — | Sum of pre-tax subtotals by invoice date |
| Sales Tax (period) | — | Sum of tax amounts by invoice date |

## 6. Integration Boundary

External systems interact only through defined boundaries:

| Integration | Role | Boundary Rule |
|---|---|---|
| Google Calendar | Assistive event source | Read-only; produces Work Candidates only |
| Email delivery | Invoice send transport | Does not alter financial records |
| Authentication provider | Identity verification | Does not grant business-scoped access by itself |
| PDF generation | Invoice presentation | Uses frozen invoice snapshot |

No payment processor integration. No general ledger integration.

## 7. Audit Boundary

All financially material state changes produce append-only `AuditEvent` records. Audit events are never edited or deleted. See [11-audit-trail-model.md](11-audit-trail-model.md).

## 8. Security Boundary

Authentication establishes identity. Authorization enforces business-scoped access on every data operation. UI business switching is not sufficient for isolation. See [13-business-isolation-and-authorization-model.md](13-business-isolation-and-authorization-model.md) and [14-security-and-data-protection-architecture.md](14-security-and-data-protection-architecture.md).

## 9. Business-Isolation Boundary

Every business-owned entity carries a `businessId`. Cross-business queries are prohibited. Reporting is strictly per-business. See [13-business-isolation-and-authorization-model.md](13-business-isolation-and-authorization-model.md).

## 10. Technology Direction (Inherited, Not Implemented)

Phase 0 establishes a technology direction (Next.js, TypeScript, Vercel, Supabase PostgreSQL) for continuity. Phase 2 defines conceptual architecture independent of specific framework bindings. Implementation technology choices that are not fully specified remain in the [architecture decision register](17-architecture-decision-register.md) as `UNRESOLVED` where appropriate.
