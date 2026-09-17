# Phase 8 — Financial Reporting & Revenue Intelligence

## 1. Objective

Provide focused financial reporting and visibility over existing billing and payment data for a single authorized Business.

Phase 8 answers:

1. How much billing revenue has been generated?
2. How much has been collected?
3. How much remains outstanding?
4. Which invoices and payments contribute to those totals?
5. What has happened calendar year-to-date?
6. What happened over a selected reporting period?

This phase is descriptive reporting only. It is not a general ledger, tax filing system, or forecasting engine.

## 2. Reporting Definitions

The reporting layer uses the approved Phase 1 definitions exactly:

```text
Finalized non-void invoices
        ↓
Revenue

Non-reversed payments
        ↓
Amount Collected

Current balances on finalized non-void invoices
        ↓
Outstanding
```

## 3. Revenue

Revenue is the pre-tax subtotal of finalized, non-void invoices, attributed by `invoice.invoiceDate`.

- GST/HST and other sales taxes are excluded
- Payments do not determine Revenue
- Draft invoices do not contribute
- Void invoices do not contribute

## 4. Amount Collected

Amount Collected is the total of non-reversed payments, attributed by `payment.paymentDate`.

- Reversed payments are excluded
- Payments on later-voided invoices remain in Amount Collected
- Payment history is not deleted or transferred

## 5. Outstanding

Outstanding is the current sum of Balance Due across finalized, non-void invoices.

- It is a point-in-time snapshot
- It is not restricted to the selected reporting period
- Paid invoices contribute zero and are excluded from the positive outstanding list
- Overpayments are surfaced separately

## 6. Calendar YTD Definition

Calendar YTD means:

```text
January 1 of the current calendar year through today
```

The UI labels this explicitly as **Calendar YTD**.

Fiscal-year reporting remains unresolved and is not implemented.

## 7. Custom Period Behavior

Custom periods are inclusive on both `startDate` and `endDate`.

- Revenue uses invoice date
- Amount Collected uses payment date
- Outstanding remains current-state regardless of period selection

## 8. Date-Basis Rules

| Metric | Date basis | Scope |
|---|---|---|
| Revenue | `invoice.invoiceDate` | Finalized, non-void invoices in period |
| Sales tax | `invoice.invoiceDate` | Finalized, non-void invoices in period |
| Amount Collected | `payment.paymentDate` | Non-reversed payments in period |
| Outstanding | Current state | Finalized, non-void invoices |

## 9. Monthly Aggregation

- Monthly Revenue groups finalized non-void invoice pre-tax subtotals by calendar month of invoice date
- Monthly Amount Collected groups non-reversed payments by calendar month of payment date
- Sales tax is excluded from Revenue
- No fiscal months or forecasting are introduced

## 10. Tax Separation

Sales tax is reported separately from Revenue.

The reporting layer does not:

- prepare GST/HST returns
- calculate CRA remittances
- determine tax liability

## 11. Void Handling

Void invoices do not contribute to Revenue or Outstanding.

Their attached non-reversed payments remain in Amount Collected according to the approved Phase 1 rule.

## 12. Payment Reversal Handling

Amount Collected excludes reversed payment amounts without deleting or mutating the original payment record.

## 13. Historical Invoice Handling

Valid historical imported invoices that are finalized and non-void are valid reporting inputs.

Provenance markers are preserved and do not block reporting.

## 14. Replacement Invoice Handling

A void original does not contribute Revenue.

A replacement finalized invoice contributes Revenue according to its own invoice date.

No special reporting rule moves replacement revenue into the original invoice period.

## 15. Snapshot Usage

Reporting detail uses frozen billed client snapshots for historical presentation.

Live Client records are not used to rewrite finalized invoice presentation.

## 16. Business Isolation

All reporting is strictly Business-scoped.

- Server-side business authorization is required
- RLS remains active through `withAuthorizedTransaction`
- Browser-supplied business IDs are not trusted

## 17. Reporting UI

Route: `/reports`

The reporting screen includes:

- Calendar YTD and custom date-range controls
- Summary metrics for Revenue, Amount Collected, Outstanding, and Sales Tax
- Monthly activity table
- Revenue invoice detail
- Collection payment detail
- Outstanding balance detail
- Overpayment detail when applicable

## 18. Server-Side Calculation Authority

All report calculations happen server-side in:

- `src/server/domain/reporting.ts`
- `src/server/application/reporting.ts`

The browser only selects periods and renders authoritative server results.

## 19. Performance Approach

Reporting uses database queries with Prisma and PostgreSQL decimal values.

Totals are aggregated server-side. The UI does not load all financial records to compute totals in the browser.

## 20. Tests

Phase 8 adds `tests/application/phase8Workflow.test.ts` covering:

- Revenue inclusion/exclusion rules
- Collection and reversal behavior
- Outstanding and overpayment behavior
- Calendar YTD boundaries
- Custom period boundaries and date bases
- Monthly aggregation
- Replacement invoice behavior
- Historical invoice reporting
- Business isolation
- Read-only reporting safety

## 21. Validation

Required validation commands:

```bash
npx tsc --noEmit
npx vitest run --config vitest.config.ts
npx vitest run --config vitest.integration.config.ts
npx next build
```

## 22. Unresolved Fiscal-Year Question

Fiscal-year versus calendar-year reporting remains unresolved.

Phase 8 implements calendar YTD only and does not introduce configurable fiscal years.

## 23. Known Limitations

- No CSV, Excel, or PDF export
- No revenue by client or service breakdown in this phase
- No invoice-count-by-status dashboard beyond period summary counts
- No fiscal-year reporting
- No tax filing or remittance calculations
- No forecasting or predictive analytics

## 24. No General Ledger

Phase 8 does not implement:

- chart of accounts
- journal entries
- trial balance
- balance sheet
- formal ASPE/GAAP income statement
- accounts receivable ledger

## 25. No Tax Filing Functionality

Phase 8 does not implement GST/HST return preparation, PST return preparation, CRA remittance, or tax reconciliation.

## 26. Accounting Rule Confirmation

Phase 8 consumes existing accounting rules and does not redefine:

- Revenue
- Amount Collected
- Outstanding
- invoice lifecycle
- payment rules
- payment reversal
- tax calculation
- finalized immutability
- snapshots

> The reporting Revenue metric is the project's approved operational billing-revenue definition and is not a formal ASPE/GAAP financial-statement income statement.
