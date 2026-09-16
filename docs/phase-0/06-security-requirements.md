# 06 — Security Requirements

Status: Draft for Project Director review
Phase: 0

These are requirements Phase 2 (Architecture) and later implementation phases must satisfy. Phase 0 does not implement any of this — no authentication, authorization, or security code is written here.

## SEC-AUTH — Authentication
- SEC-AUTH-001: The system must require authentication for any access to business, client, financial, or Calendar data. No route or API exposing such data may be reachable unauthenticated.
- SEC-AUTH-002: Authentication must use a secure, standard mechanism (per governing technology direction: Supabase Auth or an equivalent secure mechanism) — not a custom-rolled credential scheme.

## SEC-AUTHZ — Authorization / Single-Owner Access Model
- SEC-AUTHZ-001: The initial system has exactly one authorized user (the business owner/administrator). Every authenticated request must be verified as belonging to that owner before any data is returned or modified.
- SEC-AUTHZ-002: The single-owner model must not be hard-coded in a way that makes future multi-user or delegated-access support (if ever authorized) impossible to add without redesign — but no such multi-user support is in scope now (see 09-scope-boundary.md).

## SEC-ISO — Business-Level Isolation
- SEC-ISO-001: Every business-owned record (Client, Service, Invoice, Line Item, Payment, Calendar Connection, Candidate Work, Settings) must be enforceably associated with exactly one Business at the data layer.
- SEC-ISO-002: **UI-level business switching is explicitly NOT sufficient for business isolation.** The active-business selector in the interface is a convenience for the user; it must never be the mechanism that prevents cross-business data exposure.
- SEC-ISO-003: Every server-side query and mutation that reads or writes business-owned data must independently enforce the business-association constraint (SEC-ISO-001), regardless of what the client/UI claims the "active business" is.
- SEC-ISO-004: Where the database layer supports enforceable row-level constraints (e.g., PostgreSQL row-level security, as available in the governing Supabase direction), business isolation should be enforced at that layer as a defense-in-depth measure, not solely in application code. The specific mechanism is a Phase 2 decision, but the requirement that isolation be enforced beneath the application layer, not only within it, is binding.

## SEC-SRV — Server-Side Authorization
- SEC-SRV-001: All authorization decisions (which user may see/modify which record) must be enforced server-side. Client-side checks (hiding UI elements, disabling buttons) are usability aids only and must never be relied upon as the security boundary.

## SEC-DB — Database-Level Enforcement
- SEC-DB-001: The database schema and access layer must make it structurally difficult (not merely discouraged by convention) to read or write a record across business boundaries. See SEC-ISO-004.

## SEC-FIN — Financial Records
- SEC-FIN-001: Finalized invoices and payments must be protected from unauthorized modification (see NFR-INT-001/002) — this is both a data-integrity and a security requirement, since unauthorized modification of financial history is a security failure, not just a bug.
- SEC-FIN-002: Access to financial data (invoices, payments, revenue reports) must be limited to the authenticated owner (SEC-AUTHZ-001) and scoped to the correct business (SEC-ISO).

## SEC-CLI — Client Information
- SEC-CLI-001: Client billing/contact information must be treated as sensitive business data — protected by the same authentication/authorization boundary as financial records, not exposed in public routes, logs, or error messages.

## SEC-CAL — Calendar Data
- SEC-CAL-001: Retrieved Calendar Events and derived Candidate Work must be scoped to the Business whose Calendar Connection produced them (see SEC-ISO-001) and must not be visible from another business context.
- SEC-CAL-002: Calendar data (event titles/descriptions, which may reference clients or business activity) must be treated as sensitive.

## SEC-OAUTH — OAuth Credentials / Tokens
- SEC-OAUTH-001: Google OAuth tokens (access and refresh tokens) must be stored encrypted at rest and must never be exposed to the browser/client or included in client-visible responses.
- SEC-OAUTH-002: OAuth tokens must be associated with exactly one Business's Calendar Connection and must never be usable to retrieve data into a different business's context.
- SEC-OAUTH-003: Token refresh and use must occur server-side only.
- SEC-OAUTH-004: The initial Calendar integration should request the minimum OAuth scope necessary (read-only Calendar access — see FR-CAL, 07-google-calendar-requirements.md) rather than broader Google account permissions.

## SEC-SECRETS — Secrets
- SEC-SECRETS-001: API keys, OAuth client secrets, database credentials, and email-provider credentials must be stored using a secure secrets mechanism (e.g., platform environment variables managed outside source control), never committed to the repository or hard-coded.
- SEC-SECRETS-002: No secret may be logged in plaintext (see NFR-OBS-001).

## SEC-API — API Endpoints
- SEC-API-001: Every API endpoint that reads or writes business, client, financial, or Calendar data must enforce SEC-AUTH-001, SEC-AUTHZ-001, and SEC-ISO-001/003.
- SEC-API-002: API endpoints must validate that the requested resource (e.g., an invoice ID) actually belongs to the authenticated owner's active/claimed business context before acting on it — not merely trust a client-supplied business identifier.

## SEC-INPUT — Input Validation
- SEC-INPUT-001: All user-supplied input (invoice fields, client data, search queries, Calendar sync parameters) must be validated server-side before use in calculations, storage, or queries, to prevent malformed or malicious data from corrupting financial records or enabling injection-style attacks.

## SEC-ERR — Error Messages
- SEC-ERR-001: Error messages returned to the client must not leak internal implementation details, stack traces, secrets, or data belonging to another business (see NFR-ERR-001).

## SEC-LOG — Logging
- SEC-LOG-001: Logs must capture enough information to support troubleshooting and audit (see NFR-OBS-001, NFR-AUDIT) without logging secrets, full OAuth tokens, or unnecessary sensitive personal/client data.

## SEC-AUDIT — Auditability
- SEC-AUDIT-001: Significant financial and Calendar-approval actions must be attributable and reconstructible after the fact (see NFR-AUDIT), which is both a compliance and a security-forensics requirement (e.g., in the event of unauthorized access, the owner must be able to determine what was viewed/changed).

## SEC-BACKUP — Backups
- SEC-BACKUP-001: Backups containing financial and client data must be protected with the same access controls and encryption expectations as the production data they contain — a backup is not exempt from the security requirements above merely because it is not the primary database.

## SEC-EXPOSE — Data Exposure
- SEC-EXPOSE-001: No business, client, financial, or Calendar data may be exposed via a public/unauthenticated route, a client-side bundle, or a third-party service beyond what is strictly required for the stated integrations (Google Calendar, email delivery, PDF generation, hosting/database).

## SEC-SESSION — Session Security
- SEC-SESSION-001: User sessions must use secure, industry-standard session/token handling (e.g., secure cookies, appropriate expiration) consistent with the chosen authentication mechanism (SEC-AUTH-002). Specific session lifetime/renewal policy is a Phase 2 decision.

## SEC-REVOKE — Disconnect / Revocation Behavior
- SEC-REVOKE-001: Disconnecting a Calendar Connection (FR-CAL-014) must invalidate/delete the stored OAuth tokens for that connection, not merely hide the connection in the UI.
- SEC-REVOKE-002: Revocation must not delete previously approved Candidate Work or the Invoice Line Items/audit trail derived from it (see NFR-AUDIT) — only stop future retrieval.

---

## Binding Statement

**Business-level isolation must ultimately be enforceable such that every business-owned record is associated with exactly one Business at the data/security level, independent of anything the UI does or claims.** This principle (SEC-ISO-002/003) governs how Phase 2 must design authorization and is non-negotiable within the scope of this project.
