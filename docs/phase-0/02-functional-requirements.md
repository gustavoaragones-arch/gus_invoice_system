# 02 — Functional Requirements

Status: Draft for Project Director review
Phase: 0

Each requirement has a unique ID. IDs are stable identifiers for traceability into later phases (architecture, implementation, test plans) and must not be renumbered casually once accepted.

Requirements describe **what** the system must do. They intentionally avoid specifying database schema, UI layout, or algorithms where the governing documents do not already establish them — those are architecture/implementation decisions for later phases. Where a requirement depends on a decision not yet made, it is marked **[UNRESOLVED → see 11-unresolved-decisions.md]**.

---

## FR-BUS — Business Profiles

- **FR-BUS-001** — The system shall support one or more Canadian business profiles, with exactly two configured initially (Business A, Business B).
- **FR-BUS-002** — The system shall maintain, for each business profile, business-identifying information (legal/operating name, and other business-specific settings — see FR-BUS-005) separately from every other business profile.
- **FR-BUS-003** — The system shall maintain a single "active business context" for the current user session, determining which business's data (clients, services, invoices, payments, revenue) is displayed and operated on.
- **FR-BUS-004** — Switching the active business context shall be an explicit, user-initiated action, clearly visible in the interface, and shall never happen silently or as a side effect of another action.
- **FR-BUS-005** — Each business profile shall support business-specific settings, at minimum: business identity/branding for invoices and PDFs, and tax configuration (see FR-INV-011, 04-canadian-billing-and-tax-audit.md). The exact set of configurable settings is subject to architecture-phase refinement but must not be shared/global across businesses where the setting is financially or legally business-specific.
- **FR-BUS-006** — Data belonging to one business profile (clients, services, invoices, payments, revenue) shall not be visible, editable, or reportable from within another business profile's context.
- **FR-BUS-007** — The data model and enforcement mechanism for business association (FR-BUS-006) shall be designed so additional Canadian business profiles can be added without fundamental database redesign (see 05-data-requirements.md, 06-security-requirements.md).
- **FR-BUS-008** — The system shall not present combined/aggregated financial totals across more than one business profile in any dashboard, report, or export, unless and until the Project Director explicitly authorizes a cross-business reporting feature (currently out of scope — see 09-scope-boundary.md).

## FR-CLI — Clients

- **FR-CLI-001** — The system shall maintain client records scoped to exactly one business profile (see FR-BUS-006).
- **FR-CLI-002** — A client record shall include the billing information necessary to invoice that client (e.g., name, billing contact, billing address, and any other information the invoice or PDF requires — see 05-data-requirements.md).
- **FR-CLI-003** — The system shall support creating, viewing, editing, and searching client records within the active business context.
- **FR-CLI-004** — The system shall support a client status (e.g., active/inactive) to distinguish clients currently being billed from clients no longer active. **[UNRESOLVED → exact status values/lifecycle not specified in governing documents]**
- **FR-CLI-005** — Client search shall allow the user to locate a client record by name (and other identifying fields as determined in architecture) within the active business's client list only.
- **FR-CLI-006** — A client record shall never be reassigned from one business profile to another through ordinary use of the application.

## FR-SVC — Services

- **FR-SVC-001** — The system shall maintain a service catalog scoped to exactly one business profile.
- **FR-SVC-002** — Each service entry shall include a description, a unit of billing (e.g., hourly, fixed, per-item — exact unit set is an architecture-phase decision informed by the owner's real services), and a default rate.
- **FR-SVC-003** — The system shall support a service status (e.g., active/inactive) so that discontinued services can be retained for historical invoice integrity without appearing as selectable options for new invoices. **[UNRESOLVED → exact status values not specified]**
- **FR-SVC-004** — The system shall support creating, viewing, and editing service catalog entries within the active business context.
- **FR-SVC-005** — A service catalog entry shall never be reassigned from one business profile to another through ordinary use of the application.
- **FR-SVC-006** — Editing a service's default rate shall not alter the rate recorded on any existing invoice line item that already references that service (see FR-INV-014, financial-record integrity principle).

## FR-INV — Invoices

- **FR-INV-001** — The system shall support creating a new invoice within the active business context, associated with exactly one client of that business.
- **FR-INV-002** — The system shall support draft invoices that can be edited freely (line items, dates, notes, terms) prior to finalization.
- **FR-INV-003** — The system shall assign each invoice a unique invoice number. **[UNRESOLVED → numbering scheme, sequence scope (per business vs. global), and assignment timing (at draft creation vs. at finalization) — see 11-unresolved-decisions.md]**
- **FR-INV-004** — The system shall record an invoice date and a due date for each invoice.
- **FR-INV-005** — The system shall support one or more line items per invoice, each with a description, quantity, and rate.
- **FR-INV-006** — The system shall calculate each line item's subtotal from quantity × rate, and shall calculate the invoice subtotal from the sum of line items.
- **FR-INV-007** — The system shall apply applicable Canadian tax (GST/HST, and provincial sales tax where applicable) to the invoice according to the business's confirmed, business-specific tax configuration (see 04-canadian-billing-and-tax-audit.md). The system shall never assume a tax treatment or tax registration status by default.
- **FR-INV-008** — The system shall calculate and display the invoice total (subtotal + applicable tax) and shall not permit the total to diverge silently from the sum of its components.
- **FR-INV-009** — The system shall support free-text notes and payment terms on an invoice.
- **FR-INV-010** — The system shall support an invoice lifecycle with, at minimum, a draft state and a finalized state. **[UNRESOLVED → complete list of persisted states and whether "Reviewed"/"Overdue" are persisted states or derived/workflow conditions — see 11-unresolved-decisions.md]**
- **FR-INV-011** — Once an invoice is finalized, its financial content (line items, quantities, rates, tax, totals, invoice number, dates) shall become immutable through ordinary editing. Any change after finalization must occur through a controlled, auditable correction mechanism, not silent in-place editing. **[UNRESOLVED → exact correction/void mechanism — see 11-unresolved-decisions.md]**
- **FR-INV-012** — The system shall require the user to review invoice content (including any calendar-derived line items) before finalization.
- **FR-INV-013** — The system shall prevent finalization of an invoice that has no line items or a zero/undefined total, except where the user explicitly confirms such an invoice is intended (edge case; exact rule is an architecture-phase decision).
- **FR-INV-014** — Invoice line items generated from an existing service catalog entry shall capture the rate and description at the time of invoicing, independent of later edits to the service catalog (see FR-SVC-006).
- **FR-INV-015** — The system shall support recording that an invoice has been sent to the client, and shall track this as part of the invoice's delivery state (see FR-DEL requirements).

## FR-PAY — Payments

- **FR-PAY-001** — The system shall support recording a payment against a specific finalized invoice.
- **FR-PAY-002** — The system shall support partial payments, where the recorded payment amount is less than the invoice total.
- **FR-PAY-003** — The system shall support full payment, where cumulative recorded payments equal the invoice total.
- **FR-PAY-004** — Each payment record shall include a payment date, a payment amount, and shall support a payment method and free-text notes. **[UNRESOLVED → the allowed set of payment methods — see 11-unresolved-decisions.md]**
- **FR-PAY-005** — The system shall calculate and display, for each invoice, the amount paid to date and the outstanding amount (invoice total minus cumulative payments).
- **FR-PAY-006** — The system shall derive and display a payment status per invoice (e.g., unpaid, partially paid, paid, overdue) from the invoice total, due date, and recorded payments. **[UNRESOLVED → exact status set and whether "overdue" is derived or persisted — see 11-unresolved-decisions.md]**
- **FR-PAY-007** — The system shall prevent recording a payment against a draft (non-finalized) invoice.
- **FR-PAY-008** — The system shall never automatically create, adjust, or delete a payment record without an explicit user action.
- **FR-PAY-009** — The system's behavior when a recorded payment would exceed the invoice's outstanding amount (overpayment) shall follow a defined rule. **[UNRESOLVED → whether overpayment is permitted, and how it is treated — see 11-unresolved-decisions.md]**

## FR-REV — Revenue

- **FR-REV-001** — The system shall report year-to-date (YTD) revenue for the active business profile. **[UNRESOLVED → exact revenue-recognition basis (invoiced vs. collected) — see 11-unresolved-decisions.md]**
- **FR-REV-002** — The system shall report YTD invoiced amount (total of finalized invoices issued in the year) for the active business profile.
- **FR-REV-003** — The system shall report YTD amount paid (total of payments recorded in the year, or against invoices issued in the year — subject to FR-REV-001's resolution) for the active business profile.
- **FR-REV-004** — The system shall report YTD outstanding amount (unpaid/partially paid invoice balances) for the active business profile.
- **FR-REV-005** — The system shall report monthly revenue figures for the active business profile, consistent with the resolved revenue-recognition basis.
- **FR-REV-006** — The system shall report invoice counts (e.g., total, paid, unpaid, overdue) for the active business profile.
- **FR-REV-007** — All revenue reporting shall be scoped to exactly one business profile at a time and shall never blend figures across business profiles (see FR-BUS-008).
- **FR-REV-008** — Revenue figures shall be fully traceable to the underlying invoice and payment records that produced them.

## FR-CAL — Google Calendar

- **FR-CAL-001** — The system shall support connecting a Google account via OAuth 2.0 to enable Calendar access for the active business profile.
- **FR-CAL-002** — The system shall support selecting which Google Calendar(s) are used as the source of work-detection evidence.
- **FR-CAL-003** — The system shall retrieve calendar events for a user-specified date range.
- **FR-CAL-004** — The system shall attempt to match retrieved calendar events to an existing client of the active business.
- **FR-CAL-005** — The system shall attempt to match retrieved calendar events to an existing service of the active business.
- **FR-CAL-006** — Matched (or partially matched) events shall be presented to the user as "candidate work" — not as invoice line items and not as financial records.
- **FR-CAL-007** — The system shall attempt to detect duplicate candidate work (e.g., an event already converted to an invoice line item, or already reviewed and rejected) to avoid presenting the same work twice. **[UNRESOLVED → exact duplicate-detection rule — see 07-google-calendar-requirements.md, 11-unresolved-decisions.md]**
- **FR-CAL-008** — The system shall require explicit user review of each candidate work item before it can be included on an invoice.
- **FR-CAL-009** — The system shall allow the user to edit candidate work (e.g., description, quantity/duration, client, service) prior to approval.
- **FR-CAL-010** — The system shall allow the user to approve or reject candidate work items individually.
- **FR-CAL-011** — Only approved candidate work items shall be convertible into invoice line items.
- **FR-CAL-012** — The system shall never automatically convert a calendar event into an invoice line item without explicit per-item user approval (see 21-critical-financial-principles referenced in 07-google-calendar-requirements.md).
- **FR-CAL-013** — The system shall retain a record sufficient to audit which calendar event produced which candidate work and, if approved, which invoice line item (see 06-security-requirements.md, auditability).
- **FR-CAL-014** — The system shall support disconnecting the Google Calendar connection, and shall define the resulting behavior for previously approved/converted items (they remain intact; future retrieval stops).

## FR-DEL — Invoice Delivery

- **FR-DEL-001** — The system shall generate a PDF representation of a finalized invoice.
- **FR-DEL-002** — The generated PDF shall include the business's branding/identity information (see FR-BUS-005) appropriate to the active business profile.
- **FR-DEL-003** — The system shall support sending the invoice (e.g., the PDF) to the client via email.
- **FR-DEL-004** — The system shall never send an invoice automatically without an explicit user-initiated send action (no silent invoice sending — see UX governing principle).
- **FR-DEL-005** — The system shall track a delivery state for each invoice (e.g., not sent, sent, send failed). **[UNRESOLVED → exact state set and email provider — see 11-unresolved-decisions.md]**
- **FR-DEL-006** — The system shall surface delivery failures (PDF generation failure, email send failure) to the user rather than silently failing.
- **FR-DEL-007** — Re-sending an invoice shall be possible without altering the finalized invoice's financial content.
