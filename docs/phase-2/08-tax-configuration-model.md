# 08 — Tax Configuration Model

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Represent tax configuration technically without assuming business tax facts.

## 2. Model: Versioned Per-Business Configuration

Tax configuration is stored as `TaxConfigurationVersion` records scoped to exactly one Business.

```
Business
 └── TaxConfigurationVersion (effectiveFrom, effectiveTo, taxLines[])
```

No global tax configuration. Business A and Business B have independent version histories.

## 3. Version Structure

Each version contains:

| Component | Description |
|---|---|
| effectiveFrom | Date from which this version applies |
| effectiveTo | Date until which (null = current) |
| isGstHstRegistered | Whether business charges GST/HST — **BUSINESS CONFIG** |
| taxLines[] | Collection of applicable tax authorities/types and rates |

Each tax line in configuration:

| Field | Description |
|---|---|
| taxAuthority | e.g. CRA, Revenu Québec, BC Ministry of Finance |
| taxType | e.g. GST, HST, PST, QST |
| rate | Applicable rate — **not hard-coded** |
| appliesTo | Place-of-supply / jurisdiction rule reference — **BUSINESS CONFIG** |

## 4. Effective-Dating Rules

1. New configuration change creates a new version with new `effectiveFrom`.
2. Prior version's `effectiveTo` set to day before new version starts.
3. Invoices finalized during a version's effective period use that version.
4. At finalization, sufficient tax configuration is captured/frozen on the invoice (InvoiceTaxLine records + metadata).
5. Changing future configuration **never** retroactively recalculates finalized invoices (CFG-TAX-005, DEC-HIST-006).

## 5. Invoice Tax Snapshot

At finalization, the system must capture:

- Each InvoiceTaxLine (authority, type, rate, taxable subtotal, tax amount)
- Sufficient metadata to reproduce calculation without live config lookup
- Registration number displayed (from Business settings at finalization time)

Historical imports preserve tax values as recorded (DEC-HIST-006), not recalculated.

## 6. Tax Group Assignment at Calculation Time

For each taxable line item:
1. Determine applicable tax lines from configuration effective at finalization
2. Assign line to tax group: `taxAuthority + taxType + rate`
3. Zero-rated lines: 0% rate, excluded from taxable base but displayed
4. Exempt lines: no tax line, labeled exempt

## 7. What Is Not Hard-Coded

| Item | Treatment |
|---|---|
| 5% GST | BUSINESS CONFIGURATION |
| 13% Ontario HST | BUSINESS CONFIGURATION |
| Provincial PST/QST rates | BUSINESS CONFIGURATION + PROFESSIONAL CONFIRMATION |
| Registration status | BUSINESS CONFIGURATION |
| Place of supply | BUSINESS CONFIGURATION |
| Zero-rated/exempt services | PROFESSIONAL CONFIRMATION REQUIRED |

## 8. Configuration Change Audit

Tax configuration changes produce AuditEvents with prior and new values (DEC-AUDIT-001).

## 9. Unresolved Accommodation

Professional confirmation of calculation sequence (DEC-TAX-002) remains unresolved. Architecture supports the defined sequence; implementation must not substitute a different convention without authorization.
