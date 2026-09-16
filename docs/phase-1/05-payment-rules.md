# 05 — Payment Rules

Status: Draft for Project Director review
Phase: 1
Resolves: Phase 0 UD-ACC-005, UD-PAY-001 (partially), UD-PAY-002, UD-PAY-003

## 1. Payment Lifecycle

A Payment is created by one explicit user action against exactly one **Finalized, non-Void** invoice (Phase 0 FR-PAY-001/007). A Payment is never created automatically. Once created, a Payment's **amount** and **payment date** are immutable; its **method** and **notes** may be corrected directly since they carry no financial-total consequence (see Section 6 for the distinction and Section 7 for correcting amount/date). **Classification: SYSTEM RULE.**

## 2. Authoritative Formulas

**Decision (DEC-PAY-001):**

```
Amount Paid (invoice)   = SUM(amount of all non-reversed Payments recorded against the invoice)
Balance Due (invoice)   = MAX(0, Invoice Total − Amount Paid)
Overpayment (invoice)   = MAX(0, Amount Paid − Invoice Total)
```

- `Balance Due` is floored at $0 for display purposes — it is never shown as negative.
- `Overpayment` is tracked as its own distinct figure precisely so that an excess payment is never silently absorbed into (or hidden by) the Balance Due calculation. An invoice can simultaneously show `Balance Due = $0.00` and `Overpayment = $85.00`.

**Classification: SYSTEM RULE.**

## 3. Unpaid, Partial, Full — Payment Status

Payment Status (`Unpaid` / `Partially Paid` / `Paid`) is derived directly from the formulas in Section 2, as defined in [02-invoice-lifecycle.md](02-invoice-lifecycle.md), Section 4.1. `Paid` means `Balance Due = $0` (which includes the exact-payment case and the overpayment case alike — overpayment does not produce a separate status, only the separate `Overpayment` figure). **Classification: SYSTEM RULE.**

## 4. Multiple Payments

An invoice may have any number of Payment records; `Amount Paid` (Section 2) sums all of them. There is no limit on the number of partial payments accepted toward one invoice. **Classification: SYSTEM RULE.**

## 5. Overpayment

**Decision (DEC-PAY-002): The system does not block or reject a Payment that would exceed the invoice's current Balance Due. It records the payment as entered, and the excess is reported via the `Overpayment` figure (Section 2).**

Rationale: Rejecting a real payment the client actually sent (because it happens to exceed what the system currently calculates as owed) would contradict the "accuracy before convenience" and "no silent/incorrect financial handling" principles more than accepting it and surfacing the excess clearly. Blocking real-world facts is not the same as protecting data integrity.

**What the system does NOT do with an overpayment:**
- It does not automatically apply the excess to another invoice (that would be a financial action performed silently on a *different* financial record — explicitly prohibited).
- It does not automatically refund or process anything — this system does not process payments (Phase 0 [09-scope-boundary.md](../phase-0/09-scope-boundary.md): "Payment processing" is out of scope).
- Resolution of an overpayment (refund the client, apply as a credit to a future invoice once/if that feature is ever authorized) is a manual, explicit, out-of-system process for the owner. This is a **FUTURE / DEFERRED** item if the Project Director later wants a "credit balance applied to next invoice" feature — not built in Phase 1.

**Classification: SYSTEM RULE** (accept and surface; do not auto-resolve). **Classification: OUT OF SCOPE** for any automatic credit-application or refund-processing behavior.

## 6. Payment Correction — What May Be Edited Directly

**Decision (DEC-PAY-003): Payment `method` and `notes` are correctable in place (no financial consequence). Payment `amount` and `payment date` are immutable once recorded, because they are financial facts that feed directly into Balance Due, Overpayment, and period-based revenue reporting (see [01-accounting-basis.md](01-accounting-basis.md), [06-revenue-reporting-rules.md](06-revenue-reporting-rules.md)) — silently changing either would retroactively and invisibly alter reported historical figures.**

**Classification: SYSTEM RULE.**

## 7. Payment Reversal — The Correction Mechanism for Amount/Date

**Decision (DEC-PAY-004): To correct a Payment's amount or date, the user reverses the original Payment and records a new, corrected Payment. A Reversal is its own record, linked to the original Payment, not a deletion or in-place edit of it.**

- The original Payment record is retained, unmodified, permanently, for audit.
- A Reversal event records: which Payment it reverses, when, and (recommended) why.
- `Amount Paid` (Section 2) excludes any Payment that has been reversed — this is what "non-reversed" means in the Section 2 formula.
- A corrected Payment (the new record made after reversal) is an ordinary new Payment, subject to all the same rules.
- No Payment amount is ever deleted from the system's history — reversal is additive (it adds an offsetting record), not subtractive of the original.

**Classification: SYSTEM RULE.**

## 8. No Payment Processing

This system **records** that a payment occurred; it does not initiate, process, or capture the payment itself (no card/bank rail integration, no Stripe-style processing — reaffirms Phase 0 [09-scope-boundary.md](../phase-0/09-scope-boundary.md)). All payment-method values (see [11-accounting-decision-register.md](11-accounting-decision-register.md) for the classification of the allowed-methods list) describe how the client already paid, recorded after the fact by the owner. **Classification: OUT OF SCOPE** (payment processing itself).

## 9. Allowed Payment Methods

Phase 0 (UD-PAY-001) leaves the exact set of payment methods undefined pending the owner's real-world usage. Phase 1 does not invent a business-specific list. **Classification: BUSINESS CONFIGURATION** — the method field must be free-form-capable or configurably-enumerable (an architecture decision), but the actual set of values (e-transfer, cheque, etc.) is supplied by the owner, not fixed here.

## 10. Payments and Business Isolation

A Payment belongs to exactly one invoice and, transitively, exactly one Business. A Payment's invoice association is itself immutable (Section 1/6) — a Payment can never be moved from one invoice to another, and therefore never from one Business to another. **Classification: SYSTEM RULE**, reaffirming Phase 0 SEC-ISO-001.

## 11. Payments and Voided Invoices

**Decision (DEC-PAY-006): When an invoice is voided, existing payments remain attached to the original invoice. No automatic payment movement, reassignment, or reversal occurs.**

### 11.1 No Automatic Payment Movement

When an invoice is voided:

- existing payments are **not** automatically moved;
- existing payments are **not** automatically reassigned to the replacement invoice;
- existing payments are **not** automatically reversed;
- the payment remains historically attached to the original invoice.

**Classification: SYSTEM RULE.**

### 11.2 Payment History Remains Factual

The system must preserve the fact that the payment was originally recorded against the original invoice. The invoice being void does not rewrite the historical payment record. **Classification: SYSTEM RULE.**

### 11.3 Replacement Invoices Do Not Inherit Payments Automatically

A replacement invoice created under the Void + Replacement correction model starts with its own payment state. Payments from the void invoice are not silently transferred to the replacement invoice. If users need to understand the correction chain, the relationship must be visible through the existing Void + Replacement linkage and audit history. **Classification: SYSTEM RULE.**

### 11.4 Amount Collected Reporting

**Amount Collected** represents actual non-reversed payments recorded in the system by payment date, **regardless of whether the originally attached invoice was later voided.** This is a historical cash/payment reporting figure. It must not be presented as equivalent to current outstanding receivables or current valid invoiced Revenue. **Classification: SYSTEM RULE.**

### 11.5 Void Invoice Payment Status

A void invoice is no longer an active receivable regardless of its historical payment records. Its historical payment information remains visible for audit/history, but the void invoice must not contribute to current Outstanding. No new persisted invoice status is created for this behavior — it is derived from the existing Void state. **Classification: SYSTEM RULE.**

### 11.6 Outstanding

**Outstanding = balance due from finalized, non-void invoices only.** A void invoice does not contribute to current Outstanding. Its historical payment information remains available for audit and historical review. **Classification: SYSTEM RULE.**

### 11.7 Replacement Reporting

The replacement invoice is independently reportable according to its own invoice date and finalized status. The replacement invoice is not combined with the void invoice as one invoice for Revenue reporting. The original invoice's payment history is not transferred into the replacement invoice. **Classification: SYSTEM RULE.**

### 11.8 Conceptual Example

```
Original Invoice: $1,000.00 (pre-tax subtotal)
Payment:          $1,000.00 recorded against Original Invoice
Original Invoice later voided
Replacement Invoice: $1,000.00 (pre-tax subtotal), no payments attached

Result:
- Original payment remains attached to Original Invoice (historical fact preserved)
- Original Invoice: excluded from current Revenue, Outstanding, and sales-tax reporting
- Replacement Invoice: independently reportable; does not inherit the payment
- Payment remains part of historical Amount Collected (non-reversed)
```
