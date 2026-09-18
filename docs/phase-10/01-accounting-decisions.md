# Phase 10 — Accounting Decisions

Status: Draft for Project Director review  
Phase: 10

This document records accounting decisions addressed in Phase 10. Items are explicitly labeled **APPROVED** (authoritative system behavior or an explicit Phase 10 resolution) or **UNRESOLVED** (no authoritative decision; existing behavior is preserved).

Phase 0–9 rules remain locked. Phase 10 does not invent accounting treatment.

---

## Fiscal year reporting

### Current behavior — APPROVED (preserved)

- Financial reporting uses **calendar-year YTD** via `getCalendarYtdPeriod()` in `src/server/domain/reporting.ts`.
- The `/reports` UI exposes calendar YTD and custom date ranges only.
- Phase 8 documented this behavior; Phase 10 preserves it unchanged.

### Fiscal-year support — UNRESOLVED

- **DEC-ACC-002** (Phase 1) flags fiscal-year variance as future business configuration; no fiscal-year start date or reporting rules are approved.
- Phase 0–9 specifications do not define configurable fiscal-year reporting.
- **Phase 10 action:** No fiscal-year configuration UI or schema changes. Calendar-year YTD remains the only built-in YTD period.

**Information required to resolve:** Approved fiscal-year start date per business, and whether YTD/summary reporting should switch from calendar year to fiscal year.

---

## Zero-rated / exempt classification

### Automatic service-level classification — UNRESOLVED

- Line-level `taxStatus` (taxable / zero-rated / exempt) exists on Service and Invoice Line Item entities (Phase 2).
- Phase 2 §08 and Phase 0 **UD-TAX** items require **professional confirmation** for which services qualify as zero-rated or exempt.
- No authoritative catalog of zero-rated or exempt services exists in Phase 0–9 documentation.
- The system does **not** infer tax treatment from service names.

### Current behavior — APPROVED (preserved)

- Tax status is set explicitly on draft line items (or inherited from service defaults where configured).
- Tax calculation applies configured rates to taxable lines; zero-rated and exempt lines follow existing Phase 2–3 calculation rules without automatic classification.

**Phase 10 action:** No new classification model, no automatic rules, no schema changes.

---

## Payment method vocabulary

### Controlled payment-method list — UNRESOLVED

- **UD-PAY-001** / **DEC-PAY-005**: Payment method values are not enumerated in Phase 0–1.
- `Payment.method` remains free text.

### Current behavior — APPROVED (preserved)

- Payment method is user-entered text at recording time.
- Historical payments remain immutable; corrections use reversal + new payment (Phase 1).

**Phase 10 action:** No Payment schema change, no controlled vocabulary UI.

---

## Corrected-invoice period attribution

### System reporting behavior — APPROVED (preserved)

Per **DEC-INV-008**, **DEC-ARCH-030**, and Phase 1 §04:

1. The original finalized invoice is voided and contributes **$0** to Revenue, Outstanding, and period totals.
2. A replacement invoice is created as a new Draft → Finalized invoice with a new invoice number.
3. The replacement contributes Revenue (pre-tax subtotal), sales tax, and Outstanding according to **its own invoice date** and finalization — **not** backdated to the original invoice's date.
4. Payments on the void invoice remain attached to the void invoice; the replacement begins with zero payments.

Phase 8 reporting implements this behavior. Phase 10 does not modify it.

### Professional acceptance — UNRESOLVED

- Phase 1 flags whether this period attribution matches the owner's real accounting practice as **ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED**.
- If the business requires corrected amounts in the original period, that adjustment is **outside** this system.

**Phase 10 action:** Document only; no reporting or lifecycle changes.

---

## Tax configuration administration

### Versioned per-business tax configuration — APPROVED (implemented)

Per Phase 2 §08:

- Tax configuration is stored as `TaxConfigurationVersion` records scoped to one business.
- Administrators may create new versions with `effectiveFrom`, `isGstHstRegistered`, and `taxLines` (authority, type, rate, optional `appliesTo`).
- **Immutable content:** once created, a version's substantive configuration — `effectiveFrom`, `isGstHstRegistered`, and `taxLines` — is never edited. There is no edit or delete operation. Changing tax treatment always means creating a new version.
- **Effective-period lifecycle (the one field that changes):** `effectiveTo` is `null` while a version is current. When a new version is created, the prior current version's `effectiveTo` is set once, to the day before the new `effectiveFrom` (Phase 2 §08 Section 4, rule 2). This is the only modification the system ever makes to an existing version, and it closes the period; it does not alter the version's content. The database allows at most one version per business with `effectiveTo = null`, so closing the prior version is required for a new one to be created.
- **Creating a new version:** the new `effectiveFrom` must be later than the current version's `effectiveFrom`; the resulting periods are contiguous and never overlap.
- **Effect on future finalization:** an invoice finalized on a date within a version's effective period uses that version. New versions therefore change tax only for invoices finalized on or after the new `effectiveFrom`.
- **Protection of finalized invoices:** finalized invoices keep the `InvoiceTaxLine` records, `totalTax`, `invoiceTotal`, and other financial values captured at finalization. Creating or closing a configuration version never recalculates or modifies them, and historical reporting is unchanged.
- Changes emit `TAX_CONFIGURATION_CHANGED` audit events with prior and new values when a prior version existed.

**Phase 10 action:** Administrative list/create UI and server-side domain functions only. No hard-coded Canadian rates. No automatic tax rules.

---

## Business profile administration

### Supported business fields — APPROVED (preserved from Phase 9)

- `name`, `legalName`, `address`, `gstHstRegistrationNumber`, `brandingLogoRef`
- Changes affect future invoices only; finalized snapshots remain immutable.
- Updates emit `BUSINESS_SETTINGS_CHANGED` audit events.

**Phase 10 action:** Coherent navigation from business profile to tax configuration and reporting links. No new business fields. No logo upload infrastructure.

---

## Reporting configuration

### Configurable reporting settings — UNRESOLVED

- No Phase 0–9 specification defines a separate reporting-configuration entity beyond calendar YTD and custom date ranges (Phase 8).
- Fiscal-year configuration is unresolved (see above).

**Phase 10 action:** No reporting-configuration admin UI beyond documenting calendar YTD behavior and linking to `/reports`.
