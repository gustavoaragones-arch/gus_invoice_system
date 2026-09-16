# 08 — User Workflows

Status: Draft for Project Director review
Phase: 0

These workflows describe the initial system's user-facing flows at a requirements level — user actions, system actions, financial consequences, irreversible points, validation requirements, error states, and security considerations. UI layout/visual design belongs to a later phase (see UX Guidelines requirements captured across this document and referenced governing sections).

---

## Workflow A — Business Selection

**Choose Business → Business Context Established → Business-specific data displayed**

- **User actions**: Selects a Business from the business switcher.
- **System actions**: Sets the active business context for the session; loads that Business's clients, services, invoices, payments, and revenue data only (FR-BUS-003/004).
- **Financial consequences**: None directly — this is a context-setting action, not a financial one.
- **Irreversible points**: None.
- **Validation requirements**: The selected Business must be one the authenticated owner is authorized to access (single-owner model — see SEC-AUTHZ-001; trivial in the two-business initial model but must not assume this stays trivial, per NFR-EXT-001).
- **Error states**: Selection of an invalid/inaccessible business must fail safely, without exposing another business's data.
- **Security considerations**: Business switching is a UI convenience; the server must independently verify business association on every subsequent request (SEC-ISO-002/003) — the workflow's safety does not depend on the UI having switched correctly.

---

## Workflow B — Client Management

**Choose Business → View Clients → Search/Create/Edit Client**

- **User actions**: Views the client list for the active Business; searches by name; creates a new client; edits an existing client's information; changes client status.
- **System actions**: Loads/filters clients scoped to the active Business (FR-CLI-001/003/005); persists creates/edits.
- **Financial consequences**: None directly from creating/editing a client record itself, but client data underpins future invoices, so accuracy here affects future billing accuracy.
- **Irreversible points**: None specified in Phase 0 (no destructive delete behavior is defined here — see 09-scope-boundary.md for what is out of scope).
- **Validation requirements**: Required billing information must be present before a client can be selected for invoicing (exact required-field set is an architecture-phase decision from FR-CLI-002).
- **Error states**: Duplicate/ambiguous client creation, incomplete billing information at invoice time.
- **Security considerations**: Client records must never be visible/searchable outside the active Business's scope (SEC-CLI-001, SEC-ISO-001).

---

## Workflow C — Manual Invoice

**Choose Business → Choose Client → Invoice Details → Line Items → Calculations → Review → Finalize → PDF → Send**

- **User actions**: Selects a client; enters invoice details (dates, notes, terms); adds line items (description, quantity, rate — optionally drawn from the Service catalog); reviews calculated totals and tax; finalizes; generates/reviews PDF; sends to client.
- **System actions**: Creates a Draft Invoice (FR-INV-001/002); computes line item and invoice totals and applicable tax from confirmed business tax configuration (FR-INV-006/007/008); on finalize, assigns invoice number (if not already assigned — see 11-unresolved-decisions.md) and locks financial content (FR-INV-011); generates PDF (FR-DEL-001/002); sends email on explicit user action (FR-DEL-003/004).
- **Financial consequences**: Finalization creates an authoritative financial record (NFR-INT-001). Sending notifies the client of a real financial obligation.
- **Irreversible points**: **Finalization is the key irreversible point** — after finalization, financial content is immutable except through a controlled correction mechanism (FR-INV-011, 11-unresolved-decisions.md). Sending an invoice is also effectively irreversible in effect (the client has seen it), even though the system does not prevent re-sending the same finalized content.
- **Validation requirements**: An invoice must have valid line items and a non-ambiguous total before finalization (FR-INV-013); tax must be calculated from a confirmed configuration, never a default (FR-INV-007).
- **Error states**: PDF generation failure, email send failure (must be surfaced per FR-DEL-006, not silently swallowed); attempted edit of a finalized invoice through ordinary means must be blocked.
- **Security considerations**: The invoice must belong to the active Business and its selected Client (SEC-ISO-001); only the authenticated owner may finalize/send (SEC-AUTHZ-001).

---

## Workflow D — Calendar-Assisted Invoice

**Choose Business → Choose Client → Choose Billing Period → Retrieve Calendar Activity → Detect Candidate Work → Review → Edit/Include/Exclude → Approve → Generate Invoice Items → Review Invoice → Finalize → PDF → Send**

- **User actions**: Selects client and billing period; triggers Calendar retrieval; reviews the resulting Candidate Work list; edits, includes (approves), or excludes (rejects) each item; reviews the resulting invoice; finalizes; generates PDF; sends.
- **System actions**: Retrieves Calendar Events for the period from the connected/selected Calendar (FR-CAL-003); attempts client/service matching (FR-CAL-004/005); presents Candidate Work with duplicate detection applied (FR-CAL-006/007); on approval, converts approved items to Invoice Line Items on a (new or existing draft) invoice (FR-CAL-011); continues into the same finalize/PDF/send steps as Workflow C.
- **Financial consequences**: Same as Workflow C from the point an invoice is created; additionally, the approval step is where Calendar evidence crosses into billable status — this is the step the Critical Rules (07-google-calendar-requirements.md, Section 2) protect most closely.
- **Irreversible points**: Approval of a Candidate Work item converts it to a real Invoice Line Item on a draft (still editable at that stage); Finalization (as in Workflow C) is the true point of no ordinary return. Rejection of Candidate Work is not literally irreversible (rejected items are retained for audit and could in principle be reconsidered — see CAL-SYNC-002), but it does mean the item will not resurface automatically.
- **Validation requirements**: No Candidate Work item may become an Invoice Line Item without individual (or deliberately-scoped bulk) user approval (FR-CAL-008/010/012); the system must never treat an unreviewed or low-confidence match as approved by default.
- **Error states**: Calendar API failure during retrieval (FR-CAL, CAL-FAIL-001) must be surfaced, not silently return zero candidates as if none existed; duplicate candidates from re-sync must be suppressed or clearly flagged (CAL-DUP-001/002).
- **Security considerations**: Retrieved events, candidate work, and resulting line items must remain scoped to the active Business's Calendar Connection and Business ID (SEC-CAL-001, SEC-ISO-001); OAuth token use is server-side only (SEC-OAUTH-003).

---

## Workflow E — Payment

**Invoice → Record Payment → Recalculate Amount Outstanding → Update Payment State → Update Revenue**

- **User actions**: Opens a finalized invoice; records a payment (date, amount, method, notes).
- **System actions**: Persists the Payment record against the Invoice (FR-PAY-001); recalculates amount paid/outstanding (FR-PAY-005); updates the derived payment status (FR-PAY-006); reflects the payment in Revenue reporting (FR-REV).
- **Financial consequences**: A Payment is itself a financial record (NFR-INT-001 applies to it as to invoices, per 05-data-requirements.md, Payment entity).
- **Irreversible points**: Recording a payment is a financial-history event; its correction/deletion behavior is unresolved (see FR-PAY-009, 11-unresolved-decisions.md) and must not be assumed to be a simple undo.
- **Validation requirements**: Payments may only be recorded against a finalized invoice (FR-PAY-007); overpayment behavior must follow a defined (currently unresolved) rule rather than being silently allowed or silently blocked without explanation.
- **Error states**: Attempted payment against a draft invoice must be rejected with a clear message; an overpayment attempt, pending resolution of FR-PAY-009, must not silently corrupt the outstanding-amount calculation.
- **Security considerations**: Payment recording is restricted to the authenticated owner (SEC-AUTHZ-001) and scoped to the invoice's Business (SEC-ISO-001).

---

## Workflow F — Revenue

**Choose Business → Dashboard/Reports → YTD / Monthly / Paid / Outstanding / Invoice metrics**

- **User actions**: Views the dashboard/reports for the active Business.
- **System actions**: Computes and displays YTD revenue, YTD invoiced, amount paid, outstanding amount, monthly revenue, and invoice counts (paid/unpaid/overdue) scoped to the active Business only (FR-REV-001 through 008).
- **Financial consequences**: None directly (read-only reporting), but the figures shown are derived from, and must remain traceable to, the underlying Invoice/Payment financial records (FR-REV-008).
- **Irreversible points**: None — this is a reporting workflow.
- **Validation requirements**: Revenue figures must never combine more than one Business's data (FR-REV-007, NFR-ISO-001); the revenue-recognition basis used must be consistent and defined (FR-REV-001, 11-unresolved-decisions.md).
- **Error states**: If underlying data is incomplete (e.g., mid-sync, or a calculation dependency fails), the dashboard must indicate this rather than silently showing a wrong or stale total as if current.
- **Security considerations**: Reporting is scoped to the active Business and the authenticated owner, same as all other workflows (SEC-ISO-001, SEC-AUTHZ-001).

---

## Cross-Workflow UX Requirements (from Governing UX Guidelines)

These apply across all workflows above and are captured here for traceability (see also Section 19 of the governing prompt):

- "Show, then ask" — automation (Calendar matching) shows its suggestion before requesting a decision; it never acts first and reports after.
- No silent financial changes, no silent business switching, no silent invoice sending — every financially consequential or context-changing action is explicit and visible to the user.
- Clear, explicit financial status language throughout (compact financial tables, explicit labels, understandable errors, useful empty states).
- A professional invoice preview and professional PDF output are expected deliverables of Workflows C and D.

Full UX requirement capture is in the governing documents; this document records only how those principles bear on the workflows above. Visual/interaction design itself is implemented in a later phase.
