# 03 — Invoice Numbering

Status: Draft for Project Director review
Phase: 1
Resolves: Phase 0 UD-LIFE-004

## 1. Assignment Timing

**Decision (DEC-INV-002): An invoice number is assigned exactly once, atomically, at the moment an invoice transitions `Draft → Finalized`. A Draft invoice has no invoice number.**

Rationale: Assigning numbers at draft-creation time would mean every abandoned/discarded draft either burns a number (creating unexplained gaps that look like missing invoices during a CRA review) or requires a "give the number back" mechanism that itself risks duplicate assignment. Assigning at finalization means numbers are only ever consumed by real, permanent financial records, and the sequence is gap-free except where a Void invoice legitimately consumed a number (see Section 4). **Classification: SYSTEM RULE.**

## 2. Do Drafts Have Invoice Numbers?

No. A Draft's identity in the system is its own internal record reference, not an invoice number. Any number-like value shown to the user while editing a Draft (if the interface chooses to preview "this will likely be #1047") must be clearly marked as provisional and is not reserved — it is not guaranteed to be the number actually assigned at finalization if another invoice is finalized first. **Classification: SYSTEM RULE.**

## 3. Sequencing

**Decision (DEC-INV-003): Invoice numbering is sequential and strictly increasing, scoped per Business.**

- Each Business has its own independent numbering sequence — Business A and Business B never share a number space, consistent with business isolation (Phase 0 SEC-ISO, FR-BUS-006).
- Numbering does **not** reset annually by default. It continues indefinitely within a business. Resetting per calendar/fiscal year is a common alternative convention in some invoicing practices, but Phase 0 does not establish a requirement for it, and introducing it by default would create ambiguity for Business A's historical continuation (see [09-historical-record-rules.md](09-historical-record-rules.md)).

**Classification: SYSTEM RULE** for per-business scoping and monotonic increase.
**Classification: BUSINESS CONFIGURATION / open item** — whether Business A's or Business B's numbering should continue an existing historical sequence, adopt a new format, or reset periodically is not decided here; it depends on Business A's actual historical numbering pattern, which Phase 1 does not have (see [09-historical-record-rules.md](09-historical-record-rules.md), UD-DATA-003 carried forward).

## 4. Reuse of Numbers

**Decision (DEC-INV-004): Invoice numbers are never reused, under any circumstance — including a Voided invoice's number.**

A Voided invoice's number remains permanently consumed and permanently associated with that (now-void) record. This is deliberate: a gap in the visible sequence at a void is the *correct*, auditable signal that something was issued and then cancelled — it is not an error to be hidden by recycling the number. Reusing a number would make two different financial records (the original attempt and whatever reused the number later) indistinguishable by number alone, which is unacceptable for audit and for CRA recordkeeping expectations (Phase 0, [04-canadian-billing-and-tax-audit.md](../phase-0/04-canadian-billing-and-tax-audit.md), Section 1.5). **Classification: SYSTEM RULE.**

## 5. Draft Deletion Before Finalization

Since numbers are assigned only at finalization (Section 1), deleting a Draft before finalization has **no numbering consequence whatsoever** — no number was ever consumed, so none is lost, skipped, or needs to be reclaimed. This is a direct, intended benefit of the assignment-timing decision in Section 1. **Classification: SYSTEM RULE.**

## 6. Finalization Failure After Number Allocation

**Decision (DEC-INV-005): Number allocation and the Draft→Finalized state transition must be a single atomic operation. If finalization fails for any reason after a number would have been allocated, no number is considered consumed, and the invoice remains in `Draft` state as if finalization had not been attempted.**

This is a behavioral requirement on the (later) implementation, not an architectural mechanism — Phase 1 does not specify *how* atomicity is achieved (e.g., transaction semantics), only that partial failure must never leave an orphaned, silently-consumed number with no corresponding real Finalized invoice. A silently skipped number that does *not* correspond to any Void or Finalized record would be indistinguishable from a data-integrity bug during a later CRA review, which this rule exists to prevent. **Classification: SYSTEM RULE** (behavioral requirement); the specific mechanism satisfying it is a Phase 2 architecture decision.

## 7. Business Separation Restated

Invoice numbering is scoped per Business (Section 3). Switching the active business context never changes, renumbers, or reveals another business's numbering sequence (reaffirms Phase 0 SEC-ISO-001/002, FR-BUS-006). **Classification: SYSTEM RULE.**

## 8. Format

Phase 1 does not define a specific numbering format (e.g., prefix, digit count, year-embedding) beyond "sequential, increasing, per-business, never reused." The exact display format is a Phase 2/product-configuration decision, subject to Section 3's open item about Business A's historical format continuity. **Classification: BUSINESS CONFIGURATION.**
