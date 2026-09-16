# 06 — Invoice State and Invariants

Status: Draft for Project Director review
Phase: 2

## 1. Persisted Invoice States

Exactly three values (DEC-INV-001):

```
Draft
Finalized
Void
```

`Reviewed`, `Sent`, `Paid`, and `Overdue` are **not** persisted states. They are derived indicators.

## 2. State Definitions

| State | Invoice # | Financial Editable | Payments Allowed | Revenue | Outstanding |
|---|---|---|---|---|---|
| Draft | No | Yes | No | No | No |
| Finalized | Yes, permanent | No | Yes | Yes (pre-tax) | Yes (balance due) |
| Void | Yes, consumed | No | No new; existing remain | No | No |

## 3. Permitted Transitions

```
Draft ──────────→ Finalized     (finalization; atomic with number allocation)
Draft ──────────→ (deleted)     (only true deletion; no number consumed)
Finalized ──────→ Void          (voiding; payments remain attached)
```

## 4. Prohibited Transitions

```
Finalized → Draft              (no "unfinalize")
Void → Finalized               (void is terminal)
Void → Draft                   (void is terminal)
Draft → Void                   (drafts are deleted, not voided)
Any in-place edit of financial content on Finalized or Void
```

## 5. Atomic Finalization Invariant (DEC-INV-005)

**Invoice number allocation and Draft → Finalized transition must succeed or fail as one atomic operation.**

If finalization fails after number would have been allocated:
- No number is consumed
- Invoice remains `Draft`
- No partial finalized state exists

Implementation must use transactional semantics (mechanism is Phase 3; requirement is binding).

## 6. Finalization Capture and Immutability

At `Draft → Finalized`, the system must:

1. Capture `billedClientSnapshot` from the current Client record (or draft-selected client context).
2. Capture `billedBusinessSnapshot` from the current Business invoice-facing settings.
3. Freeze both snapshots as part of the same atomic finalization operation.
4. Use the frozen snapshots for finalized invoice rendering and historical reproduction.

Upon `Draft → Finalized`, the following become immutable:

- `billedClientSnapshot` (client identity as billed)
- `billedBusinessSnapshot` (business identity/branding as printed)
- All line item fields (description, quantity, unit price, subtotal, tax status, tax group)
- Pre-tax subtotal, tax lines, invoice total
- Invoice date, due date, payment terms
- Invoice number
- Tax configuration snapshot used

`clientId` and `businessId` remain as live relationship/isolation references. They do **not** substitute for the frozen snapshots when reproducing a finalized invoice.

Non-financial internal notes may be editable only if explicitly defined as non-invoice-facing in Phase 3.

## 7. Void Invariant (DEC-INV-007)

- Void permitted regardless of payment status
- Voided content frozen as at finalization
- Invoice number remains consumed (DEC-INV-004)
- Existing payments remain attached (DEC-PAY-006)
- Void invoice contributes $0 to Revenue, Sales Tax, Outstanding
- Void produces audit event

## 8. Void + Replacement Invariant (DEC-INV-008)

Correction of a finalized invoice:

```
1. Void original invoice
2. Create new Draft invoice linked via replacedInvoiceId / replacementInvoiceId
3. Finalize replacement (new number, own date)
```

Prohibited:
- In-place edit of finalized financial content
- Automatic payment transfer to replacement
- Renumbering or reusing void invoice number
- Backdating replacement to original period

## 9. Derived Indicators (Not States)

### Payment Status (Finalized, non-Void only)
- `Unpaid`: Amount Paid = 0
- `Partially Paid`: 0 < Amount Paid < Invoice Total
- `Paid`: Amount Paid ≥ Invoice Total
- `Overdue`: qualifier when Unpaid or Partially Paid and past due date

### Delivery Status
- Derived from `InvoiceSendAttempt` records
- `Not Sent` / `Sent` / `Send Failed`

## 10. Historical Import Exception (DEC-HIST-003)

Historical invoices may enter directly as `Finalized` via authorized import path only. Ordinary system-created invoices must pass through `Draft`.

## 11. Transition Audit Requirements

| Transition | Audit Event |
|---|---|
| Draft created | Invoice created |
| Draft → Finalized | Invoice finalized |
| Finalized → Void | Invoice voided |
| Replacement finalized | Replacement invoice created |
| Draft deleted | Optional; if audited, invoice draft deleted |
