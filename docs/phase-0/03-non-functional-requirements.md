# 03 — Non-Functional Requirements

Status: Draft for Project Director review
Phase: 0

These requirements describe qualities the system must exhibit. Where a requirement could be satisfied by more than one implementation choice, this document states the requirement only — the choice belongs to the architecture phase (Phase 2) unless the governing documents already fix it (see [21] Technology Direction in the governing prompt, carried into [01-product-definition.md](01-product-definition.md)).

## NFR-SEC — Security
- NFR-SEC-001: Only the authenticated business owner/administrator may access the system in its initial release (single-owner access model — see [06-security-requirements.md](06-security-requirements.md)).
- NFR-SEC-002: All access to business-owned data must be authorized server-side; client-side/UI restrictions alone are not sufficient (see 06).
- NFR-SEC-003: Business isolation (FR-BUS-006/007) must be enforceable at the data/authorization layer, not only presented correctly in the UI.
- NFR-SEC-004: OAuth tokens, API keys, and other secrets must never be exposed to the client/browser or logged in plaintext.

## NFR-PRIV — Privacy
- NFR-PRIV-001: Client personal/billing information and Calendar data are sensitive and must be handled with the same care as financial records (access-controlled, not exposed in logs or error messages).
- NFR-PRIV-002: The system must not transmit business or client data to third parties beyond what is required for the stated integrations (Google Calendar, email delivery, PDF generation, hosting/database providers).

## NFR-ACC — Financial Accuracy
- NFR-ACC-001: All monetary calculations (line item totals, subtotals, tax, invoice totals, payment balances, revenue aggregates) must be deterministic and reproducible from stored inputs — no calculation may depend on client-side floating point display alone for authoritative values.
- NFR-ACC-002: Tax amounts must be calculated only from an explicitly configured, business-specific tax treatment — never a default, inferred, or hard-coded rate (see [04-canadian-billing-and-tax-audit.md](04-canadian-billing-and-tax-audit.md)).
- NFR-ACC-003: Rounding behavior for tax and totals must be explicitly defined and applied consistently (see 04, and [11-unresolved-decisions.md](11-unresolved-decisions.md) for the specific rounding rule to be confirmed).

## NFR-INT — Data Integrity
- NFR-INT-001: Finalized invoices and recorded payments are authoritative financial history and must not be silently altered (see financial-record integrity principle, 01).
- NFR-INT-002: Any post-finalization correction must be recorded through a defined, auditable mechanism rather than an untracked edit (see 11-unresolved-decisions.md).
- NFR-INT-003: Referential integrity must be preserved across the workflow chain (Business → Client → Invoice → Line Item → Payment → Revenue) such that every reported revenue figure is traceable to source records.

## NFR-ISO — Business Isolation
- NFR-ISO-001: No feature of the initial system may present, calculate, or export data that combines more than one business profile's financial information (see FR-BUS-008).
- NFR-ISO-002: Business isolation must hold even under multi-business growth (see 01, product philosophy) without requiring a database redesign.

## NFR-AVAIL — Availability
- NFR-AVAIL-001: As a private, single-owner application, the system does not require multi-region high-availability infrastructure; availability appropriate to a small, actively-used business tool (i.e., generally available during normal business use, with reasonable tolerance for brief maintenance windows) is sufficient.
- NFR-AVAIL-002: The system should avoid a single point of failure that would make historical financial records inaccessible (see backup/recovery, below).

## NFR-PERF — Performance
- NFR-PERF-001: Common interactive operations (viewing a client list, opening an invoice, viewing dashboard/revenue figures) should respond within a timeframe appropriate for a professional, actively-used financial tool (specific latency targets are an architecture-phase decision, not fixed by the governing documents).
- NFR-PERF-002: Calendar retrieval and matching, which depend on an external API, should not block or degrade the responsiveness of unrelated parts of the application.

## NFR-ACCESS — Accessibility
- NFR-ACCESS-001: The application must follow accessibility practices appropriate for a professional business tool (keyboard navigability, sufficient contrast, semantic structure), consistent with the UX Guidelines (see [19] in governing prompt, captured in this document and in workflow/UX-adjacent sections).
- NFR-ACCESS-002: Accessibility implementation specifics (WCAG level, assistive-technology testing scope) are deferred to the phase that implements the design system.

## NFR-RESP — Responsive Behavior
- NFR-RESP-001: The application is desktop-first, per the UX Guidelines, and must remain usable on common desktop/laptop viewport sizes.
- NFR-RESP-002: The governing UX Guidelines establish a desktop-first responsive application; specific breakpoints/behavior are a design-system implementation decision for a later phase.

## NFR-USE — Usability
- NFR-USE-001: The workflow must remain simple and focused (per governing UX principle) — the system must not be allowed to accumulate general-purpose accounting features that dilute the core Business→Client→Work→Invoice→Payment→Revenue flow.
- NFR-USE-002: Error states, empty states, and status language must be clear and use explicit financial terms (see UX governing principle "clear status language," "explicit financial labels").

## NFR-MAINT — Maintainability
- NFR-MAINT-001: The data model must be structured so that adding a new Canadian business profile does not require a fundamental redesign (see FR-BUS-007).
- NFR-MAINT-002: The system should avoid unnecessary infrastructure and dependencies (per governing technology direction, [21]) to keep the codebase maintainable by a small/solo engineering effort.

## NFR-AUDIT — Auditability
- NFR-AUDIT-001: The system must retain sufficient information to reconstruct how an invoice's line items were derived, including which came from approved candidate work and which calendar event(s) informed them (see FR-CAL-013).
- NFR-AUDIT-002: The system must retain sufficient information to reconstruct the history of payments against an invoice.
- NFR-AUDIT-003: Post-finalization corrections (once the mechanism is defined — see 11-unresolved-decisions.md) must be individually auditable (who/when/what changed), not overwritten in place.

## NFR-ERR — Error Handling
- NFR-ERR-001: User-facing errors must be understandable and specific enough to act on (per UX governing principle "understandable errors") without exposing internal system details or secrets.
- NFR-ERR-002: Failures in external integrations (Google Calendar API, email delivery, PDF generation) must be surfaced to the user rather than failing silently (see FR-DEL-006, FR-CAL-014).

## NFR-OBS — Observability / Logging
- NFR-OBS-001: The system should log significant financial state transitions (invoice finalized, payment recorded, invoice sent) sufficient to support later auditability and troubleshooting, without logging sensitive secrets (tokens, credentials) or unnecessary personal data.
- NFR-OBS-002: Specific logging/monitoring tooling is an architecture-phase decision, subject to the "avoid unnecessary infrastructure" principle.

## NFR-BACKUP — Backup / Recovery
- NFR-BACKUP-001: The database holding financial records must be backed up on a schedule sufficient to prevent loss of finalized invoices and payment history in the event of failure or accidental deletion.
- NFR-BACKUP-002: Recovery procedures/testing are an architecture/operations-phase decision; Phase 0 establishes only that backup/recovery capability is a requirement, not optional.

## NFR-REL — Reliability
- NFR-REL-001: Financial calculations (totals, tax, balances, revenue) must produce the same result given the same inputs, independent of when or how many times they are computed (no non-deterministic financial logic).
- NFR-REL-002: External integration failures (Calendar, email, PDF) must not corrupt or partially commit financial records (e.g., a failed email send must not mark an invoice as sent).

## NFR-EXT — Extensibility for Future Canadian Businesses
- NFR-EXT-001: The system must be designed so a new Canadian business profile can be onboarded (business record, settings, and isolation) using existing data-model constructs, without new tables/relationships fundamentally reshaping the existing model (see FR-BUS-007, NFR-MAINT-001).
- NFR-EXT-002: Extensibility is explicitly scoped to *additional Canadian business profiles* under the same single owner — not to multi-tenant SaaS, external customers, or non-Canadian jurisdictions (see [09-scope-boundary.md](09-scope-boundary.md)).

## Distinguishing Requirements from Implementation Choices

This document intentionally does not select: specific latency numbers, specific WCAG conformance level, specific logging/monitoring vendor, specific backup frequency/RPO/RTO targets, or specific hosting/runtime configuration. Those are implementation choices to be made in Phase 2 (Architecture) in a way that satisfies the requirements stated above, consistent with the "avoid unnecessary infrastructure" principle from the governing technology direction.
