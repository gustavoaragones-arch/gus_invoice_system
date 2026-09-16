# 05 — Entity Field Specification

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Field-level specification for every domain entity. Types are conceptual. No business-fact defaults invented.

## 2. Business

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | unique | No | No | No | |
| name | text | Yes | Yes | — | non-empty | No | No | No | |
| legalName | text | No | Yes | — | — | No | Yes | No | Invoice display |
| address | text | No | Yes | — | — | No | Yes | No | Invoice display |
| gstHstRegistrationNumber | text | No | Yes | — | format when present | No | Yes | No | **BUSINESS CONFIG** — not assumed |
| brandingLogoRef | reference | No | Yes | — | — | No | Yes | No | |
| createdAt | timestamp | Yes | No | system | — | No | No | No | |
| updatedAt | timestamp | Yes | Yes | system | — | No | No | No | |

## 3. Client

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | unique | No | No | No | |
| businessId | identifier | Yes | No | — | must exist | No | No | No | isolation key |
| name | text | Yes | Yes | — | non-empty | No | No | No | |
| billingAddress | text | No | Yes | — | — | No | No | No | sensitive |
| contactEmail | text | No | Yes | — | email format if present | No | No | No | |
| status | enum | No | Yes | active | active/inactive | No | No | No | exact states unresolved |
| createdAt | timestamp | Yes | No | system | — | No | No | No | |
| provenance | enum | No | No | system-created | system-created/historical-import | No | No | No | if imported |

## 4. Service

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | unique | No | No | No | |
| businessId | identifier | Yes | No | — | must exist | No | No | No | |
| description | text | Yes | Yes | — | non-empty | No | No | No | |
| unit | text | Yes | Yes | — | e.g. hour | No | No | No | |
| defaultRate | money | Yes | Yes | — | ≥ 0, 2 decimals | No | No | No | catalog only |
| taxStatus | enum | No | Yes | — | taxable/zero-rated/exempt | No | No | No | **PROFESSIONAL CONFIRMATION** |
| status | enum | No | Yes | active | active/inactive | No | No | No | |
| businessId | identifier | Yes | No | — | | No | No | No | |

## 5. Invoice

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | unique | No | No | No | |
| businessId | identifier | Yes | No | — | must exist | No | Yes | No | |
| clientId | identifier | Yes | Draft only | — | same business | No | Yes | No | live relationship reference; does not substitute for snapshot |
| status | enum | Yes | lifecycle only | Draft | Draft/Finalized/Void | No | Yes | No | |
| invoiceNumber | text | No until Finalized | No | — | unique per business | No | Yes | No | assigned atomically |
| invoiceDate | date | Yes at Finalized | No post-final | — | — | Yes | Yes | No | |
| dueDate | date | No | No post-final | — | — | Yes | Yes | No | may be unverified historical |
| preTaxSubtotal | money | Yes at Finalized | No post-final | — | 2 decimals | Yes | Yes | No | Revenue basis |
| totalTax | money | Yes at Finalized | No post-final | — | 2 decimals | Yes | Yes | No | sum of tax lines |
| invoiceTotal | money | Yes at Finalized | No post-final | — | 2 decimals | Yes | Yes | No | |
| paymentTerms | text | No | No post-final | — | — | Yes | Yes | No | |
| notes | text | No | No post-final | — | — | No | No | No | internal if not on PDF |
| provenance | enum | Yes | No | system-created | system-created/historical-import | No | Yes | No | DEC-HIST-002 |
| replacedInvoiceId | identifier | No | No | — | must be Void | No | Yes | No | correction link |
| replacementInvoiceId | identifier | No | No | — | | No | Yes | No | |
| voidedAt | timestamp | No | No | — | when Void | No | Yes | No | |
| voidReason | text | No | No | — | recommended | No | Yes | No | |
| finalizedAt | timestamp | No | No | — | at finalization | No | Yes | No | |
| fieldVerification | map | No | No | — | unverified markers | No | No | No | DEC-HIST-007 |
| billedClientSnapshot | structured | Yes at Finalized | Draft: yes; Finalized/Void: no | — | see below | No | Yes | No | authoritative billed-client identity |
| billedBusinessSnapshot | structured | Yes at Finalized | Draft: yes; Finalized/Void: no | — | see below | No | Yes | No | authoritative printed business identity |

### 5.1 Invoice.billedClientSnapshot

| Field | Type | Required | Mutable | Notes |
|---|---|---|---|---|
| name | text | Yes at Finalized | Draft: yes; Finalized/Void: no | Client name as billed |
| billingAddress | text | No | Draft: yes; Finalized/Void: no | Billing address as printed |
| contactEmail | text | No | Draft: yes; Finalized/Void: no | Contact email as printed |

- **When populated**: At finalization from current Client record (or historical import source).
- **Historical import**: Populated from available source; unverified fields marked via `fieldVerification`.
- **Financial**: No (presentation/identity).
- **Audit-sensitive**: Yes.
- **Rendering rule**: Finalized invoice reproduction must use snapshot, not live Client record.

### 5.2 Invoice.billedBusinessSnapshot

| Field | Type | Required | Mutable | Notes |
|---|---|---|---|---|
| legalName | text | Yes at Finalized | Draft: yes; Finalized/Void: no | Business name as printed |
| address | text | No | Draft: yes; Finalized/Void: no | Business address as printed |
| gstHstRegistrationNumber | text | No | Draft: yes; Finalized/Void: no | When applicable; **BUSINESS CONFIG** |
| brandingLogoRef | reference | No | Draft: yes; Finalized/Void: no | Logo reference when applicable |

- **When populated**: At finalization from current Business settings (or historical import source).
- **Historical import**: Populated from available source; unverified fields marked via `fieldVerification`.
- **Financial**: No (presentation/identity).
- **Audit-sensitive**: Yes.
- **Rendering rule**: Finalized invoice reproduction must use snapshot, not live Business record.

A finalized invoice must not render billed identity solely from current `clientId` or `businessId` lookups.

## 6. InvoiceLineItem

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | | No | No | No | |
| invoiceId | identifier | Yes | No | — | | No | Yes | No | |
| lineOrder | integer | Yes | Draft only | — | ≥ 1 | No | No | No | |
| description | text | Yes | Draft only | — | non-empty | Yes | Yes | No | captured |
| quantity | decimal | Yes | Draft only | — | > 0, ≤ 2 decimals | Yes | Yes | No | DEC-MONEY-004 |
| unitPrice | money | Yes | Draft only | — | ≥ 0, 2 decimals | Yes | Yes | No | captured |
| lineSubtotal | money | Yes at Finalized | No post-final | — | rounded | Yes | Yes | No | |
| taxStatus | enum | Yes | Draft only | — | taxable/zero-rated/exempt | Yes | Yes | No | |
| taxGroupKey | text | Yes at Finalized | No post-final | — | taxAuthority+taxType+rate | Yes | Yes | No | must agree with InvoiceTaxLine |
| serviceId | identifier | No | Draft only | — | captured ref | No | No | No | not live |
| workCandidateId | identifier | No | No | — | provenance | No | Yes | No | audit chain |

## 7. InvoiceTaxLine

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | | No | No | No | |
| invoiceId | identifier | Yes | No | — | | No | Yes | No | |
| taxAuthority | text | Yes | No | — | e.g. CRA, BC PST | Yes | Yes | No | |
| taxType | text | Yes | No | — | e.g. GST/HST, PST | Yes | Yes | No | |
| rate | decimal | Yes | No | — | not hard-coded | Yes | Yes | No | captured at finalization |
| taxableSubtotal | money | Yes | No | — | | Yes | Yes | No | |
| taxAmount | money | Yes | No | — | rounded once | Yes | Yes | No | |

## 8. Payment

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | | Yes | Yes | No | |
| invoiceId | identifier | Yes | No | — | finalized invoice | Yes | Yes | No | immutable association |
| amount | money | Yes | No | — | > 0, 2 decimals | Yes | Yes | No | DEC-PAY-003 |
| paymentDate | date | Yes | No | — | | Yes | Yes | No | |
| method | text | No | Yes | — | configurable set | No | Yes | No | DEC-PAY-005 |
| notes | text | No | Yes | — | | No | Yes | No | |
| createdAt | timestamp | Yes | No | system | | No | Yes | No | |

## 9. PaymentReversal

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | | Yes | Yes | No | |
| paymentId | identifier | Yes | No | — | | Yes | Yes | No | |
| reversedAt | timestamp | Yes | No | system | | No | Yes | No | |
| reason | text | No | No | — | recommended | No | Yes | No | |

## 10. TaxConfigurationVersion

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | | No | Yes | No | |
| businessId | identifier | Yes | No | — | | No | Yes | No | |
| effectiveFrom | date | Yes | No | — | | No | Yes | No | |
| effectiveTo | date | No | No | — | null = current | No | Yes | No | |
| isGstHstRegistered | boolean | Yes | No | — | **BUSINESS CONFIG** | No | Yes | No | not assumed |
| taxLines | collection | Yes | No | — | authority, type, rate | No | Yes | No | no hard-coded rates |
| createdAt | timestamp | Yes | No | system | | No | Yes | No | |

## 11. WorkCandidate

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | | No | Yes | No | |
| businessId | identifier | Yes | No | — | | No | Yes | No | |
| calendarEventId | identifier | Yes | No | — | | No | Yes | No | |
| reviewState | enum | Yes | Yes | pending | pending/edited/approved/rejected | No | Yes | No | |
| clientId | identifier | No | Yes | — | | No | Yes | No | |
| serviceId | identifier | No | Yes | — | | No | Yes | No | |
| editedDescription | text | No | Yes | — | | No | Yes | No | |
| editedQuantity | decimal | No | Yes | — | | No | Yes | No | |
| matchConfidence | enum | No | No | — | **UNRESOLVED** algorithm | No | No | No | |

## 12. AuditEvent

| Field | Type | Required | Mutable | Default | Validation | Financial | Audit | Derived | Notes |
|---|---|---|---|---|---|---|---|---|---|
| id | identifier | Yes | No | — | | No | N/A | No | append-only |
| businessId | identifier | Yes | No | — | | No | N/A | No | |
| eventType | enum | Yes | No | — | 14 types | No | N/A | No | see 11-audit-trail |
| timestamp | timestamp | Yes | No | system | | No | N/A | No | |
| actorUserId | identifier | Yes | No | — | | No | N/A | No | |
| entityType | text | Yes | No | — | | No | N/A | No | |
| entityId | identifier | Yes | No | — | | No | N/A | No | |
| priorValues | structured | No | No | — | when change | No | N/A | No | DEC-AUDIT-001 |
| newValues | structured | No | No | — | | No | N/A | No | |
| metadata | structured | No | No | — | | No | N/A | No | |

## 13. Fields Not Hard-Coded

The following must not receive system-invented default business values:

- GST/HST registration status
- Tax rates (5%, 13%, etc.)
- PST/RST/QST applicability
- Payment method enumeration
- Business A historical numbering pattern
- Zero-rated/exempt service classifications
