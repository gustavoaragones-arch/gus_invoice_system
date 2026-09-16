# 04 — Data Model

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Complete conceptual data model with relationships, cardinality, and field categories. Not executable schema.

## 2. Relationship Overview

```
User 1 ─── N Business

Business 1 ─── N Client
Business 1 ─── N Service
Business 1 ─── N Invoice
Business 1 ─── N TaxConfigurationVersion
Business 1 ─── N CalendarConnection
Business 1 ─── N WorkCandidate
Business 1 ─── N AuditEvent

Client 1 ─── N Invoice

Invoice 1 ─── N InvoiceLineItem
Invoice 1 ─── N InvoiceTaxLine
Invoice 1 ─── N Payment
Invoice 1 ─── N InvoiceSendAttempt
Invoice 1 ─── 0..1 replacedInvoiceId (original voided invoice)
Invoice 1 ─── 0..1 replacementInvoiceId (replacement, if corrected)

InvoiceLineItem N ─── 0..1 Service (captured reference)
InvoiceLineItem N ─── 0..1 WorkCandidate (provenance)

Payment 1 ─── N PaymentReversal

CalendarConnection 1 ─── N SelectedCalendar
SelectedCalendar 1 ─── N CalendarEvent
CalendarEvent 1 ─── 0..N WorkCandidate (duplicate detection may limit to 1 active)

WorkCandidate N ─── 0..1 Client (matched or user-assigned)
WorkCandidate N ─── 0..1 Service (matched or user-assigned)
```

## 3. Entity Specifications

### 3.1 Business

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Required | `name`, `createdAt` |
| Optional | branding fields (legal name, address, logo reference) |
| Immutable | `id`, `createdAt` |
| Mutable | branding, display settings |
| Derived | — |
| Effective-dated | — |
| Audit-sensitive | invoice-affecting settings changes |
| Provenance | `system-created` (all businesses) |

### 3.2 Client

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Business ownership | `businessId` (required, immutable) |
| Required | `name`, `businessId` |
| Optional | billing address, contact email, phone, status |
| Immutable | `businessId` |
| Mutable | name, address, contact (with invoice traceability preserved) |
| Financial | No |
| Audit-sensitive | Low |

### 3.3 Service

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Business ownership | `businessId` (required, immutable) |
| Required | `description`, `unit`, `defaultRate`, `businessId` |
| Optional | tax status flag (taxable/zero-rated/exempt — configuration) |
| Immutable | `businessId` |
| Mutable | description, unit, rate, status, tax status |
| Financial | Rate is catalog reference only; line items capture at invoicing |

### 3.4 Invoice

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Live relationship fields | `businessId` (required, immutable), `clientId` (required; relationship/isolation reference) |
| Frozen snapshot fields | `billedClientSnapshot`, `billedBusinessSnapshot` (populated and frozen at finalization) |
| Required | `clientId`, `status`, `businessId`, `provenance` |
| Assigned at finalization | `invoiceNumber`, `invoiceDate`, `dueDate`, `preTaxSubtotal`, `totalTax`, `invoiceTotal`, `billedClientSnapshot`, `billedBusinessSnapshot`, tax snapshot |
| Optional | `notes`, `paymentTerms`, `voidReason`, `replacedInvoiceId`, `replacementInvoiceId` |
| Immutable (post-finalization) | All financial fields, number, dates, `billedClientSnapshot`, `billedBusinessSnapshot`, tax snapshot |
| Derived (query-time) | `paymentStatus`, `balanceDue`, `overpayment`, `overdue`, `deliveryStatus` |
| Provenance | `system-created` \| `historical-import` |
| Unverified fields | Snapshot or other fields may carry `unverified` marker on historical import |

#### Invoice snapshot structures

```
Invoice
 ├── businessId                    (live ownership/isolation reference)
 ├── clientId                      (live relationship/reporting reference)
 ├── billedClientSnapshot          (immutable billed-client identity after finalization)
 └── billedBusinessSnapshot        (immutable business identity/branding after finalization)
```

**`billedClientSnapshot`** — immutable snapshot of client identity/billing information as issued:

| Field | Purpose |
|---|---|
| name | Client name as billed |
| billingAddress | Billing address as printed |
| contactEmail | Contact email as printed, when applicable |

**`billedBusinessSnapshot`** — immutable snapshot of business identity/branding as printed:

| Field | Purpose |
|---|---|
| legalName | Business legal/operating name as printed |
| address | Business address as printed |
| gstHstRegistrationNumber | GST/HST registration number when applicable |
| brandingLogoRef | Logo reference when applicable |

Both snapshots are:
- **Draft**: editable/replaceable as draft context changes
- **Finalized**: immutable
- **Void**: immutable (frozen as at finalization)
- **Historical import**: populated from available historical source; unverified fields use `fieldVerification`

Changing the live `Client` or `Business` record later must never alter a finalized invoice's snapshots.

### 3.5 InvoiceLineItem

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Parent | `invoiceId` (required, immutable) |
| Required | `description`, `quantity`, `unitPrice`, `lineSubtotal`, `taxStatus` |
| Optional | `serviceId` (captured), `workCandidateId` (provenance) |
| Immutable (post-finalization) | All fields |
| Financial | Yes |
| Tax group assignment | `taxGroupKey` — identifies `taxAuthority + taxType + rate` (must agree with `InvoiceTaxLine`) |

### 3.6 InvoiceTaxLine

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Parent | `invoiceId` (required, immutable) |
| Required | `taxAuthority`, `taxType`, `rate`, `taxableSubtotal`, `taxAmount` |
| Immutable | All fields (created at finalization) |
| Financial | Yes |

### 3.7 Payment

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Parent | `invoiceId` (required, immutable) |
| Required | `amount`, `paymentDate`, `invoiceId` |
| Optional | `method`, `notes` |
| Immutable | `amount`, `paymentDate`, `invoiceId` |
| Mutable | `method`, `notes` |
| Financial | Yes |
| Derived | `isReversed` (from linked reversals) |

### 3.8 PaymentReversal

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Parent | `paymentId` (required, immutable) |
| Required | `paymentId`, `reversedAt` |
| Optional | `reason` (optional; recommended) |
| Immutable | All fields |
| Financial | Yes (offsetting) |

### 3.9 TaxConfigurationVersion

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Business ownership | `businessId` (required, immutable) |
| Required | `businessId`, `effectiveFrom`, configuration payload |
| Configuration payload | registration status, tax lines (authority, type, rate), place-of-supply rules reference |
| Immutable | Version record once created |
| Effective-dated | `effectiveFrom`, optional `effectiveTo` |
| No hard-coded rates | Rates supplied per business configuration |

### 3.10 WorkCandidate

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Business ownership | `businessId` (required, immutable) |
| Required | `calendarEventId`, `reviewState`, `businessId` |
| Optional | `clientId`, `serviceId`, user-edited description/quantity |
| Review states | `pending`, `edited`, `approved`, `rejected` |
| Not financial | Pre-approval only |

### 3.11 AuditEvent

| Category | Fields |
|---|---|
| Primary identifier | `id` |
| Required | `eventType`, `timestamp`, `businessId`, `actorUserId`, `entityType`, `entityId` |
| Optional | `priorValues`, `newValues`, `metadata` |
| Immutable | All fields |
| Append-only | Yes |

## 4. Live References vs. Frozen Snapshots

For finalized invoices, live master records and frozen invoice snapshots serve different purposes:

```
Current Client record
    ↓ used to populate at finalization
Invoice.billedClientSnapshot   (authoritative for historical reproduction)

Current Business settings
    ↓ used to populate at finalization
Invoice.billedBusinessSnapshot (authoritative for historical reproduction)
```

After finalization:

| Change | Effect on finalized invoice |
|---|---|
| Client record changes | Does not change `billedClientSnapshot` |
| Business settings change | Does not change `billedBusinessSnapshot` |
| Service catalog changes | Does not change captured line item values |
| Tax configuration changes | Does not change frozen tax snapshot |

`clientId` and `businessId` remain useful for relationship, reporting, and isolation. They do **not** substitute for the frozen snapshots when reproducing a finalized invoice.

No `LegacyClient` or `LegacyBusiness` entities are introduced.

## 5. Cross-Cutting Data Rules

1. **Captured vs. live**: Line items store captured rate/description, not live Service reference for financial values.
2. **Frozen presentation**: Finalized invoices store `billedClientSnapshot` and `billedBusinessSnapshot` sufficient to reproduce billed identity and printed branding.
3. **Frozen tax**: Finalized invoices store tax configuration snapshot sufficient to reproduce calculation.
4. **No cross-business FKs**: A Payment's invoice must belong to the same Business as any queried context.
5. **Provenance**: `provenance` field on Invoice (and optionally other entities) distinguishes `system-created` from `historical-import`.
