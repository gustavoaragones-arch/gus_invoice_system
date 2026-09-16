# 02 — Invoice Lifecycle

Status: Draft for Project Director review
Phase: 1
Resolves: Phase 0 UD-LIFE-001, UD-LIFE-002, UD-LIFE-003

## 1. Design Principle

The invoice lifecycle is kept to the **minimum persisted state set** necessary to govern structural behavior (what is editable, what is immutable, what exists). Conditions that are simply *facts derivable from other records at query time* (payment progress, overdue-ness, send history) are **not** separate lifecycle states — they are derived indicators layered on top of the lifecycle state. This keeps the core state machine small, unambiguous, and free of the risk of two indicators (e.g., a stored "Overdue" flag and a computed one) silently disagreeing.

## 2. Persisted Invoice Status (the Lifecycle State)

**Decision (DEC-INV-001): The invoice's persisted lifecycle status has exactly three values: `Draft`, `Finalized`, `Void`.**

- `Reviewed` is **not** an invoice lifecycle state (resolves UD-LIFE-002). Review is a property of Candidate Work items in the Calendar-assisted workflow (Phase 0, [05-data-requirements.md](../phase-0/05-data-requirements.md), Candidate Work entity) — it governs whether a piece of evidence may become a line item, not any state of the invoice itself. An invoice that includes calendar-derived line items simply moves through Draft → Finalized like any other invoice, once its line items (whatever their origin) have been assembled.
- `Overdue` is **not** an invoice lifecycle state (resolves UD-LIFE-003). It is a derived condition: a Finalized, non-Void invoice with an outstanding balance whose due date has passed. See Section 4.
- `Sent`, `Partially Paid`, and `Paid` are **not** separate lifecycle states — they are derived indicators (Delivery Status and Payment Status, Section 4) computed from a Finalized invoice's send history and payment records, respectively.

**Classification: SYSTEM RULE.**

## 3. State Definitions and Transition Table

| State | Meaning | Invoice # exists | Line items/financial values mutable | Tax values mutable | Payments may exist | Contributes to revenue reporting | Audit event required |
|---|---|---|---|---|---|---|---|
| `Draft` | Being assembled/edited; not yet a financial record | No (assigned only at finalization — see [03-invoice-numbering.md](03-invoice-numbering.md)) | Yes, freely | Yes, freely (recalculated live from current config) | No (FR-PAY-007) | No | Yes, on creation |
| `Finalized` | The authoritative, issued financial record | Yes, permanently assigned | No — immutable except via the correction mechanism ([04-finalization-and-corrections.md](04-finalization-and-corrections.md)) | No — same immutability as other financial values | Yes | Yes (per [01-accounting-basis.md](01-accounting-basis.md)) | Yes, on finalization |
| `Void` | Cancelled/superseded; retained for audit, not an active obligation | Yes — number remains permanently consumed, never reused ([03-invoice-numbering.md](03-invoice-numbering.md)) | No — the voided invoice's historical content is frozen exactly as it was at voiding | No | Payments already recorded remain attached (historical record); no new payments may be recorded | No — contributes $0 ([01-accounting-basis.md](01-accounting-basis.md) Section 5) | Yes, on voiding |

## 4. Derived Indicators (Not Persisted Lifecycle States)

### 4.1 Payment Status
Computed for any Finalized, non-Void invoice from its payment records (see [05-payment-rules.md](05-payment-rules.md) for the balance formula):
- `Unpaid` — Amount Paid = $0.
- `Partially Paid` — $0 < Amount Paid < Invoice Total.
- `Paid` — Amount Paid ≥ Invoice Total (see [05-payment-rules.md](05-payment-rules.md) for overpayment handling at the boundary).
- `Overdue` — a qualifier, not a fourth exclusive value: applies whenever Payment Status is `Unpaid` or `Partially Paid` **and** the current date is after the invoice's due date. An invoice can therefore be reported as, e.g., "Partially Paid, Overdue."

Draft and Void invoices have no Payment Status (the concept does not apply).

**Classification: SYSTEM RULE** — Payment Status and the Overdue qualifier are always computed at query/display time from the invoice total, due date, and current, non-reversed payment records; never separately stored as an independent flag that could drift out of sync.

### 4.2 Delivery Status
Computed/tracked from the invoice's send attempts (Phase 0 FR-DEL-005):
- `Not Sent` — no send attempt has been made.
- `Sent` — at least one send attempt succeeded.
- `Send Failed` — the most recent send attempt failed and no later attempt succeeded.

Delivery Status is tracked from send-attempt records (an audit-style log, see [10-auditability-rules.md](10-auditability-rules.md)), not a single mutable flag, so that a failed-then-retried-successfully sequence is fully reconstructable. **Classification: SYSTEM RULE.**

## 5. Permitted and Prohibited Transitions

**Permitted:**
- `Draft → Finalized` — user-initiated finalization action; requires the invoice to pass finalization validation (Phase 0 FR-INV-013; see [04-finalization-and-corrections.md](04-finalization-and-corrections.md)). Assigns the invoice number.
- `Draft → (deleted)` — a Draft that is never finalized may be deleted outright; since it never became a financial record and never consumed an invoice number, deletion has no numbering or revenue impact. This is the only lifecycle exit that is a true deletion rather than a state transition.
- `Finalized → Void` — user-initiated voiding action, permitted regardless of Payment Status (see [04-finalization-and-corrections.md](04-finalization-and-corrections.md) for payment-handling detail and the correction/replacement mechanism built on top of this transition).

**Prohibited:**
- `Finalized → Draft` — a finalized invoice can never revert to Draft. There is no "unfinalize."
- `Void → Finalized` or `Void → Draft` — voiding is terminal; a voided invoice cannot be reactivated. Correcting a voided-in-error situation requires the controlled correction process, not a reversal of the Void state itself ([04-finalization-and-corrections.md](04-finalization-and-corrections.md)).
- `Draft → Void` — a Draft is not yet a financial record; it is deleted, not voided (voiding is a concept that only applies to something that was finalized).
- Any direct in-place edit of financial content (line items, quantities, rates, tax, totals, invoice number, invoice date) on a `Finalized` or `Void` invoice.

## 6. Audit Requirement Summary

Every transition in Section 5 marked "Permitted," and Draft creation, requires an audit event per [10-auditability-rules.md](10-auditability-rules.md). Derived indicators (Section 4) do not themselves generate audit events, since they are recomputed from already-audited underlying facts (payments, send attempts).

**Classification: SYSTEM RULE** for the entire state machine defined in this document.
