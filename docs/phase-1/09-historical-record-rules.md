# 09 — Historical Record Rules

Status: Draft for Project Director review
Phase: 1
Resolves: structural rules only for Phase 0 UD-DATA-001 through 007 (business-specific facts remain unresolved — see Section 7)

## 0. Scope Reminder

This document defines the **accounting treatment rules** historical Business A records must follow once represented in the system. It does **not** perform migration, does not invent historical data, and does not create migration scripts — all prohibited by this phase's boundary (Section 3 and Section 18 of the governing prompt).

## 1. Same Model, No Separate "Legacy" Entity

**Decision (DEC-HIST-001): Historical invoices, clients, services, and payments are represented using the exact same Invoice, Client, Service, and Payment concepts defined in Phase 0 and elaborated in this phase — there is no separate "legacy invoice" entity type.**

Rationale: consistent with the extensibility/no-fundamental-redesign principle (Phase 0 NFR-EXT-001, NFR-MAINT-001) — a parallel legacy data model would itself be a structural complication the governing documents warn against. **Classification: SYSTEM RULE.**

## 2. Provenance Marking

**Decision (DEC-HIST-002): Every record must be able to carry a provenance marker distinguishing "created by historical import" from "created through ordinary system use."** This supports audit clarity (a reviewer can see which records reflect pre-existing facts vs. new system activity) and explains the completeness exemption in Section 4. This is a behavioral requirement on the data model (a field/attribute must exist to carry this distinction) — the exact technical representation is a Phase 2 decision. **Classification: SYSTEM RULE.**

## 3. Historical Invoices Enter Directly as Finalized

**Decision (DEC-HIST-003): A historical invoice is represented directly in `Finalized` status, bypassing `Draft`.** This is a special-cased transition permitted **only** for historical import, never for an invoice created through ordinary system use going forward (which must always pass through `Draft → Finalized`, per [02-invoice-lifecycle.md](02-invoice-lifecycle.md)). Rationale: a historical invoice already represents a real, previously-issued document — forcing it through a "Draft" state that never existed for it would misrepresent its actual history. **Classification: SYSTEM RULE** (structural allowance); the migration process that uses this allowance remains out of scope for Phase 1.

## 4. Completeness Exemption for Historical Records

**Decision (DEC-HIST-004): Historical Finalized invoices are exempt from the standard finalization completeness validation (Phase 0 FR-INV-013) that applies to invoices created through the ordinary Draft→Finalized workflow.** A historical record may contain fields explicitly marked "unknown" or "unverified" rather than being forced to satisfy the same validation a newly-created invoice must pass, since a historical record documents a fact that already happened outside the system's control, not new work being validated as it is finalized. This divergence must be clearly explained to the user wherever it is visible (e.g., a historical invoice missing a due date is shown as "unknown," not silently defaulted to a fabricated date). **Classification: SYSTEM RULE.**

## 5. Historical Invoice Numbers Are Preserved Exactly

**Decision (DEC-HIST-005): A historical invoice's original number, as it existed in Business A's prior records, is captured as that record's authoritative invoice number. It is never renumbered to fit the new system's sequence.**

This holds even if the historical numbering pattern differs from, or creates a discontinuity with, the new sequential per-business scheme defined in [03-invoice-numbering.md](03-invoice-numbering.md). **Classification: SYSTEM RULE** (no renumbering, ever).

**How the historical sequence and the new sequence reconcile going forward** (e.g., does new numbering continue after the last historical number, use a distinguishing prefix, or run as an acknowledged discontinuity) is **not resolved by Phase 1** — it depends on the actual historical numbering pattern, which is not yet known (Phase 0 UD-DATA-003, carried forward unresolved). **Classification: BUSINESS CONFIGURATION / unresolved pending Business A source data.**

## 6. Historical Tax Values Are Preserved As Recorded

**Decision (DEC-HIST-006): A historical invoice's tax amounts are preserved exactly as they were originally recorded/charged, even if they do not match the business's current tax configuration.** This is a direct application of the effective-dating principle already established in [07-tax-and-pricing-rules.md](07-tax-and-pricing-rules.md) Section 8 — historical Finalized invoices are never retroactively recalculated when current tax configuration changes, and this applies with equal force to invoices whose "finalization" was a historical import rather than a live finalization event. **Classification: SYSTEM RULE.**

## 7. Facts Phase 1 Does Not Resolve (Restated from Phase 0)

Phase 1 establishes the **rules that will govern** historical data once it exists in the system (Sections 1-6). It does not, and cannot, resolve the following business-specific facts, which remain exactly as flagged in Phase 0 [11-unresolved-decisions.md](../phase-0/11-unresolved-decisions.md):

- Source format of Business A's existing data (UD-DATA-001).
- Historical invoice format/detail level (UD-DATA-002).
- The actual historical numbering pattern, needed to resolve Section 5's open reconciliation question (UD-DATA-003).
- Client data quality/completeness (UD-DATA-004).
- Historical service/pricing history (UD-DATA-005).
- Historical payment records (UD-DATA-006).
- Business A's Calendar organization, relevant to how well Calendar-assisted matching will work retroactively, if ever applied historically (UD-DATA-007).

**Classification: BUSINESS CONFIGURATION / owner-supplied, required before any migration phase begins** — not decided here, and not invented.

## 8. Records That Cannot Be Verified

**Decision (DEC-HIST-007): Where a historical fact cannot be verified (e.g., an ambiguous or missing original tax treatment), the system must represent it as explicitly unverified rather than silently substituting a best guess.** This extends DEC-HIST-004 to any field, not only completeness gaps — the guiding rule is that historical uncertainty is shown as uncertainty, never quietly resolved into a fabricated certainty. **Classification: SYSTEM RULE.**

## 9. No Mutation of Finalized Historical Records After Import

Once imported/represented as `Finalized`, a historical invoice is subject to the exact same immutability and correction rules as any other Finalized invoice ([04-finalization-and-corrections.md](04-finalization-and-corrections.md)) — it may be Voided and Corrected through the same Void + Replacement mechanism, but it may never be edited in place, including "just this once to fix the import." **Classification: SYSTEM RULE.**
