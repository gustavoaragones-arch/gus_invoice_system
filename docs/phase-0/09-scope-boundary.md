# 09 — Scope Boundary

Status: Draft for Project Director review
Phase: 0

This document is definitive for what the initial system builds, what may be considered later, and what is explicitly excluded. **No excluded feature may be introduced during implementation without explicit Project Director authorization.** Scope changes are a Project Director decision, not an implementation-agent decision.

---

## INITIAL SCOPE

Only what is authorized by the governing documents and detailed in [02-functional-requirements.md](02-functional-requirements.md):

- Two Canadian business profiles (Business A, Business B), with data-model support for adding more later without redesign.
- Business context switching (explicit, visible, never silent).
- Client records: create, view, edit, search, status, scoped per business.
- Service catalog: create, view, edit, status, default rates, scoped per business.
- Manual invoice creation: draft, line items, calculations, tax, notes/terms, finalization, immutability post-finalization, controlled correction mechanism (mechanism itself to be resolved — see 11-unresolved-decisions.md).
- Payment recording against finalized invoices: partial/full payment, payment date/method/notes, outstanding-amount calculation, payment status.
- Revenue reporting: YTD revenue/invoiced/paid/outstanding, monthly revenue, invoice counts, paid/unpaid/overdue, scoped per business.
- Google Calendar-assisted work detection: OAuth connection, calendar selection, read-only event retrieval, client/service matching, candidate work, duplicate detection, mandatory user review/approval before any item becomes an invoice line item, disconnect/revocation.
- Invoice delivery: PDF generation with business branding, email sending, delivery-state tracking, failure handling.
- Single business-owner/administrator access model.

## FUTURE / DEFERRED

Identified as possible future expansion, but not authorized for the initial build:

- Additional Canadian business profiles beyond Business A and Business B (the data model must support this without redesign, but building the onboarding flow for a third+ business is deferred until requested).
- Any cross-business combined reporting (explicitly not built now — see FR-BUS-008, NFR-ISO-001).
- Expanded Calendar automation (e.g., write-back to Google Calendar, richer matching algorithms, machine-learning-based confidence scoring) beyond what is specified in [07-google-calendar-requirements.md](07-google-calendar-requirements.md).
- Multi-user or delegated access (e.g., a bookkeeper or assistant with limited access) — the data model should not preclude this later, per SEC-AUTHZ-002, but it is not built now.
- Recurring/subscription invoicing patterns for the owner's own clients (distinct from "SaaS subscription billing," which is excluded below — this refers to whether the owner can set up a recurring invoice template for a client, which is not specified by the governing documents and is deferred).
- Client-facing self-serve portal.

## EXPLICITLY OUT OF SCOPE

At minimum, per the governing prompt, and not to be introduced without explicit Project Director authorization:

- Payroll
- Employee management
- Inventory
- Purchase orders
- Accounts payable
- Full accounts receivable management (beyond the invoice/payment/outstanding-balance tracking specified in FR-PAY/FR-REV)
- Bank reconciliation
- General ledger
- Double-entry bookkeeping interface
- Balance sheet
- Full financial statements
- Expense management
- Budgeting
- Forecasting
- International tax systems
- Multi-country accounting
- USD accounting (or any non-CAD primary accounting currency)
- SaaS subscription billing (i.e., this system is not itself sold as a subscription product to other businesses)
- Payment processing (this system records that a payment occurred; it does not process card/bank payments itself — see FR-PAY, 05-data-requirements.md Payment entity note)
- Stripe billing (or any payment-processor integration)
- Marketplace functionality
- Public multi-tenant SaaS
- Public registration (there is no public sign-up flow; the single owner is provisioned directly)
- Complex team permissions
- CRM functionality (beyond the client record-keeping specified in FR-CLI)
- Advanced accounting integrations (e.g., two-way sync with QuickBooks/Xero)

## Statement of Control

No item in "EXPLICITLY OUT OF SCOPE," and no item in "FUTURE / DEFERRED," may be implemented, scaffolded, or partially built during any implementation phase without the Project Director explicitly authorizing that specific expansion of scope. This applies even where an item would be technically easy to add alongside authorized work — ease of implementation is not authorization.
