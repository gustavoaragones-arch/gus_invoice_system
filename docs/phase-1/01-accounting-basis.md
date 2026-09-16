# 01 — Accounting Basis

Status: Draft for Project Director review
Phase: 1
Resolves: Phase 0 UD-ACC-001, UD-ACC-002

## 1. Billing vs. Accounting — the Boundary

This system produces a **billing/revenue-reporting convention**, not a formal accounting or tax revenue-recognition determination. The figures it reports (e.g., "Revenue," "YTD Revenue") describe what the system billed and collected, in a way useful for the owner to run the business day-to-day. They are **not** a substitute for the revenue-recognition treatment the business's accountant applies for financial statements or tax filing purposes (which may differ — e.g., for work-in-progress, deferred revenue, or accrual adjustments the system has no visibility into). This boundary is restated wherever a revenue figure is displayed or exported (product/UX requirement carried into later phases) and must not be blurred by implementation.

**Classification: SYSTEM RULE** (the boundary statement itself) — this is a fixed product behavior, not a business-configurable value.

## 2. System Revenue Concept

**Decision (DEC-ACC-001): "Revenue" / "Invoiced Revenue" / "Sales" in this system means invoice-based billing revenue — the pre-sales-tax subtotal of Finalized, non-Void invoices, attributed to the period containing the invoice's invoice date.**

Revenue does **not** include GST/HST or other sales taxes charged on invoices. Sales taxes are separately identifiable and reported as their own figure (see [06-revenue-reporting-rules.md](06-revenue-reporting-rules.md)). Actual payment collection remains a separate, payment-based measure ("Amount Collected").

Rationale:
- The system's core artifact is the invoice; "what was billed" before sales tax is the figure most directly and unambiguously produced by the system's own data, independent of when (or whether) a client eventually pays.
- This is consistent with Phase 0's separation of "YTD Invoiced" from "YTD Amount Paid" (FR-REV-002/003) — "Revenue" aligns with the pre-tax invoiced figure, sales taxes are reported separately, and "Amount Paid"/"Amount Collected" remains a distinct, separately labeled figure (see [06-revenue-reporting-rules.md](06-revenue-reporting-rules.md)).
- It keeps revenue reporting fully traceable to finalized invoices (FR-REV-008) without depending on payment timing, which the owner does not fully control.
- It does not turn this application into a general ledger, tax-remittance accounting system, or accrual accounting platform.

**Classification: SYSTEM RULE**, explicitly labeled in-product as the system's billing/revenue reporting convention, not a GAAP/ASPE/CRA revenue-recognition determination.

**Classification: ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED** — whether this invoice-based convention is an acceptable proxy for the business's actual tax/accounting revenue reporting (e.g., for T2125/T2 purposes) is a matter for the owner's accountant to confirm; the system does not claim to answer this.

## 3. Treatment of Unpaid Invoices

An unpaid, Finalized, non-Void invoice counts in full toward "Revenue" (DEC-ACC-001) at its pre-tax subtotal in the period of its invoice date, and simultaneously counts in full toward "Outstanding Amount" (see [06-revenue-reporting-rules.md](06-revenue-reporting-rules.md)) until paid. Sales taxes charged on that invoice are reported separately and are not included in Revenue. These are not mutually exclusive — "Revenue" answers "what did I bill before sales tax," "Outstanding" answers "what haven't I collected yet." **Classification: SYSTEM RULE.**

## 4. Treatment of Partially Paid Invoices

A partially paid invoice counts at its **full pre-tax subtotal** toward Revenue (unchanged by partial payment — see Section 3), and its unpaid remainder counts toward Outstanding. The amount actually received counts toward "Amount Collected" for the period(s) in which each payment was recorded (see [06-revenue-reporting-rules.md](06-revenue-reporting-rules.md)). **Classification: SYSTEM RULE.**

## 5. Treatment of Voided Invoices

A Voided invoice contributes **$0** to Revenue and **$0** to current sales-tax invoice reporting, in every period, including if it was previously counted before being voided — voiding removes its contribution retroactively from all current reporting views (i.e., Revenue and sales-tax reporting always reflect current Void status, not a snapshot taken before voiding). It contributes **$0** to current Outstanding. It remains visible in the system as a Void record for audit purposes (see [04-finalization-and-corrections.md](04-finalization-and-corrections.md)) but is excluded from every current revenue, sales-tax, outstanding, and invoice-count metric except a dedicated void/audit view. Historical payment records attached to a void invoice remain factual and remain part of Amount Collected if they are non-reversed payments (see [05-payment-rules.md](05-payment-rules.md), Section 11). **Classification: SYSTEM RULE.**

## 6. Treatment of Corrected Invoices

A correction is implemented as Void (original) + Replacement (new invoice) — see [04-finalization-and-corrections.md](04-finalization-and-corrections.md). Following Section 5, the original contributes $0 to current Revenue, sales-tax reporting, and Outstanding. The replacement invoice counts toward Revenue at its own pre-tax subtotal and invoice date/finalization — **not backdated to the original invoice's date.** The replacement invoice does not automatically inherit payments from the void invoice; it starts with its own payment state (see [05-payment-rules.md](05-payment-rules.md), Section 11). If the business's own accounting requires the corrected amount to be attributed to the original period, that adjustment is the accountant's responsibility outside this system. **Classification: SYSTEM RULE**, with the backdating question flagged **ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED** if the owner's real accounting practice needs period-accurate correction attribution beyond what this billing tool provides.

## 7. Treatment of Historical Invoices

Once represented in the system (migration itself is out of scope for Phase 1 — see [09-historical-record-rules.md](09-historical-record-rules.md)), a historical Finalized invoice is treated identically to any other Finalized invoice for revenue purposes: it counts at its recorded pre-tax subtotal, in the period of its recorded (historical) invoice date. Sales taxes on that invoice are reported separately. **Classification: SYSTEM RULE.**

## 8. YTD Revenue Calculation

**Decision (DEC-ACC-002): YTD Revenue = the sum of DEC-ACC-001 pre-tax Revenue across all Finalized, non-Void invoices whose invoice date falls within the current calendar year to date, for the active business only.**

**Conceptual example:**

```
Pre-tax invoice subtotal: $1,000.00
GST 5%:                   $50.00
Invoice total:            $1,050.00

Revenue:       $1,000.00
Sales Tax:     $50.00
Invoice Total: $1,050.00
```

- "Calendar year" is used because Phase 0 does not establish a fiscal-year concept distinct from the calendar year, and introducing one would exceed Phase 1's mandate to resolve only what Phase 0 flagged. If the business's actual fiscal year differs from the calendar year, that is flagged below.
- Scoped strictly to one business at a time (reaffirms FR-BUS-008, NFR-ISO-001 — no cross-business YTD figure exists or may be introduced without new scope authorization).

**Classification: SYSTEM RULE** (calendar-year YTD as the default reporting period).
**Classification: BUSINESS CONFIGURATION** — if a business's fiscal year does not align with the calendar year, this is a future configuration point, not built by default in Phase 1 (no Phase 0 requirement establishes fiscal-year support; flagged as a gap only if the business needs it — see [12-phase-1-summary.md](12-phase-1-summary.md)).

## 9. Professional-Accounting Boundary — Restated

The system:
- does not perform double-entry bookkeeping, does not maintain a chart of accounts or journal entries, and does not produce financial statements (reaffirms Phase 0, [01-product-definition.md](../phase-0/01-product-definition.md) Section 9-10, [09-scope-boundary.md](../phase-0/09-scope-boundary.md)).
- computes "Revenue" using the invoice-based, pre-sales-tax convention (DEC-ACC-001) as a **billing tool's reporting figure**, not a tax or GAAP/ASPE determination.
- reports sales taxes charged on invoices as a separate figure, distinct from Revenue and from Amount Collected.
- must never present its Revenue/YTD figures as authoritative for tax filing without the accountant's review — this is a product-copy/UX requirement carried forward, not merely a documentation note.
