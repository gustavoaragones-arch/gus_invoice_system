# 06 — Revenue Reporting Rules

Status: Draft for Project Director review
Phase: 1
Resolves: remainder of Phase 0 UD-ACC-001/002, elaborates FR-REV-001 through 008

## 1. Reporting Bases — Three Distinct, Separately Labeled Figures

**Decision (DEC-ACC-003): The system reports three structurally different figures, never merged into one number:**

1. **Revenue / Invoiced Revenue / Sales (invoice-based)** — per [01-accounting-basis.md](01-accounting-basis.md) (DEC-ACC-001): the pre-sales-tax subtotal of Finalized, non-Void invoices, attributed to the invoice's own invoice date.
2. **Sales Tax (invoice-based)** — the sales tax amounts (GST/HST and applicable provincial sales taxes) charged on Finalized, non-Void invoices, attributed to the invoice's own invoice date. Sales tax is reported separately and is **not** included in Revenue.
3. **Amount Collected / Amount Paid (payment-based)** — the total of non-reversed Payments (per [05-payment-rules.md](05-payment-rules.md)), attributed to each payment's own payment date, regardless of which period the underlying invoice belongs to or whether the originally attached invoice was later voided.

These will generally disagree for any period with unpaid or partially paid invoices, or payments received for work invoiced in an earlier period — this is expected and correct, not a bug to reconcile away. **Classification: SYSTEM RULE.**

### 1.1 Authoritative Formulas

```
Revenue        = Σ pre-tax invoice subtotal for Finalized, non-Void invoices (by invoice date)
Sales Tax      = Σ applicable tax amounts on Finalized, non-Void invoices (by invoice date)
Amount Collected = Σ non-reversed recorded payments (by payment date)
Invoice Total  = Pre-Tax Subtotal + Sum of All Tax Amounts (per invoice)
```

**Conceptual example:**

```
Pre-tax invoice subtotal: $1,000.00
GST 5%:                   $50.00
Invoice total:            $1,050.00

Revenue:       $1,000.00
Sales Tax:     $50.00
Invoice Total: $1,050.00
```

Sales tax figures represent sales tax **charged/invoiced** on applicable invoices. They do not imply that invoice tax automatically equals cash tax collected. Actual payment collection remains a separate payment-based measure.

## 2. Current-Period Revenue

Revenue for a given period (e.g., "this month") = sum of pre-tax invoice-based Revenue (Section 1.1) for Finalized, non-Void invoices whose invoice date falls within that period. **Classification: SYSTEM RULE.**

## 2.1 Current-Period Sales Tax

Sales Tax for a given period = sum of applicable tax amounts on Finalized, non-Void invoices whose invoice date falls within that period. Sales tax is reported separately from Revenue and is not included in Revenue. **Classification: SYSTEM RULE.**

## 3. YTD Revenue

As defined in [01-accounting-basis.md](01-accounting-basis.md), Section 8 (DEC-ACC-002): calendar-year-to-date sum of invoice-based Revenue, business-scoped. **Classification: SYSTEM RULE**, with the fiscal-year caveat noted there carried forward as **BUSINESS CONFIGURATION** (not built by default).

## 4. Prior-Period Revenue

The same invoice-based calculation (Section 1.1/2), applied to any closed prior period the reporting view supports (e.g., last month, last year) — using the same rule, not a different one, so current and prior periods are always comparable on a like-for-like basis. **Classification: SYSTEM RULE.**

## 5. Monthly Revenue

Monthly revenue (Phase 0 FR-REV-005) = Section 2's period calculation with the period set to a calendar month. **Classification: SYSTEM RULE.**

## 6. Amount Paid (YTD and Period)

Computed per Section 1.2 (payment-based), for the requested period, using each Payment's own payment date — **not** the invoice date of the invoice it was recorded against. This means a payment received in January for a December invoice counts toward January's "Amount Collected," not December's. **Classification: SYSTEM RULE.**

## 7. Outstanding Amount

**Decision (DEC-ACC-004): Outstanding Amount is a point-in-time snapshot, not a period-bound figure: the sum of `Balance Due` (per [05-payment-rules.md](05-payment-rules.md) Section 2) across every currently Finalized, non-Void invoice for the business, regardless of which period each invoice's date falls in.** Void invoices do not contribute to current Outstanding. It answers "what is owed to me right now," not "what became overdue this month." **Classification: SYSTEM RULE.**

## 8. Revenue by Business

Every figure in this document is computed strictly within one Business's data. There is no combined, multi-business figure anywhere in the reporting surface (reaffirms Phase 0 FR-BUS-008, NFR-ISO-001, FR-REV-007) and none may be introduced without explicit new Project Director scope authorization. **Classification: SYSTEM RULE** (the isolation) / **OUT OF SCOPE** (any cross-business combined report).

## 9. Revenue by Client

Sum of invoice-based Revenue (Section 1.1) grouped by Client, within the active Business and the requested period. Uses the same Finalized/non-Void/invoice-date rule as every other revenue figure — no separate convention for client-level breakdowns. **Classification: SYSTEM RULE.**

## 10. Revenue by Service

Sum of the relevant Invoice Line Items' captured subtotals (Phase 0 FR-INV-014 — the rate/description as captured at invoicing time, not the Service catalog's current rate), grouped by the Service each line item was drawn from, within the active Business and the requested period. Line items not drawn from a catalog Service (free-text line items) are reported under an "Other/Uncategorized" grouping rather than silently omitted. **Classification: SYSTEM RULE.**

## 11. Invoice Counts

Invoice counts (Phase 0 FR-REV-006) — total, paid, unpaid, partially paid, overdue — are computed from the same Payment Status/Overdue derivation as [02-invoice-lifecycle.md](02-invoice-lifecycle.md) Section 4.1, applied across the business's Finalized, non-Void invoices. Void invoices are excluded from these counts by default but remain queryable in a dedicated void/audit view (see [04-finalization-and-corrections.md](04-finalization-and-corrections.md)). **Classification: SYSTEM RULE.**

## 12. Treatment of Voids/Corrections in Reporting — Restated

Every current reporting figure in this document already excludes Void invoices by construction (they are not "Finalized, non-Void"). Specifically:

- Voided invoices contribute **$0** to current Revenue.
- Voided invoices contribute **$0** to current Outstanding.
- Voided invoices contribute **$0** to current sales-tax invoice reporting.
- Historical payment records attached to a void invoice remain factual and remain included in Amount Collected if they are non-reversed payments (see [05-payment-rules.md](05-payment-rules.md), Section 11).

A correction's replacement invoice is counted at its own date and pre-tax subtotal, never backdated (see [01-accounting-basis.md](01-accounting-basis.md), Section 6, and [04-finalization-and-corrections.md](04-finalization-and-corrections.md), Section 5). The replacement invoice does not automatically inherit payments from the void invoice.

**Conceptual void/payment example:**

```
Original Invoice: $1,000.00 (pre-tax subtotal)
Payment:          $1,000.00 recorded against Original Invoice
Original Invoice later voided
Replacement Invoice: $1,000.00 (pre-tax subtotal), no payments attached

Result:
- Original payment remains attached to Original Invoice
- Original Invoice: excluded from current Revenue, Outstanding, and sales-tax reporting
- Replacement Invoice: independently reportable; does not inherit the payment
- Payment remains part of historical Amount Collected unless reversed
```

This is restated here because revenue reporting is the surface where a mishandled void/correction would first become visible as a wrong number — so it is a cross-document consistency point, not a new rule (see [12-phase-1-summary.md](12-phase-1-summary.md), Cross-Document Validation). **Classification: SYSTEM RULE.**
