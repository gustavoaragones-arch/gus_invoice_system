# 10 — Auditability Rules

Status: Draft for Project Director review
Phase: 1
Elaborates: Phase 0 NFR-AUDIT, SEC-AUDIT, FR-CAL-013

## 1. Principle

Every action that creates, transitions, or corrects a financial or Calendar-approval record must leave a permanent, immutable trace of what happened — sufficient to reconstruct the record's full history later, without relying on the current state alone. This document defines **which** actions require an audit event and **what conceptual information** each must capture. It does not design the technical audit-log schema, storage mechanism, or query interface (Phase 2). **Classification: SYSTEM RULE** for the principle itself.

## 2. Events Requiring an Audit Record

| Event | Trigger | Financial record affected |
|---|---|---|
| Invoice created (Draft) | User creates a new draft invoice | Invoice (Draft) |
| Invoice finalized | `Draft → Finalized` transition | Invoice |
| Invoice send attempted | User-initiated send action | Invoice (delivery) |
| Invoice voided | `Finalized → Void` transition | Invoice |
| Replacement invoice created (correction) | New invoice finalized with a "replaces" link to a voided original | Invoice (new) + Invoice (original, linked) |
| Payment recorded | User records a payment | Payment |
| Payment reversed | User reverses a payment | Payment (reversal record, linked to original) |
| Payment method/note corrected | User edits non-financial payment fields | Payment |
| Tax configuration changed | User changes a business's tax settings | Business/Settings |
| Business branding/settings changed (invoice-affecting) | User edits settings that appear on invoices | Business/Settings |
| Candidate Work approved | User approves a Calendar-derived candidate | Candidate Work → Invoice Line Item |
| Candidate Work rejected | User rejects a Calendar-derived candidate | Candidate Work |
| Candidate Work edited | User edits a candidate before approval | Candidate Work |
| Calendar Connection established | OAuth connection completed | Calendar Connection |
| Calendar Connection disconnected | User disconnects | Calendar Connection |

**Classification: SYSTEM RULE** for this list being the minimum required set; additional events may be added in later phases without removing any of the above.

## 3. Required Information Per Audit Event

For every event in Section 2, the audit record must conceptually capture:

- **What happened** — the specific event type (e.g., "invoice finalized," "payment reversed").
- **Who performed it** — the acting user. In the current single-owner model this is always the one authenticated owner, but the field must exist and be populated on every event now, so the audit trail does not need to be retrofitted if multi-user access is ever authorized (Phase 0 SEC-AUTHZ-002, NFR-EXT).
- **When it happened** — a timestamp.
- **Which business was active** — the Business the affected record belongs to (never ambiguous, never inferred after the fact).
- **Which financial/record was affected** — a reference to the specific Invoice, Payment, Candidate Work, or Settings record.
- **Whether the previous value must be preserved** — see Section 4.

**Classification: SYSTEM RULE.**

## 4. Preservation of Previous Values

**Decision (DEC-AUDIT-001): Any audit event that represents a change to a previously-established value must preserve that prior value in the audit record itself, not only the new value.** This applies specifically to:

- Tax configuration changes (old rate/registration status → new).
- Payment reversal (the original amount/date being reversed).
- Business/branding settings changes that affect already-Finalized invoices' historical appearance (the settings in force at finalization time must remain reconstructable — see [04-finalization-and-corrections.md](04-finalization-and-corrections.md) Section 2).

Events that only ever *add* a new fact (invoice creation, payment recording, candidate approval) have no "previous value" to preserve — the requirement applies specifically to corrections/changes. **Classification: SYSTEM RULE.**

## 5. Immutability of Audit Records

Audit records themselves are append-only. Once written, an audit record is never edited or deleted — including when the record it describes is later voided or corrected (the void/correction itself produces a *new* audit event; it does not alter the audit trail of what came before). **Classification: SYSTEM RULE**, reaffirming Phase 0 NFR-AUDIT-003, SEC-AUDIT-001.

## 6. Relationship to the Financial-Record Chain

Per Phase 0 FR-CAL-013 and [05-data-requirements.md](../phase-0/05-data-requirements.md) (Invoice/Work Relationship entity), the audit trail must make it possible to trace, for any Invoice Line Item that originated from Calendar-assisted work, the full chain: Calendar Event → Candidate Work → (edits) → Approval → Invoice Line Item → (if later corrected) Void + Replacement. This document's event list (Section 2) is exactly the set of steps in that chain, plus the payment and configuration events needed to complete the financial picture. **Classification: SYSTEM RULE.**

## 7. What This Document Does Not Define

The technical mechanism (a dedicated audit-log table, event-sourcing, database triggers, or application-level logging) is a Phase 2 architecture decision. This document defines only the behavioral requirement that such a mechanism must satisfy. **Classification: not applicable — explicitly deferred to Phase 2, per the governing prompt's Section 20.**
