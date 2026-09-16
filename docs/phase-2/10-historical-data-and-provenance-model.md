# 10 — Historical Data and Provenance Model

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Translate Phase 1 historical rules into architecture. No separate legacy model.

## 2. Same Model Principle (DEC-HIST-001)

Historical invoices, clients, services, and payments use the same entities as live records:

- `Invoice` (not `LegacyInvoice`)
- `Client`
- `Service`
- `Payment`

## 3. Provenance Values (DEC-HIST-002)

Controlled provenance enumeration:

```
system-created
historical-import
```

No additional categories unless later authorized.

## 4. Historical Invoice Entry (DEC-HIST-003)

| Path | Entry State |
|---|---|
| Ordinary creation | Draft → Finalized |
| Historical import | Finalized directly (import-only exception) |

Historical import path must be explicitly authorized and auditable.

## 5. Completeness Exemption (DEC-HIST-004)

Historical Finalized invoices exempt from standard finalization validation (FR-INV-013).

Architecture support:
- `fieldVerification` map or equivalent on Invoice
- Fields may be marked `unverified` rather than fabricated (DEC-HIST-007)
- UI must show uncertainty, not silent defaults

## 6. Historical Invoice Numbers (DEC-HIST-005)

- Original number preserved exactly
- Never renumbered to fit new sequence
- Reconciliation with new sequential numbering: **UNRESOLVED** (Business A source data required)

Architecture accommodates:
- Historical numbers stored as-is
- New sequence may continue from last historical, use prefix, or acknowledge discontinuity — decision deferred

## 7. Historical Tax Values (DEC-HIST-006)

- Tax amounts preserved as originally recorded
- Not recalculated against current TaxConfigurationVersion
- InvoiceTaxLine records store imported values directly

## 8. Post-Import Immutability (DEC-HIST + Section 9)

Once imported as Finalized:
- Same immutability rules as any Finalized invoice
- Correction only via Void + Replacement
- No in-place "fix the import" editing

## 9. Unverified Fields (DEC-HIST-007)

Where historical fact cannot be verified:
- Represent as explicitly unverified
- Never silently substitute best guess
- Field-level verification state supported in data model

## 10. Facts Not Resolved by Architecture

| Item | Status |
|---|---|
| Business A source data format | UNRESOLVED |
| Historical numbering reconciliation | UNRESOLVED |
| Historical payment records completeness | UNRESOLVED |
| Client data quality | UNRESOLVED |

Architecture provides import path and provenance; does not invent historical data.
