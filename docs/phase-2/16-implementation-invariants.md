# 16 — Implementation Invariants

Status: Draft for Project Director review
Phase: 2

Definitive invariant list Phase 3 must enforce. Derived from Phase 0/1 and Phase 2 architecture.

## 1. Business Isolation

- INV-ISO-001: No business-owned financial record accessible outside its Business boundary.
- INV-ISO-002: Every query/mutation enforces businessId server-side.
- INV-ISO-003: UI business switching is not the security boundary.

## 2. Invoice Lifecycle

- INV-LIFE-001: Persisted states are exactly `Draft`, `Finalized`, `Void`.
- INV-LIFE-002: `Reviewed`, `Sent`, `Paid`, `Overdue` are never persisted invoice states.
- INV-LIFE-003: Permitted transitions: Draft→Finalized, Draft→deleted, Finalized→Void only.
- INV-LIFE-004: Draft→Void prohibited. Finalized→Draft prohibited. Void→anything prohibited.

## 3. Invoice Numbering

- INV-NUM-001: Numbers assigned only at finalization.
- INV-NUM-002: Sequential, strictly increasing, per Business.
- INV-NUM-003: Numbers never reused, including void invoices.
- INV-NUM-004: Number allocation and finalization are atomic.
- INV-NUM-005: Drafts have no invoice number.

## 4. Finalized Invoice Immutability

- INV-IMM-001: Financial fields immutable after finalization.
- INV-IMM-002: Line items immutable after parent finalization.
- INV-IMM-003: Tax snapshot immutable after finalization.
- INV-IMM-004: No in-place edit of finalized financial content.
- INV-IMM-005: `billedClientSnapshot` immutable after finalization.
- INV-IMM-006: `billedBusinessSnapshot` immutable after finalization.
- INV-IMM-007: Finalized invoice rendering uses frozen snapshots, not live Client/Business records.

## 5. Correction

- INV-CORR-001: Correction = Void original + linked Replacement.
- INV-CORR-002: Replacement gets new number, own invoice date.
- INV-CORR-003: Original remains visible as Void.
- INV-CORR-004: No automatic payment transfer on correction.

## 6. Payment Immutability

- INV-PAY-001: Payment amount and date immutable once recorded.
- INV-PAY-002: Payment method and notes correctable in place.
- INV-PAY-003: Payment belongs to exactly one Invoice, immutably.
- INV-PAY-004: Payment cannot move between invoices or businesses.

## 7. Payment Reversal

- INV-PREV-001: Amount/date correction = reversal + new Payment.
- INV-PREV-002: Original Payment preserved permanently.
- INV-PREV-003: Amount Paid excludes reversed payments.

## 8. Void/Payment Behavior

- INV-VOID-001: Void does not move, reverse, or reassign payments.
- INV-VOID-002: Payments remain attached to void invoice.
- INV-VOID-003: Void invoice excluded from Outstanding.
- INV-VOID-004: Non-reversed payments on void invoice remain in Amount Collected.

## 9. Revenue

- INV-REV-001: Revenue = pre-tax subtotal of Finalized, non-Void invoices.
- INV-REV-002: Revenue excludes sales tax.
- INV-REV-003: Revenue is not Amount Collected.
- INV-REV-004: Void invoices contribute $0 to Revenue.

## 10. Sales Tax

- INV-TAX-001: Sales tax reported separately from Revenue.
- INV-TAX-002: Sales tax = tax amounts on Finalized, non-Void invoices.
- INV-TAX-003: Invoice tax represents charged/invoiced tax, not cash tax.

## 11. Tax Calculation

- INV-TAX-004: Tax groups = taxAuthority + taxType + rate.
- INV-TAX-005: Each group calculated independently.
- INV-TAX-006: No blended tax rates.
- INV-TAX-007: Tax config changes never retroactively recalculate finalized invoices.

## 12. Rounding

- INV-RND-001: Round-half-up to nearest cent.
- INV-RND-002: Round at line subtotal.
- INV-RND-003: Round once per tax group.
- INV-RND-004: Invoice total = pre-tax subtotal + sum of rounded tax groups.

## 13. Amount Collected

- INV-COL-001: Amount Collected = non-reversed payments by payment date.
- INV-COL-002: Amount Collected is not Revenue.

## 14. Outstanding

- INV-OUT-001: Outstanding = snapshot of Balance Due on Finalized, non-Void invoices.
- INV-OUT-002: Void invoices excluded.

## 15. Historical Records

- INV-HIST-001: No separate LegacyInvoice entity.
- INV-HIST-002: Provenance: system-created | historical-import.
- INV-HIST-003: Historical tax values preserved, not recalculated.
- INV-HIST-004: Unverified fields marked explicitly, not silently defaulted.

## 16. Audit

- INV-AUD-001: 14 event types require audit records.
- INV-AUD-002: Audit events append-only, never edited/deleted.
- INV-AUD-003: Changes preserve prior values.

## 17. Calendar

- INV-CAL-001: Calendar events are not financial records.
- INV-CAL-002: Work Candidates require review before invoice use.
- INV-CAL-003: No automatic invoice from calendar event.
- INV-CAL-004: Full provenance chain preserved.

## 18. Scope Prohibitions

- INV-SCOPE-001: No general ledger.
- INV-SCOPE-002: No payment processing.
- INV-SCOPE-003: No cross-business reporting.
- INV-SCOPE-004: No discount mechanism.
- INV-SCOPE-005: CAD only.

**Total invariant IDs: 69. Unique invariant IDs: 69.**
