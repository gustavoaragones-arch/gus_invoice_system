# 01 — Product Definition

Status: Draft for Project Director review
Phase: 0 — Requirements & Documentation Baseline
Owner of decisions in this document: Project Director (ChatGPT)
Author of this document: Implementation agent (Claude Code / Cursor)

---

## 1. Purpose

The product is a private Canadian billing and revenue-management application for a single business owner who operates one or more Canadian businesses. Its purpose is to take the owner from performed work through to a finalized, sent invoice and a recorded payment, with revenue reporting derived from that trail — using Google Calendar activity as assistive evidence of work performed, not as an authoritative accounting source.

The system exists to solve a specific, real workflow problem for the owner: turning calendar-recorded work into accurate, correctly taxed, professional invoices with minimal manual re-entry, while keeping every dollar figure traceable back to an invoice and a payment.

## 2. Target User

- A single business owner / administrator.
- Operates one or more Canadian businesses personally (not a multi-user firm, not a bookkeeping service, not a SaaS product for external customers).
- Is the sole authenticated user of the system in the initial release.
- Is comfortable reviewing and approving detected work before it becomes billable — the system is designed around this review step, not around full automation.

## 3. Jurisdiction

- The system is Canadian-only.
- All business profiles supported in the initial system are Canadian businesses subject to Canadian federal (GST/HST) and, where applicable, provincial sales tax rules.
- No non-Canadian tax jurisdictions, currencies as a primary accounting currency, or international accounting frameworks are in scope. (See [09-scope-boundary.md](09-scope-boundary.md).)

## 4. Initial Business-Profile Model

The initial system supports exactly two Canadian business profiles:

- **Business A** — an existing, operating Canadian business with historical and current billing data that must be represented in the system (via data entry or migration addressed in a later phase).
- **Business B** — a newly established Canadian business with no clients and no historical billing data; it starts clean.

Both business profiles are owned and operated by the same single user. The two businesses are treated as fully separate financial entities within the system: separate clients, separate services, separate invoices, separate revenue.

The data model must be designed so that additional Canadian business profiles can be added later **without fundamental database redesign**. This is a data-architecture requirement to be honored in Phase 2, not a commitment to build multi-business features beyond what is specified here.

## 5. Core Workflow

The system's central workflow, present in every business profile, is:

```
Business → Client → Work / Calendar Activity → Review → Invoice → Send → Payment → Revenue
```

Every invoice traces back to a business and, where calendar-assisted, to reviewed work. Every payment traces back to an invoice. Every revenue figure traces back to invoices and payments. Nothing in revenue reporting exists that cannot be traced to this chain.

## 6. Central Calendar-Assisted Workflow

The differentiating capability of this product, relative to generic invoicing tools, is Google Calendar-assisted work detection:

```
Google Calendar → Retrieved Events → Matching (Client/Service) → Candidate Work → User Review → Approval → Invoice Line Item
```

Calendar activity is **evidence** presented to the user to speed up invoice preparation. It is never treated as a financial record in itself, and it never becomes a financial record without explicit user review and approval. See [07-google-calendar-requirements.md](07-google-calendar-requirements.md).

## 7. Product Philosophy

### 7.1 Accuracy-before-convenience principle
Where automation and accuracy are in tension, accuracy wins. The system favors surfacing uncertainty to the user over guessing on their behalf, especially for anything that affects an invoice total, a tax amount, or a revenue figure.

### 7.2 Automation-review principle
Automation (calendar matching, candidate work detection) only ever produces *candidates*. A human review-and-approval step is mandatory before any automated suggestion becomes a billable, financial item. The system must never silently create or send a financial artifact.

### 7.3 Business-separation principle
Each business profile is a distinct financial entity. Data, clients, services, invoices, and revenue reporting must not blend across business profiles. Switching the active business context is an explicit, visible user action — never inferred or silent.

### 7.4 Financial-record integrity principle
Once a financial record (an invoice, a payment) is finalized, it is treated as an authoritative record of what happened. Later correction of a mistake happens through controlled, visible mechanisms (e.g., documented correction/void behavior — see [11-unresolved-decisions.md](11-unresolved-decisions.md) for what exactly this mechanism is), never through silent in-place editing of historical values.

## 8. Technology Direction (from governing specification)

The governing documents establish a technology direction — this is documented for continuity into architecture phases, and is **not implemented in Phase 0**:

- Application: Next.js + TypeScript
- Hosting: Vercel
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth or an equivalent secure authentication mechanism
- Calendar integration: Google Calendar API via OAuth 2.0
- Email: a transactional email provider (specific provider not yet selected)
- Documents: server-generated PDF invoices
- Infrastructure principle: avoid unnecessary infrastructure

See [21] of the governing prompt and [12-phase-0-summary.md](12-phase-0-summary.md) for how this carries into Phase 2 prerequisites.

## 9. Relationship to Traditional Accounting Software

This product is **not** a general ledger, not a bookkeeping platform, and not a QuickBooks-class accounting system. It does not perform double-entry bookkeeping, does not produce balance sheets or full financial statements, and does not manage accounts payable, payroll, or general-ledger-level accounting.

It is a **billing and revenue-tracking tool**: it manages the client-facing billing cycle (invoice → send → payment) and reports revenue derived from that cycle. Where the owner needs full accounting, tax filing, or financial statements, that remains the responsibility of the owner's accountant/bookkeeper and their accounting software — this system is expected to feed information to that process, not replace it.

## 10. Explicit Statement: Not a Full Accounting System

**This system is not a full accounting system.** It does not replace professional bookkeeping or tax preparation. It does not determine the business's tax obligations, does not file tax returns, and does not provide tax or accounting advice. Every place where the system touches tax (GST/HST) or revenue recognition, it must rely on business-specific facts and decisions supplied by the owner or their accountant — not on assumptions invented by the system. See [04-canadian-billing-and-tax-audit.md](04-canadian-billing-and-tax-audit.md).

## 11. Non-Goals Reference

A complete list of explicitly out-of-scope functionality is maintained in [09-scope-boundary.md](09-scope-boundary.md) and must be treated as binding during implementation.
