# 15 — Reporting and Query Model

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Conceptual query/reporting model for Phase 1 reporting figures. No general ledger. Business-scoped only.

## 2. Three Reporting Bases (DEC-ACC-003)

| Figure | Basis | Date Attribution |
|---|---|---|
| Revenue / Invoiced Revenue / Sales | Invoice-based, pre-tax | Invoice date |
| Sales Tax | Invoice-based, tax amounts | Invoice date |
| Amount Collected | Payment-based | Payment date |

Never merged into one number.

## 3. Point-in-Time Reporting

| Figure | Basis |
|---|---|
| Outstanding | Snapshot: Σ Balance Due on Finalized, non-Void invoices |

Not period-bound.

## 4. Report Definitions

### 4.1 Revenue (Period)

```
SELECT SUM(preTaxSubtotal)
FROM Invoice
WHERE status = 'Finalized'
  AND status != 'Void'  -- Void excluded
  AND businessId = :activeBusiness
  AND invoiceDate BETWEEN :periodStart AND :periodEnd
```

### 4.2 Sales Tax (Period)

```
SELECT SUM(totalTax)  -- or SUM(InvoiceTaxLine.taxAmount)
FROM Invoice
WHERE status = 'Finalized' AND not void
  AND businessId = :activeBusiness
  AND invoiceDate BETWEEN :periodStart AND :periodEnd
```

### 4.3 Amount Collected (Period)

```
SELECT SUM(Payment.amount)
FROM Payment
JOIN Invoice ON Payment.invoiceId = Invoice.id
WHERE Payment NOT reversed
  AND Invoice.businessId = :activeBusiness
  AND Payment.paymentDate BETWEEN :periodStart AND :periodEnd
```

Includes payments on later-voided invoices (DEC-PAY-006).

### 4.4 YTD Revenue

Revenue query with period = calendar year to date (DEC-ACC-002). Fiscal year: **UNRESOLVED**.

### 4.5 Outstanding

```
SELECT SUM(MAX(0, Invoice.invoiceTotal - AmountPaid(invoice)))
FROM Invoice
WHERE status = 'Finalized' AND not void
  AND businessId = :activeBusiness
```

### 4.6 Revenue by Client

Revenue query grouped by `clientId`.

### 4.7 Revenue by Service

Sum of line item subtotals grouped by captured `serviceId`, with "Other/Uncategorized" for free-text lines.

### 4.8 Invoice Counts

Count Finalized, non-Void invoices by derived Payment Status and Overdue qualifier.

## 5. Void Exclusion Rules

| Report | Void Invoice |
|---|---|
| Revenue | $0 contribution |
| Sales Tax | $0 contribution |
| Outstanding | Excluded |
| Amount Collected | Historical payments remain if non-reversed |

## 6. Derived Indicators (Query-Time)

| Indicator | Computation |
|---|---|
| Payment Status | From Amount Paid vs Invoice Total |
| Overdue | Payment Status + due date |
| Delivery Status | From InvoiceSendAttempt log |
| Overpayment | MAX(0, Amount Paid − Invoice Total) |

## 7. Prohibited Reports

- Cross-business combined revenue
- General ledger trial balance
- Tax remittance accounting
- Revenue including sales tax
- Amount Collected as Revenue substitute

## 8. Business Scope

Every query includes `businessId = :activeBusiness`. No exception.
