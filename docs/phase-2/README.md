# Phase 2 — System Architecture & Data Model Definition

Status: Draft for Project Director review
Phase: 2

## Purpose

Phase 2 converts the approved Phase 0 product requirements and Phase 1 accounting/billing behavioral rules into a precise technical architecture and conceptual data model. It defines what entities exist, how they relate, which values are immutable, which are derived, and which invariants the implementation must enforce.

**Phase 0 defines product requirements and boundaries. Phase 1 defines accounting and billing behavior. Phase 2 defines the technical architecture required to implement those approved behaviors.**

Phase 2 does **not** authorize implementation. No application code, database migrations, API routes, or UI may be created based on Phase 2 alone — Project Director review is required before Phase 3.

## Relationship to Prior Phases

| Phase | Governs |
|---|---|
| Phase 0 | Product definition, functional/non-functional requirements, Canadian tax baseline, security, Calendar requirements, scope |
| Phase 1 | Accounting basis, invoice lifecycle, numbering, finalization, corrections, payments, revenue reporting, tax/pricing, money/rounding, historical records, auditability |
| Phase 2 | Domain model, data model, entity fields, invariants, boundaries, reporting queries, architecture decisions |

Phase 0 and Phase 1 documents are locked and must not be modified during Phase 2.

## Phase 2 Scope

Phase 2 produces documentation only:

- Conceptual architecture overview and system boundaries
- Domain and data models
- Entity field specifications
- Invoice state machine and invariants
- Financial calculation model
- Tax configuration model
- Payment and reversal model
- Historical provenance model
- Audit trail model
- Google Calendar boundary
- Business isolation and authorization model
- Security and data protection architecture
- Reporting and query model
- Implementation invariants
- Architecture decision register
- Phase 2 summary

## Phase 2 Exclusions

Phase 2 explicitly does **not** produce:

- Application source code
- Database migrations or executable SQL schema
- ORM models
- API route implementations
- UI components or pages
- Authentication/OAuth implementation
- Google Calendar integration code
- Tests as implementation artifacts
- Seed data
- Deployment or environment configuration
- Package/dependency installation

Conceptual schema notation, field tables, relationship diagrams, pseudocode, invariants, and architectural diagrams within documentation are permitted.

## Document Index

| Document | Subject |
|---|---|
| [01-architecture-overview.md](01-architecture-overview.md) | Conceptual system architecture and workflow |
| [02-system-boundaries.md](02-system-boundaries.md) | In-scope vs. out-of-scope boundaries |
| [03-domain-model.md](03-domain-model.md) | Domain entities, lifecycles, ownership |
| [04-data-model.md](04-data-model.md) | Complete conceptual data model and relationships |
| [05-entity-field-specification.md](05-entity-field-specification.md) | Field-level specification for every entity |
| [06-invoice-state-and-invariants.md](06-invoice-state-and-invariants.md) | Invoice lifecycle, transitions, immutability |
| [07-financial-calculation-model.md](07-financial-calculation-model.md) | Computational formulas and derivation rules |
| [08-tax-configuration-model.md](08-tax-configuration-model.md) | Effective-dated tax configuration |
| [09-payment-and-reversal-model.md](09-payment-and-reversal-model.md) | Payment, reversal, void interaction |
| [10-historical-data-and-provenance-model.md](10-historical-data-and-provenance-model.md) | Historical import and provenance |
| [11-audit-trail-model.md](11-audit-trail-model.md) | Append-only audit event model |
| [12-google-calendar-boundary.md](12-google-calendar-boundary.md) | Calendar assistive boundary |
| [13-business-isolation-and-authorization-model.md](13-business-isolation-and-authorization-model.md) | Business scoping and access control |
| [14-security-and-data-protection-architecture.md](14-security-and-data-protection-architecture.md) | Security architecture controls |
| [15-reporting-and-query-model.md](15-reporting-and-query-model.md) | Reporting bases and query concepts |
| [16-implementation-invariants.md](16-implementation-invariants.md) | Definitive invariant list for Phase 3 |
| [17-architecture-decision-register.md](17-architecture-decision-register.md) | Formal architecture decision register |
| [18-phase-2-summary.md](18-phase-2-summary.md) | Phase 2 summary and Phase 3 prerequisites |

## Authoritative Document Hierarchy

When documents conflict, resolve in this order:

1. Phase 0 governing product requirements and scope boundary
2. Phase 1 accounting and billing behavioral rules
3. Phase 2 architecture and data model (must not contradict 1 or 2)

Phase 2 may elaborate technical representation but must not silently change Phase 1 behavioral decisions.

## Unresolved Items Carried Forward

The following Phase 1 items remain unresolved and are not decided by Phase 2 architecture:

1. Business A historical invoice-numbering reconciliation with new sequential scheme
2. Fiscal-year vs. calendar-year YTD reporting requirement
3. Professional confirmation of tax calculation sequence and rounding convention
4. Specific zero-rated/exempt service classifications
5. Period attribution for corrected invoices (replacement counted in own period, not backdated)

Phase 2 documents how the architecture accommodates these without prematurely selecting answers.
