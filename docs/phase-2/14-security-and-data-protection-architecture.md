# 14 — Security and Data Protection Architecture

Status: Draft for Project Director review
Phase: 2

Translates Phase 0 security requirements to architecture-level controls. Does not implement security. Does not claim legal compliance.

## 1. Authentication Boundary

- All business, client, financial, and Calendar data requires authentication (SEC-AUTH-001)
- Secure standard mechanism (SEC-AUTH-002) — specific provider is implementation choice
- Sessions: secure token/cookie handling (SEC-SESSION-001)

## 2. Authorization

- Single owner in initial release (SEC-AUTHZ-001)
- Every request verified as owner before data access
- Not hard-coded in a way that blocks future multi-user (SEC-AUTHZ-002)

## 3. Business Isolation

See [13-business-isolation-and-authorization-model.md](13-business-isolation-and-authorization-model.md).

- SEC-ISO-001 through SEC-ISO-004
- Defense-in-depth: application + data layer

## 4. Server-Side Enforcement

- SEC-SRV-001: Authorization server-side only
- SEC-API-001/002: Every endpoint enforces auth + business scope
- SEC-INPUT-001: Server-side input validation

## 5. Sensitive Financial Data

| Data | Protection |
|---|---|
| Invoices, payments | Auth + business scope; immutable post-finalization |
| Client billing info | SEC-CLI-001; same auth boundary |
| Revenue reports | Owner-only, business-scoped |

## 6. OAuth Tokens / Credentials

| Requirement | Architecture |
|---|---|
| SEC-OAUTH-001 | Encrypted at rest, server-side only |
| SEC-OAUTH-002 | Scoped to one Business's connection |
| SEC-OAUTH-003 | Refresh/use server-side only |
| SEC-OAUTH-004 | Minimum read-only Calendar scope |
| SEC-REVOKE-001 | Disconnect invalidates tokens |

Never exposed to browser/client.

## 7. Secrets

- SEC-SECRETS-001: Environment/secrets manager, not source control
- SEC-SECRETS-002: No secrets in logs

## 8. Audit Data

- Append-only AuditEvent storage
- SEC-AUDIT-001: Attributable, reconstructible
- Not editable or deletable

## 9. Immutable Financial Records

- SEC-FIN-001: Finalized invoices and payments protected from unauthorized modification
- Enforcement via lifecycle rules + authorization + immutability constraints

## 10. Encryption Expectations

| Data | Expectation |
|---|---|
| OAuth tokens | Encrypted at rest |
| Database | Platform-managed encryption (implementation) |
| Backups | SEC-BACKUP-001 — same protection as production |
| Transit | TLS for all external communication |

## 11. Logging

- SEC-LOG-001: Sufficient for troubleshooting and audit
- No secrets, full tokens, or unnecessary PII in logs
- SEC-ERR-001: Error messages do not leak internals or cross-business data

## 12. Backup / Recovery

- SEC-BACKUP-001: Backups protected equivalently to production
- Supports Phase 0 NFR-BACKUP and CRA recordkeeping (6-year retention posture)
- Specific backup mechanism: implementation decision

## 13. Data Deletion

- Finalized financial records: no deletion within retention window
- Draft invoices: deletable before finalization
- Audit events: never deleted
- Calendar disconnect: stops future retrieval; preserves historical approved data

## 14. Data Exposure

- SEC-EXPOSE-001: No public/unauthenticated routes for business data
- No financial data in client bundles

## 15. What This Document Does Not Claim

- Legal compliance certification
- CRA audit approval
- Specific encryption algorithm choices (implementation)
- Penetration test results
