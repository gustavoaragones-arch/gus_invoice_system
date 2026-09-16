# 04 — Finalization and Corrections

Status: Draft for Project Director review
Phase: 1
Resolves: Phase 0 UD-ACC-003, UD-ACC-004, UD-LIFE-005, FR-INV-011

## 1. What Happens at Finalization

**Decision (DEC-INV-006): Finalization is the single event that converts a Draft into a permanent financial record. At the moment of finalization, the system:**
1. Validates the invoice (Phase 0 FR-INV-013: valid line items, a non-ambiguous total, business tax configuration present — see [07-tax-and-pricing-rules.md](07-tax-and-pricing-rules.md)).
2. Assigns the invoice number ([03-invoice-numbering.md](03-invoice-numbering.md)).
3. Captures/freezes every financial value listed in Section 2 as of that moment — including "capturing" values that would otherwise be live references (e.g., a Service's current rate, per Phase 0 FR-INV-014/FR-SVC-006).
4. Transitions the invoice's status to `Finalized` ([02-invoice-lifecycle.md](02-invoice-lifecycle.md)).
5. Produces a finalization audit event ([10-auditability-rules.md](10-auditability-rules.md)).

**Classification: SYSTEM RULE.**

## 2. Values That Become Immutable at Finalization

The following become immutable on finalization and may never be altered by ordinary editing, only through the correction mechanism in Section 4:

- Customer (client) identity as billed
- Each line item's description, quantity, unit price, and computed subtotal
- Invoice subtotal
- Every tax amount and the tax configuration basis used to compute it (rate(s), registration status assumed)
- Invoice total
- Invoice date
- Payment terms as stated on the invoice
- Invoice number
- Business identity/branding as it appeared on the invoice

Non-financial, non-identity metadata that does not affect the billed facts (e.g., an internal-only note visible solely to the owner, not printed on the invoice) may be treated as editable **only if** Phase 2 explicitly defines such a field as non-financial and purely internal; absent such a definition, everything listed above and everything printed on the invoice is immutable. **Classification: SYSTEM RULE.**

## 3. Void / Cancellation

**Decision (DEC-INV-007): Voiding marks a Finalized invoice `Void` ([02-invoice-lifecycle.md](02-invoice-lifecycle.md)). It requires an explicit user action and should capture a reason (recommended, not strictly required by Phase 1). Voiding is permitted regardless of the invoice's current Payment Status.**

- The voided invoice's content (Section 2 values) remains exactly as it was at the moment of finalization — voiding freezes, it does not erase or alter.
- The invoice number remains permanently consumed ([03-invoice-numbering.md](03-invoice-numbering.md), Section 4).
- The original invoice remains visible in the system indefinitely, clearly marked Void, for audit purposes (Phase 0 recordkeeping requirement, [04-canadian-billing-and-tax-audit.md](../phase-0/04-canadian-billing-and-tax-audit.md) Section 1.5).
- **Payments already recorded against a voided invoice are not automatically deleted, reversed, or reassigned.** They remain attached to the (now-void) invoice as a historical record. The system does not attempt to automatically resolve what happens to money already received when an invoice is voided — that would be a silent financial action (violates the "no silent financial changes" principle, Phase 0 [01-product-definition.md](../phase-0/01-product-definition.md)). If the payment needs to be reversed or reconciled against a replacement invoice, the user does so explicitly and separately (see [05-payment-rules.md](05-payment-rules.md), payment reversal).
- A voided invoice with unresolved attached payments should be flagged to the user at the moment of voiding (a warning, not a block) so the situation is visible rather than silently left dangling. The specific UX for this warning is a later-phase concern; the requirement that the system surface it is a Phase 1 rule.

**Classification: SYSTEM RULE.**

## 4. Correction Mechanism

**Decision (DEC-INV-008): The system supports exactly one correction mechanism: Void the original invoice, then create a new Replacement invoice (a normal Draft → Finalized invoice) explicitly linked to the original via a "corrects / replaces" reference. There is no in-place editing of a Finalized invoice's financial content, and no separate "amendment" record type distinct from Void + Replacement.**

Rationale: A single, uniform mechanism is easier to reason about, audit, and implement correctly than two overlapping mechanisms (e.g., a distinct "amendment" concept alongside "void"). Void + Replacement also naturally satisfies every sub-requirement the governing prompt raises:

| Question | Answer |
|---|---|
| Can a Finalized invoice be edited directly? | No. |
| Is a replacement invoice required for a correction? | Yes — this **is** the correction mechanism. |
| Does the original remain visible? | Yes, marked Void (Section 3). |
| Does the original's number remain permanently consumed? | Yes ([03-invoice-numbering.md](03-invoice-numbering.md), Section 4). |
| How is the correction linked to the original? | An explicit, permanent "replaces / corrected-by" reference between the two invoice records, created at the moment the replacement is finalized. |
| How does revenue reporting treat the original and replacement? | Original contributes $0 (voided); replacement contributes its own total, on its own invoice date — not backdated (see [01-accounting-basis.md](01-accounting-basis.md), Section 6). |
| How are payments on the original handled? | Not automatically moved (Section 3); handled explicitly and separately by the user, with the free-text payment note/reference available to record the connection to the original for the owner's/accountant's reference. |
| What audit history is retained? | The original's full pre-void content, the void event, the replacement's full content, the finalization event, and the link between them — all retained permanently ([10-auditability-rules.md](10-auditability-rules.md)). |

**Classification: SYSTEM RULE.**

## 5. What Correction Does Not Do

- It does not delete or hide the original invoice.
- It does not renumber or reuse the original invoice's number for the replacement — the replacement receives the next available number in the business's ordinary sequence, like any other new invoice.
- It does not automatically move, split, or reverse payments.
- It does not retroactively change which reporting period the corrected amount is attributed to (see [01-accounting-basis.md](01-accounting-basis.md), Section 6).

**Classification: SYSTEM RULE.**

## 6. Professional-Confirmation Note

If the owner's real accounting practice requires a corrected invoice's value to be attributed to the *original* invoice's period (rather than the replacement's finalization date, per Section 5), that period-attribution adjustment must be made by the owner/accountant in their own records — this system's reporting will show the replacement in its own, later period. **Classification: ACCOUNTANT / PROFESSIONAL CONFIRMATION REQUIRED** (confirm this reporting behavior is acceptable, or handle period attribution outside the system).
