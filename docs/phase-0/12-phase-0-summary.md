# 12 — Phase 0 Summary

Status: Draft for Project Director review
Phase: 0 — Requirements & Documentation Baseline

## Phase 0 Objective

Establish the complete requirements specification for the Canadian Private Billing System before any application architecture or implementation begins: product definition, functional and non-functional requirements, Canadian billing/tax requirements, data requirements, security requirements, Google Calendar requirements, user workflows, scope boundary, risk register, and unresolved decisions requiring Project Director/business input.

## Confirmed Project Definition

A private, single-owner Canadian billing and revenue-management application covering the workflow Business → Client → Work/Calendar Activity → Review → Invoice → Send → Payment → Revenue, differentiated by Google Calendar-assisted work detection. Two initial Canadian business profiles are supported (Business A: existing, with historical data; Business B: new, clean). The data model must support additional Canadian business profiles later without fundamental redesign. Full detail: [01-product-definition.md](01-product-definition.md).

## Confirmed Scope

Business profiles, clients, services, invoices (manual and Calendar-assisted), payments, revenue reporting, Google Calendar integration (read-only, review-gated), and invoice delivery (PDF + email) — all scoped per business, for a single owner. Full detail: [02-functional-requirements.md](02-functional-requirements.md), [09-scope-boundary.md](09-scope-boundary.md).

## Confirmed Exclusions

Payroll, employee management, inventory, purchase orders, accounts payable, full AR management, bank reconciliation, general ledger, double-entry bookkeeping, balance sheet/financial statements, expense management, budgeting/forecasting, international tax/multi-country accounting, USD accounting, SaaS subscription billing, payment processing, marketplace functionality, public multi-tenant SaaS, public registration, complex team permissions, CRM functionality, and advanced accounting integrations. None of these may be introduced without explicit Project Director authorization. Full list: [09-scope-boundary.md](09-scope-boundary.md).

## Major Accounting Findings

Revenue recognition basis, invoice lifecycle state set, invoice-number assignment timing, post-finalization correction/void mechanism, and overpayment handling are all unresolved and require Project Director/accountant decisions before they can be implemented — none have been assumed. Full detail: [11-unresolved-decisions.md](11-unresolved-decisions.md), Accounting/Invoice Lifecycle/Payments sections.

## Major Canadian Compliance Findings

Primary-sourced from canada.ca (retrieved 2026-09-15): the $30,000 small-supplier GST/HST registration threshold; place-of-supply-dependent GST/HST rates (5% GST-only provinces/territories; 13% Ontario HST; 15% HST in NB/NL/PE; 14% HST in Nova Scotia since April 1, 2025); separately-administered provincial PST/RST (BC, SK, MB) and QST (Quebec, via Revenu Québec) outside the CRA's GST/HST framework; tiered invoice/receipt documentation requirements for input tax credits using the current $100/$500 thresholds effective April 20, 2021 (the $30/$150 figures still displayed in GST/HST Memorandum 8-4 are historical); and a 6-year recordkeeping retention requirement. **No GST/HST registration status, applicable rate, or tax treatment has been assumed for either business — this remains a business-specific determination requiring the owner's/accountant's confirmation.** Full detail with sources: [04-canadian-billing-and-tax-audit.md](04-canadian-billing-and-tax-audit.md).

## Major Security Requirements

Single-owner authentication; server-side and database-level enforcement of business isolation (explicitly, UI-level business switching is not sufficient); encrypted, server-side-only handling of OAuth tokens and secrets; server-side authorization on every API endpoint; and auditability of financial and Calendar-approval actions. Full detail: [06-security-requirements.md](06-security-requirements.md).

## Major Calendar Requirements

Calendar activity is evidence, never an authority. The system must never assume a calendar event is billable and must never silently convert an uncertain event into an invoice line item — every candidate work item requires explicit user review and per-item approval. Matching algorithm, confidence model, and duplicate-detection rules are intentionally left as unresolved design decisions rather than invented in Phase 0. Full detail: [07-google-calendar-requirements.md](07-google-calendar-requirements.md).

## Major Unresolved Decisions

Grouped by area — Accounting (6), Invoice Lifecycle (5), Tax (6, several requiring business-specific facts), Payments (3), Calendar (7, some requiring real Calendar sample data), Email (3), and Existing Business A Data (7, requiring owner-supplied source material before migration). Full list with rationale: [11-unresolved-decisions.md](11-unresolved-decisions.md).

## Key Risks

Highest-severity items from the risk register: incorrect invoice calculations/tax treatment, business data leakage across profiles, incorrect revenue calculations, invoice/payment duplication, unauthorized modification of historical financial records, Calendar false-positive/negative detection leading to duplicate or missed billing, OAuth credential exposure, and data-migration/incomplete-historical-data risk for Business A. Full register: [10-risk-register.md](10-risk-register.md).

## Architecture Prerequisites

Before Phase 2 (Architecture) can proceed to a concrete database schema and application design, the following should be resolved or explicitly accepted as open by the Project Director:
- The invoice-lifecycle state set and correction/void mechanism (UD-LIFE, UD-ACC).
- The revenue-recognition basis (UD-ACC-001/002).
- Business-specific GST/HST registration and rate facts for Business A and Business B, or an explicit decision to build the configuration mechanism now and populate the facts later (UD-TAX-001/002).
- The technology direction in [01-product-definition.md](01-product-definition.md) Section 8, which is already fixed by the governing documents and does not require further decision.

## Recommendation

Phase 0 implementation/documentation is ready for Project Director review.
