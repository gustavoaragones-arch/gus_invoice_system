# 17 — Architecture Decision Register

Status: Draft for Project Director review
Phase: 2

Formal register of architecture decisions. IDs stable once accepted. Status: `Proposed` for all entries pending Project Director review.

| ID | Topic | Decision | Classification | Rationale | Affected Entities | Implementation Consequence | Source | Status |
|---|---|---|---|---|---|---|---|---|
| DEC-ARCH-001 | Domain entity set | Use single Invoice model for historical and live; no LegacyInvoice | ARCHITECTURE RULE | DEC-HIST-001 | Invoice, all financial entities | One model, provenance field | Phase 1 | Proposed |
| DEC-ARCH-002 | Invoice tax snapshot | Store InvoiceTaxLine per tax group at finalization | ARCHITECTURE RULE | Reproduce calculation; no retroactive recalc | Invoice, InvoiceTaxLine | Frozen tax lines on invoice | DEC-TAX-002, CFG-TAX-005 | Proposed |
| DEC-ARCH-003 | Tax configuration versioning | TaxConfigurationVersion per Business with effective dates | ARCHITECTURE RULE | Effective-dating requirement | TaxConfigurationVersion, Invoice | Version history preserved | Phase 0 CFG-TAX-005 | Proposed |
| DEC-ARCH-004 | Payment reversal model | Separate PaymentReversal entity linked to Payment | ARCHITECTURE RULE | DEC-PAY-004 additive correction | Payment, PaymentReversal | Reversal record, not deletion | Phase 1 | Proposed |
| DEC-ARCH-005 | Invoice correction linkage | replacedInvoiceId / replacementInvoiceId on Invoice | ARCHITECTURE RULE | DEC-INV-008 uniform mechanism | Invoice | Bidirectional correction link | Phase 1 | Proposed |
| DEC-ARCH-006 | Derived indicators | Payment Status, Overdue, Delivery Status computed at query time | ARCHITECTURE RULE | DEC-INV-001 minimal state set | Invoice, Payment, InvoiceSendAttempt | No stored flags that can drift | Phase 1 | Proposed |
| DEC-ARCH-007 | Delivery status | InvoiceSendAttempt append-only log | ARCHITECTURE RULE | Reconstructable send history | Invoice, InvoiceSendAttempt | Log-based delivery status | Phase 0 FR-DEL | Proposed |
| DEC-ARCH-008 | Work candidate entity | WorkCandidate separate from CalendarEvent and InvoiceLineItem | ARCHITECTURE RULE | Review gate before financial data | WorkCandidate, CalendarEvent | Pre-financial review state | Phase 0 CAL-CAND | Proposed |
| DEC-ARCH-009 | Audit storage | Dedicated AuditEvent entity, append-only | ARCHITECTURE RULE | DEC-AUDIT-001, 14 event types | AuditEvent | Immutable audit table/collection | Phase 1 | Proposed |
| DEC-ARCH-010 | Business isolation key | businessId on all business-owned entities | SECURITY CONSTRAINT | SEC-ISO-001 | All business entities | Mandatory filter on all queries | Phase 0 | Proposed |
| DEC-ARCH-011 | Atomic finalization | Transactional finalization with number allocation | IMPLEMENTATION CONSTRAINT | DEC-INV-005 | Invoice | DB transaction or equivalent | Phase 1 | Proposed |
| DEC-ARCH-012 | Captured line values | Line items store captured rate/description, not live Service ref | ARCHITECTURE RULE | FR-SVC-006, FR-INV-014 | InvoiceLineItem, Service | Snapshot at finalization | Phase 0 | Proposed |
| DEC-ARCH-013 | Provenance field | provenance enum: system-created, historical-import | ARCHITECTURE RULE | DEC-HIST-002 | Invoice, optionally others | Import path identification | Phase 1 | Proposed |
| DEC-ARCH-014 | Field verification | fieldVerification map for unverified historical fields | ARCHITECTURE RULE | DEC-HIST-007 | Invoice | Explicit uncertainty display | Phase 1 | Proposed |
| DEC-ARCH-015 | Revenue query basis | Revenue from preTaxSubtotal, not invoiceTotal | ARCHITECTURE RULE | DEC-ACC-001 | Invoice, reporting | Reporting queries use pre-tax | Phase 1 | Proposed |
| DEC-ARCH-016 | OAuth token storage | Server-side encrypted storage per CalendarConnection | SECURITY CONSTRAINT | SEC-OAUTH-001 | CalendarConnection | No client token exposure | Phase 0 | Proposed |
| DEC-ARCH-017 | Calendar read-only | No write scope to Google Calendar | ARCHITECTURE RULE | CAL-SCOPE-001 | CalendarConnection | Read-only integration | Phase 0 | Proposed |
| DEC-ARCH-018 | No cross-business reporting | All reports filtered by businessId | ARCHITECTURE RULE | FR-BUS-008, scope boundary | Reporting | No aggregate queries | Phase 0 | Proposed |
| DEC-ARCH-019 | Database technology | PostgreSQL/Supabase is inherited Phase 0 technology direction; exact Phase 3 persistence implementation mechanism (ORM/data-access approach and executable schema) remains UNRESOLVED | UNRESOLVED | Phase 0 technology direction | All persistence | Phase 3 selects ORM/access pattern and executable schema approach | Phase 0 §8 | Proposed |
| DEC-ARCH-020 | Row-level security | Enforce business isolation at data layer where supported | SECURITY CONSTRAINT | SEC-ISO-004 | All business entities | RLS policies or equivalent | Phase 0 | Proposed |
| DEC-ARCH-021 | Invoice numbering reconciliation | Business A historical vs new sequence reconciliation | UNRESOLVED | DEC-INV-003, DEC-HIST-005 | Invoice | Accommodate both; decision deferred | Phase 1 open item | Proposed |
| DEC-ARCH-022 | Fiscal year YTD | Calendar year default; fiscal year support not built | UNRESOLVED | DEC-ACC-002 | Reporting | Configurable period if needed later | Phase 1 open item | Proposed |
| DEC-ARCH-023 | Calendar matching algorithm | Client/service matching algorithm not defined | UNRESOLVED | Phase 0 CAL-MATCH | WorkCandidate | Pluggable matching; algorithm deferred | Phase 0 | Proposed |
| DEC-ARCH-024 | Calendar confidence model | Match confidence display model not defined | UNRESOLVED | CAL-CONF-001 | WorkCandidate | Field exists; algorithm deferred | Phase 0 | Proposed |
| DEC-ARCH-025 | Calendar duplicate detection | Duplicate detection algorithm not defined | UNRESOLVED | CAL-DUP-001 | WorkCandidate, CalendarEvent | Detection fields; algorithm deferred | Phase 0 | Proposed |
| DEC-ARCH-026 | Payment method enumeration | Configurable/enumerable, not fixed list | BUSINESS CONFIGURATION | DEC-PAY-005 | Payment | Free-form or configurable enum | Phase 1 | Proposed |
| DEC-ARCH-027 | Invoice number format | Display format not fixed; prefix/digits open | BUSINESS CONFIGURATION | DEC-INV-009 | Invoice | Format configuration per business | Phase 1 | Proposed |
| DEC-ARCH-028 | Tax rate defaults | No system-default tax rates | BUSINESS CONFIGURATION | Phase 0 CFG-TAX | TaxConfigurationVersion | Owner supplies all rates | Phase 0 | Proposed |
| DEC-ARCH-029 | Zero-rated/exempt classification | Structurally supported; specific services unresolved | PROFESSIONAL CONFIRMATION REQUIRED | Phase 1 open item | Service, InvoiceLineItem | Tax status per service | Phase 1 | Proposed |
| DEC-ARCH-030 | Period attribution for corrections | Replacement counted in own period, not backdated | PROFESSIONAL CONFIRMATION REQUIRED | DEC-INV-008 | Invoice, reporting | No backdating in system | Phase 1 open item | Proposed |
| DEC-ARCH-031 | Finalized invoice billed client snapshot | A finalized Invoice stores an immutable `billedClientSnapshot` sufficient to reproduce client identity/billing information as issued; live `clientId` remains the relationship reference | ARCHITECTURE RULE | Phase 1 finalization immutability requires client identity as billed | Invoice, Client | Snapshot captured at finalization; immutable thereafter | Phase 1 §04-finalization Section 2 | Proposed |
| DEC-ARCH-032 | Finalized invoice billed business snapshot | A finalized Invoice stores an immutable `billedBusinessSnapshot` sufficient to reproduce business identity/branding as issued; live `businessId` remains the ownership/isolation reference | ARCHITECTURE RULE | Phase 1 finalization immutability requires business identity/branding as printed | Invoice, Business | Snapshot captured at finalization; immutable thereafter | Phase 1 §04-finalization Section 2 | Proposed |

**Total decisions: 32**
