# 07 — Tax and Pricing Rules

Status: Draft for Project Director review
Phase: 1
Resolves: Phase 0 UD-TAX-003, UD-TAX-006 (structurally); elaborates FR-INV-007, CFG-TAX-001 through 006

## 0. Scope Reminder

This document defines **how the system behaves once valid, business-specific tax configuration has been supplied** (registration status, applicable rate(s), place-of-supply facts). It does **not** determine, assume, or default whether Business A or Business B is GST/HST-registered, which province governs their supplies, or whether any specific service is taxable, zero-rated, or exempt. Every such fact remains **BUSINESS CONFIGURATION** or **ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED**, per Phase 0 [04-canadian-billing-and-tax-audit.md](../phase-0/04-canadian-billing-and-tax-audit.md), and Phase 1 does not convert any of that uncertainty into a default.

## 1. Tax-Exclusive vs. Tax-Inclusive Pricing

**Decision (DEC-TAX-001): Line-item rates are entered and stored tax-exclusive by default. Tax is calculated as an explicit, separately displayed amount added on top of the subtotal.**

Rationale:
- Matches standard Canadian B2B invoicing convention.
- Directly produces the "indication of the total tax charged" CRA documentation requirement (Phase 0 [04-canadian-billing-and-tax-audit.md](../phase-0/04-canadian-billing-and-tax-audit.md) Section 1.4) without having to back-calculate tax out of an inclusive price.
- Keeps the calculation sequence (Section 4) simple and reconcilable line-by-line for the client reading the invoice.

Tax-inclusive entry/quoting (where the user types a client-facing all-in price and the system derives the pre-tax rate) is **not** built by default. **Classification: SYSTEM RULE** (tax-exclusive default). **Classification: FUTURE / DEFERRED** — a tax-inclusive entry mode, if ever requested, is a distinct feature requiring its own rule set (see Section 4.6 for the back-calculation formula, provided for completeness but not activated by default).

## 2. GST/HST Representation

- GST/HST appears as its own, separately labeled line on the invoice (e.g., "GST/HST (13%): $X.XX"), computed per Section 4.
- If the business is configured as **not** GST/HST-registered, no GST/HST line appears at all — the invoice must not show a $0.00 GST/HST line, which would misleadingly imply registration. The absence must be a structural omission, not a zeroed field.
- The registration status and the applicable rate are **BUSINESS CONFIGURATION**, populated per business (Phase 0 CFG-TAX-001/002), never inferred or defaulted by the software.

**Classification: SYSTEM RULE** (display/omission behavior). **Classification: BUSINESS CONFIGURATION** (the underlying registration/rate facts).

## 3. Separate Provincial Tax (PST/RST/QST)

- Where configured, provincial sales tax (BC/SK/MB PST-RST, Quebec QST) appears as its **own** separate line, distinct from GST/HST — never merged into a single blended "tax" figure, since they are different taxing authorities with independent audit trails (Phase 0 [04-canadian-billing-and-tax-audit.md](../phase-0/04-canadian-billing-and-tax-audit.md) Section 1.3).
- Whether either business has any such obligation is **ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED**, per Phase 0 Section 4 of the same document (provincial tax authorities, not CRA, govern this).

**Classification: SYSTEM RULE** (separate-line display). **Classification: BUSINESS CONFIGURATION + PROFESSIONAL CONFIRMATION REQUIRED** (whether it applies, and at what rate).

## 4. Tax Calculation Sequence

**Decision (DEC-TAX-002): The system calculates tax in the following fixed sequence:**

1. **Line subtotal**: `line subtotal = quantity × unit price`, rounded to the nearest cent at the **line level** (see [08-money-and-rounding-rules.md](08-money-and-rounding-rules.md) for the rounding convention).
2. **Pre-tax invoice subtotal**: sum of all (already-rounded) line subtotals.
3. **Tax group determination**: each taxable line is assigned to exactly one **tax group**, defined as a unique combination of **tax type/authority + applicable rate**. Separate groups are required when either the tax authority/type or the rate differs. Zero-rated and exempt lines (Sections 5-6) are excluded from the taxable base for the relevant tax group.
4. **Tax group calculation**: for each distinct tax group, `tax amount = group taxable subtotal × applicable rate`, rounded to the nearest cent **once per tax group**, not per line.
5. **Total tax**: sum of all (already-rounded) tax-group amounts.
6. **Invoice total**: `pre-tax invoice subtotal + total tax`.

**Tax group definition:** A tax group is one unique combination of tax type or taxing authority and applicable tax rate. For example:

```
GST 5%  = one tax group
PST 7%  = another tax group
```

If the same tax type has two different rates on the same invoice, those are separate groups:

```
Tax Type A at 5%  = Group 1
Tax Type A at 10% = Group 2
```

Do not blend different rates into a single calculation group. Do not calculate a single blended tax rate.

**Required calculation sequence (summary):**

```
1. Line subtotal = quantity × unit price.
2. Round line subtotal according to the established money/rounding rule.
3. Sum line subtotals to obtain the pre-tax invoice subtotal.
4. Determine the tax group for each taxable line.
5. Group taxable line subtotals by tax type/authority + applicable rate.
6. For each tax group:
   tax amount = group taxable subtotal × applicable rate.
7. Round each tax-group tax amount once.
8. Sum all tax-group tax amounts.
9. Invoice total = pre-tax invoice subtotal + total tax.
```

Rationale for line-level rounding before tax, and one rounding per tax group rather than per line: this produces a result a client can reconcile by re-multiplying the printed quantity × rate for each line (matches what's printed), while keeping the tax section compact (one number per tax group, consistent with the "compact financial tables" UX principle) rather than showing a rounded tax fragment per line. **Classification: SYSTEM RULE.**

**Classification: ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED** — this sequence and rounding point should be confirmed against the business's accountant's preferred convention before being relied on for real filings; it is a defensible, common default, not a value invented arbitrarily, but Phase 1 does not have authority to declare it CRA-mandated.

## 5. Zero-Rated Supplies

A line item (or, more precisely, the Service it is drawn from) may be flagged `zero-rated` — 0% GST/HST applies, but the supply is still technically taxable (distinct from exempt, Section 6) for ITC-eligibility purposes on the business's own purchases. A zero-rated line is excluded from the taxable base in Section 4 Step 3, and the invoice displays it as taxed at 0%, not silently omitted from the tax logic. **Which services, if any, qualify as zero-rated is ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED**, configured at the Service-catalog level (BUSINESS CONFIGURATION) once confirmed.

## 6. Exempt Supplies

A line item/Service may instead be flagged `exempt` — no GST/HST applies, and the supply is outside the GST/HST system entirely (a structurally different status from zero-rated). An exempt line displays a clear "Exempt" label rather than "$0.00 GST/HST," to avoid ambiguity for the client's own bookkeeping. **Which services, if any, qualify as exempt is ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED**, configured at the Service-catalog level (BUSINESS CONFIGURATION) once confirmed.

## 7. Mixed-Tax Invoices

An invoice may contain a mix of standard-taxable, zero-rated, and/or exempt line items in the same document. Each line item individually carries its own tax-status flag; the invoice groups and totals tax per Section 4, and — per the CRA documentary requirement to indicate the status of each supply (Phase 0 [04-canadian-billing-and-tax-audit.md](../phase-0/04-canadian-billing-and-tax-audit.md) Section 1.4) — each line's tax status must be visibly indicated on the invoice (e.g., a status marker/column), not left implicit. **Classification: SYSTEM RULE.**

## 8. Tax Configuration Effective-Dating

Per Phase 0 CFG-TAX-005: a change to a business's tax configuration (rate change, registration status change) takes effect only for invoices finalized after the change and never retroactively recalculates an already-Finalized invoice's tax. This is restated here as a hard constraint on Section 4's calculation: the calculation always uses the tax configuration in force at the moment of finalization, captured and frozen into the invoice at that time (per [04-finalization-and-corrections.md](04-finalization-and-corrections.md), Section 2). **Classification: SYSTEM RULE.**

## 9. Tax Configuration Boundaries — Summary

| Item | Classification |
|---|---|
| GST/HST registration status per business | BUSINESS CONFIGURATION |
| Applicable GST/HST rate/place of supply | BUSINESS CONFIGURATION |
| PST/RST/QST applicability and rate | BUSINESS CONFIGURATION + PROFESSIONAL CONFIRMATION REQUIRED |
| Which services are zero-rated | PROFESSIONAL CONFIRMATION REQUIRED, then BUSINESS CONFIGURATION |
| Which services are exempt | PROFESSIONAL CONFIRMATION REQUIRED, then BUSINESS CONFIGURATION |
| Tax-exclusive default entry mode | SYSTEM RULE |
| Tax group definition (tax type/authority + applicable rate) | SYSTEM RULE |
| Calculation sequence and rounding point | SYSTEM RULE, PROFESSIONAL CONFIRMATION REQUIRED before real use |
| Separate display of GST/HST vs. PST/QST | SYSTEM RULE |
| Mixed-tax per-line status indication | SYSTEM RULE |
| Effective-dating of configuration changes | SYSTEM RULE |

No item above assigns an actual tax status to Business A or Business B. That determination remains outside Phase 1's authority, per the governing prompt's Section 6/15.
