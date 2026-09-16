# 03 — Domain Model

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Define the conceptual domain entities required to implement Phase 0/1. Each entity is evaluated against governing requirements.

## 2. Entity Summary

| Entity | Required | Rationale |
|---|---|---|
| Business | Yes | Phase 0 FR-BUS; top of ownership hierarchy |
| Client | Yes | Phase 0 FR-CLI |
| Service | Yes | Phase 0 FR-SVC |
| Invoice | Yes | Phase 0 FR-INV; central financial artifact |
| InvoiceLineItem | Yes | Phase 0; line items on invoices |
| InvoiceTaxLine | Yes | Frozen tax group amounts per invoice (Phase 1 tax grouping) |
| Payment | Yes | Phase 0 FR-PAY |
| PaymentReversal | Yes | Phase 1 DEC-PAY-004; linked reversal record |
| TaxConfigurationVersion | Yes | Phase 0 CFG-TAX; effective-dated per business |
| CalendarConnection | Yes | Phase 0 FR-CAL; OAuth per business |
| SelectedCalendar | Yes | Phase 0 CAL-SEL; calendars within connection |
| CalendarEvent | Yes | Phase 0; retrieved event evidence |
| WorkCandidate | Yes | Phase 0 Candidate Work; pre-financial review item |
| InvoiceSendAttempt | Yes | Phase 0 FR-DEL; delivery status derivation |
| AuditEvent | Yes | Phase 1; append-only audit trail |
| User | Yes | Phase 0 SEC-AUTHZ; single owner (minimal) |

No `LegacyInvoice` entity. Historical invoices use `Invoice` with provenance attributes (DEC-HIST-001).

## 3. Entity Definitions

### 3.1 Business

- **Purpose**: Represents one Canadian business profile (Business A, Business B, or future profiles).
- **Ownership**: Owned by the system user (single owner).
- **Lifecycle**: Created; extended with additional profiles later; no deletion specified.
- **Authoritative/Derived**: Authoritative for identity and settings.
- **Business scope**: Is the scope root — not scoped to another business.
- **Relationships**: Has many Clients, Services, Invoices, TaxConfigurationVersions, CalendarConnections, WorkCandidates, AuditEvents.
- **Immutable**: Core identity once established; tax config changes via versioned records.
- **Configurable**: Branding, tax registration, invoice-affecting settings.
- **Audit**: Settings changes that affect invoices require audit events.

### 3.2 Client

- **Purpose**: Billable customer of one business.
- **Ownership**: Exactly one Business.
- **Lifecycle**: Created, edited, active/inactive (exact states unresolved).
- **Authoritative/Derived**: Authoritative.
- **Immutable**: Identity link to historical invoices must not break on rename.
- **Audit**: Not financially material unless referenced in audit context.

### 3.3 Service

- **Purpose**: Catalog item with description, unit, default rate.
- **Ownership**: Exactly one Business.
- **Lifecycle**: Created, edited, may become inactive.
- **Authoritative/Derived**: Authoritative for catalog; captured values on line items are authoritative for invoice.
- **Immutable**: Catalog edits do not retroactively change finalized line items (FR-SVC-006).

### 3.4 Invoice

- **Purpose**: Bill issued to a Client; central financial artifact.
- **Ownership**: Exactly one Business, one Client.
- **Lifecycle**: `Draft` → `Finalized` → `Void` (or Draft deleted). Historical import enters as `Finalized`.
- **Authoritative/Derived**: Authoritative once finalized.
- **Immutable (post-finalization)**: All financial fields, number, date, client identity as billed, tax snapshot.
- **Configurable**: Pre-finalization content is editable.
- **Audit**: Finalization, void, replacement linkage require audit events.

### 3.5 InvoiceLineItem

- **Purpose**: One billed item on an Invoice.
- **Ownership**: Exactly one Invoice (transitively one Business).
- **Lifecycle**: Created/edited in Draft; immutable after parent finalization.
- **Authoritative/Derived**: Authoritative (captured values, not live Service reference).
- **Relationships**: May reference Service (captured), WorkCandidate (provenance).
- **Audit**: Included in invoice finalization audit.

### 3.6 InvoiceTaxLine

- **Purpose**: Frozen tax amount for one tax group on a finalized invoice.
- **Ownership**: Exactly one Invoice.
- **Lifecycle**: Created at finalization; immutable thereafter.
- **Authoritative/Derived**: Authoritative snapshot.
- **Represents**: One tax type/authority + applicable rate combination and its rounded amount.

### 3.7 Payment

- **Purpose**: Payment received against an Invoice.
- **Ownership**: Exactly one Invoice (transitively one Business).
- **Lifecycle**: Created by explicit user action against finalized non-void invoice.
- **Immutable**: Amount and payment date.
- **Mutable**: Method and notes (non-financial correction in place).
- **Audit**: Creation, reversal, method/note correction.

### 3.8 PaymentReversal

- **Purpose**: Offsetting record linked to a Payment; corrects amount/date.
- **Ownership**: Exactly one Payment (transitively one Business).
- **Lifecycle**: Created when user reverses a payment; never deleted.
- **Authoritative/Derived**: Authoritative; causes original payment to be excluded from Amount Paid.

### 3.9 TaxConfigurationVersion

- **Purpose**: Effective-dated tax settings for a Business.
- **Ownership**: Exactly one Business.
- **Lifecycle**: New version created on change; prior versions preserved.
- **Authoritative/Derived**: Authoritative for invoices finalized during its effective period.
- **Configurable**: Registration status, rates, tax authorities — supplied by owner, not defaulted.

### 3.10 CalendarConnection

- **Purpose**: Authorized link between Business and Google account.
- **Ownership**: Exactly one Business.
- **Lifecycle**: Created via OAuth; disconnected (tokens invalidated).
- **Sensitive**: OAuth tokens server-side only.

### 3.11 SelectedCalendar

- **Purpose**: One Google Calendar selected as event source within a Connection.
- **Ownership**: Via CalendarConnection → Business.

### 3.12 CalendarEvent

- **Purpose**: Retrieved Google event — evidence, not financial fact.
- **Ownership**: Via CalendarConnection → Business.
- **Lifecycle**: Retrieved on sync; may be updated/cancelled externally.
- **Immutable (in system)**: System does not edit Google's event; stores retrieval snapshot.

### 3.13 WorkCandidate

- **Purpose**: Suggested billable work from Calendar Event; requires review.
- **Ownership**: Exactly one Business.
- **Lifecycle**: Created on sync → edited → approved/rejected.
- **Authoritative/Derived**: Pre-financial; not authoritative until approved into line item.
- **Audit**: Approval, rejection, edit events.

### 3.14 InvoiceSendAttempt

- **Purpose**: Record of an invoice send attempt for Delivery Status derivation.
- **Ownership**: Exactly one Invoice.
- **Lifecycle**: Append-only log of send attempts.

### 3.15 AuditEvent

- **Purpose**: Immutable record of a material action.
- **Ownership**: Scoped to Business of affected entity.
- **Lifecycle**: Append-only; never edited or deleted.

### 3.16 User

- **Purpose**: The single authenticated owner.
- **Ownership**: System-level (not business-scoped).
- **Lifecycle**: Minimal; single owner in initial release.

## 4. Conceptual Domain Diagram

```
Business
 ├── Client
 ├── Service
 ├── TaxConfigurationVersion
 ├── CalendarConnection
 │    └── SelectedCalendar
 │         └── CalendarEvent
 │              └── WorkCandidate
 ├── Invoice
 │    ├── InvoiceLineItem ──(optional)── WorkCandidate
 │    ├── InvoiceTaxLine
 │    ├── Payment
 │    │    └── PaymentReversal
 │    ├── InvoiceSendAttempt
 │    └── (optional) replacesInvoice / replacedByInvoice
 └── AuditEvent
```
