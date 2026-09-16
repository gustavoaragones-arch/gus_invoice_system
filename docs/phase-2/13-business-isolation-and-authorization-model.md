# 13 — Business Isolation and Authorization Model

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Define how business-level isolation is enforced conceptually. UI switching is not sufficient (SEC-ISO-002).

## 2. Business-Scoped Entities

Every entity below carries immutable `businessId` or derives it through an immutable parent chain:

| Entity | businessId |
|---|---|
| Client | Direct |
| Service | Direct |
| Invoice | Direct |
| InvoiceLineItem | Via Invoice |
| InvoiceTaxLine | Via Invoice |
| Payment | Via Invoice |
| PaymentReversal | Via Payment → Invoice |
| TaxConfigurationVersion | Direct |
| CalendarConnection | Direct |
| SelectedCalendar | Via Connection |
| CalendarEvent | Via Connection |
| WorkCandidate | Direct |
| AuditEvent | Direct |
| InvoiceSendAttempt | Via Invoice |

## 3. Authorization Model (Initial Release)

| Layer | Rule |
|---|---|
| Authentication | Single owner must be authenticated (SEC-AUTH-001) |
| Authorization | Authenticated owner may access their businesses only |
| Business context | UI selector is convenience; server validates businessId on every operation |
| Resource access | Invoice/Payment/Client ID must belong to claimed business before action |

No multi-user roles in initial release. Architecture must not hard-code single-user in a way that prevents future extension (SEC-AUTHZ-002).

## 4. Enforcement Points

Isolation must be enforced at:

1. **Application layer**: Every query/mutation filters by businessId
2. **Data layer**: Structural constraints (e.g., row-level security) as defense-in-depth (SEC-ISO-004)
3. **API layer**: Resource ownership verified before read/write (SEC-API-002)

UI hiding is usability only, not security (SEC-SRV-001).

## 5. Invoice Numbering Isolation

- Sequential sequence scoped per Business (DEC-INV-003)
- Business A numbers independent of Business B
- Number allocation atomic within business scope

## 6. Reporting Isolation

- All reports computed within one Business
- No cross-business combined figures (OUT OF SCOPE)
- Revenue, Sales Tax, Amount Collected, Outstanding — all per-business

## 7. Payment Isolation

Payment belongs to Invoice. Invoice belongs to Business. Payment cannot move between invoices or businesses.

## 8. Calendar Isolation

CalendarConnection scoped to Business. Events and WorkCandidates retrieved through that connection belong to that Business only. Token cannot retrieve into another Business's context (SEC-OAUTH-002).

## 9. Audit Isolation

AuditEvents scoped to Business. Cross-business audit access prohibited.

## 10. Prohibited Patterns

| Pattern | Why Prohibited |
|---|---|
| Trust client-supplied businessId without verification | SEC-API-002 |
| Rely on UI active-business for data filtering alone | SEC-ISO-002 |
| Combined multi-business revenue report | OUT OF SCOPE |
| Shared invoice numbering across businesses | DEC-INV-003 violation |
