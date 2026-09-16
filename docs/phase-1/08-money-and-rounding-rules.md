# 08 — Money and Rounding Rules

Status: Draft for Project Director review
Phase: 1
Resolves: Phase 0 UD-TAX-005 (rounding), elaborates NFR-ACC-001/003

## 1. Currency

**Decision (DEC-MONEY-001): The system's only currency is Canadian Dollars (CAD). No other currency is supported anywhere in invoicing, payments, or reporting.** Reaffirms Phase 0 [09-scope-boundary.md](../phase-0/09-scope-boundary.md) exclusion of USD accounting/multi-currency support. **Classification: SYSTEM RULE / OUT OF SCOPE** (non-CAD currencies).

## 2. Monetary Precision

**Decision (DEC-MONEY-002): All stored and displayed monetary amounts (rates, line subtotals, tax amounts, invoice totals, payments, balances) use 2 decimal places (whole cents). No sub-cent monetary value is stored or displayed anywhere in the system.** **Classification: SYSTEM RULE.**

## 3. Rounding Convention

**Decision (DEC-MONEY-003): The system uses standard arithmetic "round half up" rounding to the nearest cent (i.e., a value exactly at $X.XX5 rounds to $X.XX+1 cent), applied at each rounding point defined in [07-tax-and-pricing-rules.md](07-tax-and-pricing-rules.md) Section 4: once per line subtotal, and once per tax-group amount (where each tax group is a distinct tax type/authority + applicable rate combination).**

This is chosen as the common, easily-explainable default (as opposed to banker's rounding/round-half-to-even, which is harder for a non-accountant client to verify by hand). **Classification: SYSTEM RULE, ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED** before reliance on real filings (restated from [07-tax-and-pricing-rules.md](07-tax-and-pricing-rules.md) Section 4 — the two documents must not diverge on this point; see [12-phase-1-summary.md](12-phase-1-summary.md), Cross-Document Validation).

## 4. Rounding Points — Restated for Completeness

1. Line subtotal = quantity × unit price → rounded to the cent (line-level).
2. Tax amount per tax group = grouped taxable subtotal × applicable rate → rounded to the cent (once per distinct **tax type/authority + applicable rate** group, not per line, and not once for the entire invoice).
3. Invoice total = (already-rounded) pre-tax subtotal + (already-rounded) tax-group amounts → no further rounding needed, since every input is already cent-precise.

Each distinct tax type/authority + applicable rate combination is calculated independently and rounded once. Do not round tax only once for the entire invoice. Do not describe rounding as occurring merely "per tax type" where multiple rates may exist under the same tax authority/type.

No other rounding point exists in the standard (tax-exclusive) flow. **Classification: SYSTEM RULE.**

## 5. Quantity Precision

**Decision (DEC-MONEY-004): Quantity is stored and entered with up to 2 decimal places** (e.g., 1.50 hours), sufficient to represent common fractional-hour billing (e.g., 6-minute/0.1-hour increments). **Classification: SYSTEM RULE**, with a caveat: **Classification: BUSINESS/PROFESSIONAL CONFIRMATION** if the owner's actual practice requires finer precision (e.g., billing to the minute as a fraction smaller than 0.01 of the chosen unit) — not indicated by anything in Phase 0, so not built beyond 2 decimal places by default.

## 6. Unit Price Precision

**Decision (DEC-MONEY-005): Unit price (rate) is stored and entered with 2 decimal places (cents).** No sub-cent rate is supported (consistent with Section 2). **Classification: SYSTEM RULE.**

## 7. Negative Amounts

**Decision (DEC-MONEY-006): Ordinary invoice line items must have quantity > 0 and unit rate ≥ 0. Negative quantities and negative rates are not supported on standard line items.**

Line-item discounts (a negative-amount or percentage-off line) are **not** authorized by Phase 0 — no functional requirement in [02-functional-requirements.md](../phase-0/02-functional-requirements.md) FR-INV establishes a discount mechanism. Phase 1 therefore does **not** introduce one. **Classification: OUT OF SCOPE** (discounts/negative-amount line items), consistent with the governing prompt's Section 3 prohibition on scope expansion.

The only place a negative monetary adjustment concept exists at all in this specification is the Payment Reversal mechanism ([05-payment-rules.md](05-payment-rules.md) Section 7), which is a distinct record type (a reversal event), not a negative line item on an invoice.

## 8. Zero-Value Line Items

**Decision (DEC-MONEY-007): A line item with unit rate = $0.00 (and quantity > 0) is permitted** — e.g., a complimentary/comp item the owner wants recorded transparently on the invoice. Its line subtotal is $0.00, it participates normally in the tax-status logic of [07-tax-and-pricing-rules.md](07-tax-and-pricing-rules.md) Section 5-7 (a $0 line can still be flagged taxable/zero-rated/exempt like any other), and it is not treated as an error. **Classification: SYSTEM RULE.**

## 9. Invoice Total Calculation — Restated

`Invoice Total = Pre-Tax Invoice Subtotal (sum of rounded line subtotals) + sum of rounded tax-group amounts` — per [07-tax-and-pricing-rules.md](07-tax-and-pricing-rules.md) Section 4. Each tax group (tax type/authority + applicable rate) is calculated and rounded separately. Restated here as the authoritative money-rules summary; the two documents must remain in agreement (see [12-phase-1-summary.md](12-phase-1-summary.md)). **Classification: SYSTEM RULE.**

## 10. Discounts — Explicit Non-Decision

Discounts are not in Phase 0's authorized scope. Phase 1 does not decide *how* a discount would work, because *whether* one exists at all is not Phase 1's decision to make — introducing it here would be scope expansion, which the governing prompt for this phase explicitly prohibits. If the Project Director wants discount support, it must be authorized as a scope change before any rule for it is written. **Classification: OUT OF SCOPE.**
