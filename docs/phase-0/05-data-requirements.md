# 05 — Data Requirements

Status: Draft for Project Director review
Phase: 0

This document defines conceptual data requirements — the entities the system must represent and their essential properties and relationships. It intentionally does **not** define a database schema, tables, columns, primary/foreign key implementation, or SQL. Schema design belongs to Phase 2 (Architecture) and must satisfy the requirements below.

For each entity: purpose, ownership, required information (conceptual, not column-level), business association, relationships, lifecycle, immutability requirements, whether it represents financial history, and whether it contains sensitive information.

---

## Business
- **Purpose**: Represents one Canadian business profile operated by the owner (e.g., Business A, Business B).
- **Ownership**: Owned by the single system user (the business owner/administrator).
- **Required information**: Business identity (name), branding information for invoices/PDFs, business-specific tax configuration (see 04-canadian-billing-and-tax-audit.md), other business-specific settings.
- **Business association**: Is itself the top of the association hierarchy — every other business-owned entity associates to exactly one Business.
- **Relationships**: Has many Clients, Services, Invoices, Calendar Connections; is the scope for Revenue reporting.
- **Lifecycle**: Created once (initially, two: Business A, Business B); may be extended with additional business profiles later without redesign (FR-BUS-007). No deletion behavior is specified in Phase 0.
- **Immutability**: Not financial history itself, but its tax-configuration changes must be effective-dated so past invoices remain correctly associated with the tax treatment in force when they were finalized (see CFG-TAX-005).
- **Financial history**: No (it is the context, not a transaction).
- **Sensitive information**: Business identity/branding is not highly sensitive, but tax registration numbers should be treated with care.

## Client
- **Purpose**: Represents a billable customer of one specific business.
- **Ownership**: Owned by (belongs to) exactly one Business.
- **Required information**: Name, billing contact/address, and other information needed to invoice and to support Calendar client-matching (see FR-CLI-002, FR-CAL-004).
- **Business association**: Mandatory, exactly one Business; must never be reassignable to another Business through ordinary use (FR-CLI-006).
- **Relationships**: Has many Invoices; may be referenced by Candidate Work (via Calendar matching).
- **Lifecycle**: Created, edited, may be set to an active/inactive status (FR-CLI-004 — exact states unresolved).
- **Immutability**: Client records are editable during normal use (not financial history themselves), but a client's identity should not be alterable in a way that breaks traceability from historical invoices already issued to that client (e.g., renaming should not sever the invoice-client link).
- **Financial history**: No, but is referenced by financial history (invoices).
- **Sensitive information**: Yes — client billing/contact information is business-sensitive.

## Service
- **Purpose**: Represents a catalog item the business can bill for (a service type with a description, unit, and default rate).
- **Ownership**: Owned by exactly one Business.
- **Required information**: Description, billing unit, default rate, status (FR-SVC-002/003).
- **Business association**: Mandatory, exactly one Business; never reassignable (FR-SVC-005).
- **Relationships**: Referenced by Invoice Line Items and by Candidate Work (via Calendar service-matching).
- **Lifecycle**: Created, edited (rate/description), may become inactive so it is retained for history but not offered for new invoices (FR-SVC-003).
- **Immutability**: The catalog entry itself is editable, but editing it must not retroactively alter the rate/description already captured on existing Invoice Line Items (FR-SVC-006, FR-INV-014) — i.e., the line item must hold its own copy of the rate/description at time of invoicing, not a live reference.
- **Financial history**: No, but its captured values become part of financial history once used on a finalized invoice.
- **Sensitive information**: Generally not sensitive (may reflect business pricing strategy).

## Invoice
- **Purpose**: Represents a bill issued to a Client for work/services, the central financial artifact of the system.
- **Ownership**: Owned by exactly one Business, issued to exactly one Client of that Business.
- **Required information**: Invoice number, invoice date, due date, line items, subtotal, tax, total, notes, terms, lifecycle state, delivery state (FR-INV, FR-DEL requirements).
- **Business association**: Mandatory, exactly one Business (via its Client, and directly).
- **Relationships**: Belongs to one Business and one Client; has many Invoice Line Items; has many Payments; may reference approved Candidate Work as the source of some/all line items.
- **Lifecycle**: Draft → (edits) → Finalized → (Sent) → (Paid/Partially Paid/Overdue, derived or tracked) — exact persisted state set is unresolved (see FR-INV-010, 11-unresolved-decisions.md).
- **Immutability**: Draft invoices are freely editable. Once finalized, financial content (line items, quantities, rates, tax, totals, invoice number, dates) must become immutable except through a controlled correction mechanism (FR-INV-011) — this is a core financial-record integrity requirement.
- **Financial history**: Yes — a finalized Invoice is a primary financial record.
- **Sensitive information**: Yes — contains client billing information and business revenue detail.

## Invoice Line Item
- **Purpose**: Represents one billed item on an Invoice (a quantity of a service/description at a rate).
- **Ownership**: Owned by exactly one Invoice (and transitively, one Business).
- **Required information**: Description, quantity, rate, computed subtotal; optionally a reference to the Service it was drawn from and/or the Candidate Work/Calendar Event it originated from.
- **Business association**: Via its parent Invoice.
- **Relationships**: Belongs to one Invoice; may reference one Service (as of time of invoicing, captured, not live); may reference one approved Candidate Work item.
- **Lifecycle**: Created/edited while the parent Invoice is a draft; immutable once the parent Invoice is finalized (same rule as Invoice).
- **Immutability**: Same as parent Invoice — immutable post-finalization except via controlled correction.
- **Financial history**: Yes, as part of a finalized Invoice.
- **Sensitive information**: Reflects business revenue detail.

## Payment
- **Purpose**: Represents a payment received against a specific Invoice.
- **Ownership**: Owned by exactly one Invoice (and transitively, one Business).
- **Required information**: Payment date, amount, method, notes (FR-PAY-004).
- **Business association**: Via its parent Invoice.
- **Relationships**: Belongs to exactly one (finalized) Invoice.
- **Lifecycle**: Created by explicit user action (FR-PAY-008); may only be recorded against a finalized invoice (FR-PAY-007). Correction/deletion behavior is unresolved (see 11-unresolved-decisions.md, overpayment/correction behavior).
- **Immutability**: Once recorded, a Payment is a financial-history record; changes should follow the same controlled-correction philosophy as invoices, though the exact mechanism is unresolved.
- **Financial history**: Yes — a primary financial record.
- **Sensitive information**: Reflects business revenue detail; payment method/notes may include sensitive information depending on what the user records (should not be assumed to include card/bank numbers — this system does not process payments, see 09-scope-boundary.md).

## Calendar Connection
- **Purpose**: Represents an authorized link between the system (for a given Business) and a Google account, enabling Calendar retrieval.
- **Ownership**: Owned by exactly one Business (a connection established while that Business is the active context).
- **Required information**: OAuth token/credential reference (stored securely — see 06-security-requirements.md), the connected Google account identity, connection status (active/disconnected).
- **Business association**: Mandatory, exactly one Business — a Calendar Connection must not be usable to retrieve events into the wrong business's candidate work.
- **Relationships**: Has one or more selected Calendars; used to retrieve Calendar Events.
- **Lifecycle**: Created via OAuth flow; may be disconnected/revoked (FR-CAL-014).
- **Immutability**: Not financial history; tokens must be rotated/invalidated on disconnect.
- **Financial history**: No.
- **Sensitive information**: Yes — OAuth tokens/credentials are highly sensitive (see 06-security-requirements.md).

## Calendar
- **Purpose**: Represents one Google Calendar selected as an event source, within a Calendar Connection.
- **Ownership**: Owned by exactly one Calendar Connection (transitively, one Business).
- **Required information**: Calendar identifier/name as provided by Google, selection status.
- **Business association**: Via its Calendar Connection.
- **Relationships**: Source of Calendar Events retrieved for that Business.
- **Lifecycle**: Selected/deselected by the user.
- **Immutability**: Not financial history.
- **Financial history**: No.
- **Sensitive information**: Calendar names/metadata may hint at client relationships; treat as moderately sensitive.

## Calendar Event
- **Purpose**: Represents one retrieved event from a connected Calendar — raw evidence, not yet work.
- **Ownership**: Retrieved via a Calendar Connection owned by one Business.
- **Required information**: Event identifier (from Google), title, date/time, description, and other metadata used for matching (FR-CAL-004/005).
- **Business association**: Via the Calendar Connection it was retrieved through.
- **Relationships**: May give rise to one Candidate Work item.
- **Lifecycle**: Retrieved on sync; treatment of edited/cancelled/recurring source events is unresolved (see 07-google-calendar-requirements.md, 11-unresolved-decisions.md).
- **Immutability**: Represents an external fact at time of retrieval; the system should not allow editing the underlying Google event, only its own derived Candidate Work.
- **Financial history**: No — explicitly not authoritative (see product philosophy, 01-product-definition.md).
- **Sensitive information**: May contain client names, meeting details — sensitive by association.

## Candidate Work
- **Purpose**: Represents a system-suggested, not-yet-approved unit of billable work, derived from one Calendar Event and (attempted) Client/Service matches.
- **Ownership**: Owned by exactly one Business (via the Calendar Connection/Event it came from).
- **Required information**: Reference to source Calendar Event, matched Client (if any), matched Service (if any), a match confidence/review indicator, user edits (if any), review state (pending/edited/approved/rejected).
- **Business association**: Mandatory, exactly one Business.
- **Relationships**: Derived from one Calendar Event; may reference one Client and one Service; if approved, gives rise to one Invoice Line Item.
- **Lifecycle**: Created on sync/matching → reviewed → edited (optional) → approved or rejected (FR-CAL-006 through FR-CAL-011). Not itself billable until approved and converted.
- **Immutability**: Editable until approved; once converted to an Invoice Line Item on a finalized invoice, the resulting line item follows Invoice immutability rules, but the Candidate Work record itself should be retained for audit (FR-CAL-013).
- **Financial history**: No — it is pre-financial evidence/assistive data, explicitly not authoritative (critical rule, 07-google-calendar-requirements.md).
- **Sensitive information**: Yes, by association with client/business activity.

## Invoice/Work Relationship
- **Purpose**: Represents the traceable link between an approved Candidate Work item (and, transitively, its source Calendar Event) and the Invoice Line Item it became.
- **Ownership**: Implicit in the relationship between Candidate Work and Invoice Line Item; scoped to one Business.
- **Required information**: Which Candidate Work produced which Invoice Line Item, and when the approval/conversion occurred.
- **Business association**: Via the Invoice/Candidate Work, one Business.
- **Relationships**: Links Candidate Work → Invoice Line Item.
- **Lifecycle**: Established at approval/conversion time; permanent thereafter for audit purposes.
- **Immutability**: Should not be alterable after creation — it is an audit trail.
- **Financial history**: Supports financial history (audit trail for a financial record) though it is not itself a monetary record.
- **Sensitive information**: Moderate — reveals the origin of billed work.

## Settings / Configuration
- **Purpose**: Represents business-specific and, where applicable, system-wide configuration values (e.g., tax configuration, branding, matching thresholds once resolved).
- **Ownership**: Business-specific settings are owned by one Business; any genuinely system-wide settings (e.g., owner's own account preferences) are owned by the owner/user.
- **Required information**: Varies by setting; tax configuration items are enumerated in 04-canadian-billing-and-tax-audit.md, Section 2.
- **Business association**: Business-specific settings must be associated with exactly one Business and must not leak/default across businesses (see NFR-ISO-001).
- **Relationships**: Referenced by Invoice generation (tax), PDF generation (branding), Calendar matching (thresholds, once defined).
- **Lifecycle**: Editable by the owner; changes to tax settings must be effective-dated (CFG-TAX-005) to protect historical invoice integrity.
- **Immutability**: The current value is mutable; historical effective values must be preserved for invoices finalized under them.
- **Financial history**: The effective tax configuration at the time of finalization becomes part of what makes a finalized invoice's tax calculation reconstructible — so it must be preserved, even though "settings" itself is not a transaction record.
- **Sensitive information**: Tax registration numbers are moderately sensitive; branding is not.

## Audit Information
- **Purpose**: Represents the record of who/what/when for significant financial and Calendar-related state transitions (invoice finalized, payment recorded, candidate work approved/rejected, correction applied), supporting NFR-AUDIT requirements.
- **Ownership**: Scoped to the Business of the entity being audited.
- **Required information**: What changed, when, and (given a single-owner system) that it was the owner's action; for automated processes (e.g., Calendar sync), that it was system-initiated and what triggered it.
- **Business association**: Via the entity it audits.
- **Relationships**: Associated with Invoices, Payments, Candidate Work, and post-finalization corrections.
- **Lifecycle**: Append-only; never edited or deleted once written.
- **Immutability**: Must be immutable by design — it exists to record history truthfully.
- **Financial history**: Supports it directly.
- **Sensitive information**: Low-to-moderate; may reference other sensitive entities indirectly.

---

## Cross-Cutting Notes for Architecture Phase

- Every entity above that is "owned by exactly one Business" must be enforceably so at the data/security layer, not only in application logic (see 06-security-requirements.md — UI-level switching is not sufficient).
- The distinction between *live references* (e.g., a Service's current rate) and *captured values* (e.g., a Line Item's rate at time of invoicing) is a recurring integrity requirement and must be preserved in schema design.
- Nothing above should be read as prescribing normalization, key structure, or specific relational vs. document modeling — those are Phase 2 decisions.
