# 07 — Financial Calculation Model

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Precise computational model translating Phase 1 formulas. No alternate formulas.

## 2. Line Subtotal

```
Line Subtotal = Quantity × Unit Price
```

Rounded to nearest cent (round-half-up) at line level (DEC-MONEY-003).

## 3. Pre-Tax Invoice Subtotal

```
Pre-Tax Subtotal = Σ (rounded line subtotals)
```

## 4. Tax Group

Each distinct combination of **`taxAuthority + taxType + rate`** is one tax group.

The conceptual `taxGroupKey` must identify all three components and must agree with:

```
InvoiceTaxLine.taxAuthority
InvoiceTaxLine.taxType
InvoiceTaxLine.rate
```

Examples:
```
CRA + GST + 5%     = Group 1
BC + PST + 7%      = Group 2
CRA + GST + 5%     = Group 1
CRA + GST + 10%    = Group 2  (separate from Group 1)
```

Do not reduce group identity to `taxAuthority + rate` alone. Do not blend rates. Do not calculate a single blended tax rate.

## 5. Tax Group Amount

For each tax group:

```
Group Taxable Subtotal = Σ line subtotals of lines assigned to this group
Tax Group Amount = Group Taxable Subtotal × Applicable Rate
```

Rounded once per group (round-half-up).

## 6. Total Tax

```
Total Tax = Σ (rounded tax group amounts)
```

## 7. Invoice Total

```
Invoice Total = Pre-Tax Subtotal + Total Tax
```

No further rounding — all inputs already cent-precise.

## 8. Conceptual Example

```
Line 1: 10 × $100.00 = $1,000.00
Pre-Tax Subtotal: $1,000.00

Tax Group: GST 5%
Tax Amount: $1,000.00 × 0.05 = $50.00

Invoice Total: $1,050.00

Revenue:       $1,000.00
Sales Tax:     $50.00
Invoice Total: $1,050.00
```

## 9. Mixed Tax Group Example

```
Line A (GST taxable): $500.00
Line B (PST taxable): $300.00

Tax Group 1: GST 5% on $500.00 = $25.00
Tax Group 2: PST 7% on $300.00 = $21.00

Total Tax: $46.00
Invoice Total: $800.00 + $46.00 = $846.00
```

## 10. Revenue (DEC-ACC-001)

```
Revenue = Σ pre-tax subtotal for Finalized, non-Void invoices
```

Attributed by invoice date. Excludes sales tax.

## 11. Sales Tax (DEC-TAX-003)

```
Sales Tax = Σ applicable tax amounts on Finalized, non-Void invoices
```

Attributed by invoice date. Separate from Revenue. Represents tax charged/invoiced, not cash tax collected.

## 12. Amount Collected (DEC-ACC-003)

```
Amount Collected = Σ non-reversed recorded Payments
```

Attributed by payment date. Includes payments on later-voided invoices (DEC-PAY-006).

## 13. Outstanding (DEC-ACC-004)

```
Amount Paid (invoice) = Σ amount of non-reversed Payments on invoice
Balance Due (invoice)  = MAX(0, Invoice Total − Amount Paid)
Overpayment (invoice)  = MAX(0, Amount Paid − Invoice Total)

Outstanding = Σ Balance Due across Finalized, non-Void invoices
```

Point-in-time snapshot. Void invoices excluded.

## 14. Payment Reversal Effect

When a Payment is reversed:
- Original Payment record preserved
- PaymentReversal record created
- Amount Paid excludes reversed payment
- Amount Collected excludes reversed payment

## 15. Void Effect on Reporting

| Metric | Void Invoice Contribution |
|---|---|
| Revenue | $0 |
| Sales Tax | $0 |
| Outstanding | $0 |
| Amount Collected | Historical payments remain if non-reversed |

## 16. Calculation Sequence (Binding)

```
1. Line subtotal = quantity × unit price; round
2. Sum line subtotals → pre-tax subtotal
3. Assign each taxable line to tax group (taxAuthority + taxType + rate)
4. For each group: taxable subtotal × rate; round once
5. Sum tax groups → total tax
6. Invoice total = pre-tax subtotal + total tax
```

Frozen at finalization. Never recalculated for finalized invoices.

## 17. Finalization Freeze (Architectural — Not a New Calculation)

Finalization freezes, in one atomic operation:

- invoice financial values (line subtotals, pre-tax subtotal, tax lines, invoice total);
- tax snapshot (`InvoiceTaxLine` records);
- `billedClientSnapshot`;
- `billedBusinessSnapshot`.

This section does not alter the financial formulas above. It records that finalized invoice reproduction must not depend on later changes to mutable Client, Business, Service, or tax configuration records.
