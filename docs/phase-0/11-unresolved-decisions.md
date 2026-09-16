# 11 — Unresolved Decisions

Status: Draft for Project Director review
Phase: 0

This document lists every material decision identified during Phase 0 that cannot be safely inferred from the governing documents. Each entry states why it matters, which phase must resolve it, and what information is required. **None of these decisions have been made by the implementation agent.** Where a functional/data/security requirement elsewhere in this baseline references one of these, it is marked "[UNRESOLVED]" and points back here.

---

## Accounting

### UD-ACC-001 — Exact definition of revenue
- **Why it matters**: FR-REV-001 through 005 require reporting "revenue," but "revenue" could mean invoiced amount (accrual-like) or amount actually collected (cash-like), and these produce materially different figures, especially with partial payments and outstanding balances.
- **Resolve in**: Architecture (Phase 2), informed by Project Director/accountant input before revenue calculations are implemented.
- **Information required**: A decision — from the owner/accountant — on whether "revenue" for this system's dashboard means invoiced value, collected value, or both are shown as separate labeled figures (which the current FR set already partially supports by separating "YTD invoiced" from "YTD amount paid" — but which one, if any, is labeled simply "revenue" is still open).

### UD-ACC-002 — Revenue recognition basis appropriate to this application
- **Why it matters**: Related to UD-ACC-001 but broader — whether the system's internal logic (e.g., what counts toward "this month's revenue" when an invoice is issued in one month and paid in another) follows a cash basis, accrual basis, or a simplified hybrid appropriate for a billing tool that is explicitly not a full accounting system.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: Project Director/accountant guidance on which basis the owner's actual accounting relies on, so this system's reporting is at least consistent with (not necessarily identical to) it.

### UD-ACC-003 — Treatment of void invoices
- **Why it matters**: FR-INV-011 requires a controlled correction mechanism for finalized invoices, but "void" is one possible mechanism among several (e.g., void-and-reissue vs. credit-note-style adjustment), and the governing documents do not specify which.
- **Resolve in**: Architecture (Phase 2), with Project Director sign-off given the financial-record integrity principle at stake.
- **Information required**: A decision on whether voiding is supported at all, and if so, whether a voided invoice is retained (immutable, marked void) or handled another way; whether voiding affects revenue reporting retroactively or only going forward.

### UD-ACC-004 — Treatment of corrections
- **Why it matters**: FR-INV-011/NFR-INT-002 require that post-finalization corrections be controlled and auditable, but the actual mechanism (e.g., a linked correcting invoice, an amendment record, a full void-and-reissue) is not specified.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: Project Director decision on the correction model, ideally informed by how the owner has historically handled invoice mistakes for Business A.

### UD-ACC-005 — Treatment of overpayments, if supported
- **Why it matters**: FR-PAY-009 flags that the system's behavior when a payment would exceed the outstanding amount is undefined — options include rejecting the excess, recording a credit balance, or allowing a negative outstanding amount.
- **Resolve in**: Architecture (Phase 2)/Project Director.
- **Information required**: A decision on whether overpayment is possible in the owner's real business practice and, if so, how it should be represented (credit toward a future invoice? refund tracking, which is likely out of scope per 09-scope-boundary.md?).

### UD-ACC-006 — Invoice finalization rules
- **Why it matters**: FR-INV-013 notes that the exact rule for what makes an invoice eligible to be finalized (e.g., must have ≥1 line item, must have a non-zero total, may a $0 invoice be finalized intentionally) is not specified.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: Project Director confirmation of edge-case handling (e.g., is a $0 "invoice" for a goodwill/comp service a real use case for either business?).

---

## Invoice Lifecycle

### UD-LIFE-001 — Exact persisted invoice states
- **Why it matters**: FR-INV-010 establishes at minimum a draft and a finalized state but does not enumerate the complete state set (e.g., Draft, Finalized, Sent, Paid, Partially Paid, Overdue, Void).
- **Resolve in**: Architecture (Phase 2).
- **Information required**: Project Director decision on the canonical state list, and which of these are truly persisted states vs. derived conditions (see UD-LIFE-002/003).

### UD-LIFE-002 — Whether "Reviewed" is a persisted state or a workflow checkpoint
- **Why it matters**: The Calendar-assisted workflow (Workflow D) includes a review step; whether "reviewed" needs to be a queryable, persisted state on the invoice/candidate work (for reporting/audit) or is simply a workflow checkpoint with no lasting state beyond the approval records themselves is unspecified.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: Whether the owner needs to filter/report on "invoices pending review" as a distinct queryable state.

### UD-LIFE-003 — Whether "Overdue" is a state or a derived condition
- **Why it matters**: "Overdue" is naturally a function of due date + payment status at query time (a derived condition), but could alternatively be a state the system explicitly transitions into (e.g., via a scheduled job), which has different implications for reporting consistency and for triggering any future reminder feature.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: Confirmation that "Overdue" is derived (recommended default reading of the governing documents, but not explicitly stated) rather than a stored state requiring a background process.

### UD-LIFE-004 — Invoice-number assignment timing
- **Why it matters**: FR-INV-003 flags that whether the invoice number is assigned at draft creation or only at finalization affects both user experience (previewing a number before it's final) and correctness (a number should probably not be "used up" by a draft that is later discarded).
- **Resolve in**: Architecture (Phase 2).
- **Information required**: Project Director decision, and — for Business A — how the existing/historical numbering scheme works, so the new scheme is compatible or a clean break is deliberately chosen.

### UD-LIFE-005 — Controlled post-finalization correction behavior
- **Why it matters**: Same underlying gap as UD-ACC-004; recorded here again because it is simultaneously a lifecycle-state question (what state does a "corrected" invoice occupy?) and an accounting-treatment question.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: See UD-ACC-004.

---

## Tax

### UD-TAX-001 — Business-specific GST/HST registration status
- **Why it matters**: FR-INV-007 requires this be configured, never assumed; see 04-canadian-billing-and-tax-audit.md Section 1.1/3.
- **Resolve in**: Business-specific determination, before tax logic is implemented against real data (Phase 2/3 configuration input, not a Phase 0 or Phase 2 code decision).
- **Information required**: Confirmation from the owner (informed by their accountant) of Business A's and Business B's current/planned GST/HST registration status and registration number(s).

### UD-TAX-002 — Applicable tax configuration (rate, place of supply, PST/QST)
- **Why it matters**: See 04-canadian-billing-and-tax-audit.md Sections 1.2/1.3/3.
- **Resolve in**: Business-specific determination.
- **Information required**: Which province(s) are the correct place of supply for each business's actual clients/services, and whether any provincial PST/RST/QST obligation applies.

### UD-TAX-003 — Tax-inclusive/exclusive behavior
- **Why it matters**: Whether line-item rates entered by the user are tax-inclusive or tax-exclusive changes the calculation and the displayed breakdown; not specified by the governing documents.
- **Resolve in**: Architecture (Phase 2), informed by the owner's/accountant's preferred invoicing convention.
- **Information required**: A decision, likely as a per-business or per-invoice setting.

### UD-TAX-004 — Effective-date requirements
- **Why it matters**: CFG-TAX-005 (04-canadian-billing-and-tax-audit.md) requires tax configuration changes not retroactively alter finalized invoices; the exact effective-dating mechanism is an architecture decision.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: None beyond the principle already stated — this is a design task, not a business-fact gap.

### UD-TAX-005 — Tax rounding rules
- **Why it matters**: NFR-ACC-003 requires a defined, consistent rounding rule (e.g., round-half-up per line item vs. round the invoice total once), and different rules produce different penny-level results, which matters for correctness and for matching the business's existing (Business A) invoicing convention.
- **Resolve in**: Architecture (Phase 2), ideally informed by professional confirmation (04-canadian-billing-and-tax-audit.md, Section 4).
- **Information required**: Confirmation of the rounding convention the business (or its accountant) expects.

### UD-TAX-006 — Mixed-tax treatment if required
- **Why it matters**: If a business ever issues an invoice with both taxable and exempt/zero-rated items, or items subject to different provincial rates, the system needs a defined way to represent this; not specified.
- **Resolve in**: Architecture (Phase 2), only if business-specific facts (UD-TAX-002) indicate this scenario actually arises for Business A or B.
- **Information required**: Whether either business's real service catalog includes mixed-tax scenarios.

---

## Payments

### UD-PAY-001 — Allowed payment methods
- **Why it matters**: FR-PAY-004 requires a payment method field but does not enumerate the allowed values (e.g., e-transfer, cheque, credit card via third party, cash).
- **Resolve in**: Architecture (Phase 2)/Project Director, informed by how the owner is actually paid.
- **Information required**: The owner's real-world set of payment methods for Business A and B.

### UD-PAY-002 — Payment correction behavior
- **Why it matters**: FR-PAY-009 area; if a payment is recorded incorrectly (wrong amount/date), whether it can be edited, must be deleted-and-recreated, or requires a correction record is unspecified.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: Project Director decision, consistent with the financial-record integrity principle.

### UD-PAY-003 — Overpayment behavior
- **Why it matters**: Duplicate of UD-ACC-005; recorded here again as a payments-specific facet (what the Payment entity itself is allowed to record) rather than the accounting-treatment facet.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: See UD-ACC-005.

---

## Calendar

### UD-CAL-001 — Matching confidence model
- **Why it matters**: 07-google-calendar-requirements.md Section 9/20; affects both UX (how confidence is shown) and the underlying matching implementation.
- **Resolve in**: Architecture (Phase 2)/Implementation, and should be validated against real Calendar data from the owner's actual usage before finalizing the algorithm.
- **Information required**: Sample real-world Calendar event data/patterns from the owner to design a matching approach that will actually work for their event-naming/scheduling habits.

### UD-CAL-002 — Matching threshold
- **Why it matters**: If a scored confidence model is chosen (UD-CAL-001), a threshold for what counts as a "likely match" vs. "needs review" vs. "unmatched" must be set; not specified.
- **Resolve in**: Architecture/Implementation.
- **Information required**: Depends on UD-CAL-001's resolution.

### UD-CAL-003 — Duplicate detection rules
- **Why it matters**: 07-google-calendar-requirements.md Section 11/20 (CAL-DUP-003).
- **Resolve in**: Architecture (Phase 2).
- **Information required**: None beyond design effort, though real-world testing against repeated syncs is advisable before relying on it for actual billing.

### UD-CAL-004 — Treatment of recurring events
- **Why it matters**: 07-google-calendar-requirements.md Section 20.
- **Resolve in**: Architecture (Phase 2)/Project Director — this has a real workflow implication (one Candidate Work per occurrence vs. an aggregate) that affects how the owner will actually use the review screen.
- **Information required**: Project Director decision on the intended UX for recurring commitments.

### UD-CAL-005 — Treatment of cancelled events
- **Why it matters**: 07-google-calendar-requirements.md Section 20; a previously-synced event later cancelled in Google Calendar needs a defined behavior (auto-remove candidate if not yet reviewed? flag if already approved?).
- **Resolve in**: Architecture (Phase 2).
- **Information required**: None beyond design effort.

### UD-CAL-006 — Treatment of edited events
- **Why it matters**: 07-google-calendar-requirements.md Section 20; an event edited after being synced but before being reviewed needs a defined refresh/conflict rule.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: None beyond design effort.

### UD-CAL-007 — Event-to-work identity rules
- **Why it matters**: Underlies UD-CAL-003/005/006 — the system needs a stable notion of "the same event" across time/syncs (e.g., Google event ID + last-modified timestamp), which is not specified by the governing documents.
- **Resolve in**: Architecture (Phase 2).
- **Information required**: None beyond design effort; this is a technical design task once the above business-facing decisions are made.

---

## Email

### UD-EMAIL-001 — Transactional email provider
- **Why it matters**: The governing technology direction specifies "a transactional email provider" without naming one; FR-DEL-003/005 depend on it.
- **Resolve in**: Architecture (Phase 2), respecting the "avoid unnecessary infrastructure" principle.
- **Information required**: None beyond an architecture-phase evaluation; Project Director approval of the selected provider before it is integrated.

### UD-EMAIL-002 — Sender identity
- **Why it matters**: Invoices should appear to come from the correct business identity (Business A vs. Business B), which has implications for domain/sender configuration.
- **Resolve in**: Architecture (Phase 2), with business-specific input (does the owner have a domain/email address per business, or one shared address?).
- **Information required**: The owner's actual email/domain setup for each business.

### UD-EMAIL-003 — Delivery-status requirements
- **Why it matters**: FR-DEL-005/006 require tracking delivery state including failures, but the exact states and how they're detected (e.g., provider webhook vs. best-effort send confirmation) depend on the provider chosen (UD-EMAIL-001).
- **Resolve in**: Architecture (Phase 2).
- **Information required**: Depends on UD-EMAIL-001's resolution.

---

## Existing Data (Business A)

### UD-DATA-001 — Source format of Business A's existing data
- **Why it matters**: RISK-016/017; without knowing the current format (spreadsheet? another invoicing tool's export? paper?), no migration plan can be made.
- **Resolve in**: Prior to any migration work (a phase after architecture, likely Phase 3+), and must be supplied by the owner/Project Director.
- **Information required**: What system/format Business A's current billing records exist in today.

### UD-DATA-002 — Historical invoice format
- **Why it matters**: Whether historical invoices have consistent numbering, line-item detail, and tax treatment affects whether they can be faithfully represented in the new data model or must be summarized/approximated.
- **Resolve in**: Prior to migration.
- **Information required**: Sample historical invoices from Business A.

### UD-DATA-003 — Invoice numbering history
- **Why it matters**: Directly affects UD-LIFE-004 (numbering scheme) — a new scheme must decide whether to continue Business A's existing sequence or start fresh, and this is a business decision (continuity may matter for the owner's own records/CRA correspondence).
- **Resolve in**: Prior to migration/architecture finalization of numbering.
- **Information required**: Business A's current numbering scheme and whether continuity is desired.

### UD-DATA-004 — Client data quality
- **Why it matters**: Migrated client records must be complete enough to invoice against (FR-CLI-002); unknown current data quality is a risk (RISK-017).
- **Resolve in**: Prior to migration.
- **Information required**: An audit of Business A's current client data completeness, to be done by the owner or a later-phase migration task.

### UD-DATA-005 — Service/pricing history
- **Why it matters**: Historical rates may differ from current rates; migrated historical invoices must preserve the rate actually charged at the time (consistent with FR-SVC-006/FR-INV-014), not the current catalog rate.
- **Resolve in**: Prior to migration.
- **Information required**: Business A's historical pricing records.

### UD-DATA-006 — Payment history
- **Why it matters**: Migrated invoices need accurate historical payment records to produce correct outstanding balances and revenue history; incomplete payment history would corrupt RISK-004/017.
- **Resolve in**: Prior to migration.
- **Information required**: Business A's historical payment records.

### UD-DATA-007 — Calendar organization
- **Why it matters**: If Business A's existing work-tracking used Calendar in a particular way (naming conventions, which calendars, shared vs. personal), this affects how well the matching approach (UD-CAL-001) will work in practice for that business specifically.
- **Resolve in**: Architecture (Phase 2) matching design, and prior to relying on Calendar-assisted invoicing for Business A specifically.
- **Information required**: A description or sample of how the owner currently organizes Business A's Calendar.

---

## Summary Table

| ID | Area | Must Resolve By |
|----|------|------------------|
| UD-ACC-001 to 006 | Accounting | Phase 2 / Project Director |
| UD-LIFE-001 to 005 | Invoice lifecycle | Phase 2 |
| UD-TAX-001 to 006 | Tax | Business-specific facts + Phase 2 |
| UD-PAY-001 to 003 | Payments | Phase 2 / Project Director |
| UD-CAL-001 to 007 | Calendar | Phase 2 (some need real Calendar sample data) |
| UD-EMAIL-001 to 003 | Email | Phase 2 |
| UD-DATA-001 to 007 | Existing data (Business A) | Pre-migration, owner-supplied |

None of the above have been decided in this document. They are handed to the Project Director as the exact list of decisions blocking a complete architecture.
