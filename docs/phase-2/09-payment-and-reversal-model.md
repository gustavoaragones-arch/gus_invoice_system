# 09 — Payment and Reversal Model

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Define Payment and PaymentReversal entities and void-interaction invariants.

## 2. Payment Entity

| Rule | Specification |
|---|---|
| Creation | Explicit user action only |
| Parent | Exactly one Invoice (immutable) |
| Eligible invoice | Finalized, non-Void at time of recording |
| Immutable fields | amount, paymentDate, invoiceId |
| Mutable fields | method, notes |
| Business scope | Via invoice → businessId |

## 3. Authoritative Formulas (DEC-PAY-001)

```
Amount Paid (invoice) = Σ amount of non-reversed Payments on invoice
Balance Due (invoice)  = MAX(0, Invoice Total − Amount Paid)
Overpayment (invoice)  = MAX(0, Amount Paid − Invoice Total)
```

## 4. Payment Reversal (DEC-PAY-004)

Correction of amount or date:

```
1. Create PaymentReversal linked to original Payment
2. Original Payment preserved unmodified
3. Record new corrected Payment (ordinary new Payment)
4. Amount Paid excludes reversed payments
```

Reversal is additive, not subtractive of history.

## 5. Overpayment (DEC-PAY-002)

- Payments exceeding Balance Due are accepted
- Excess shown as Overpayment
- No automatic application to other invoices
- No automatic refund processing

## 6. Payment Cannot Move

Architecture invariant:

- Payment.invoiceId is immutable
- Payment cannot be reassigned to another invoice
- Payment cannot move between businesses (transitive via invoice)

## 7. Void Invoice Payment Behavior (DEC-PAY-006)

When invoice is voided:

| Rule | Behavior |
|---|---|
| Existing payments | Remain attached to original invoice |
| Automatic movement | Prohibited |
| Automatic reversal | Prohibited |
| Automatic transfer to replacement | Prohibited |
| Amount Collected | Non-reversed payments remain included |
| Outstanding | Void invoice excluded |
| Payment display on void invoice | Historical info visible; not active receivable |

### Conceptual Example

```
Original Invoice: $1,000.00 pre-tax (+ tax → invoice total)
Payment: $1,050.00 recorded
Original Invoice voided
Replacement Invoice: $1,000.00 pre-tax, no payments

Result:
- Payment remains on Original Invoice
- Original excluded from Revenue, Outstanding
- Replacement independently reportable
- Payment in Amount Collected unless reversed
```

## 8. Replacement Invoice Payment State

Replacement invoice starts with zero payments. User must explicitly record new payments if applicable.

## 9. Multiple Payments

Unlimited partial payments per invoice. Amount Paid sums all non-reversed.

## 10. Audit Events

| Action | Event |
|---|---|
| Payment recorded | Payment recorded |
| Payment reversed | Payment reversed |
| Method/notes corrected | Payment method/note corrected |
