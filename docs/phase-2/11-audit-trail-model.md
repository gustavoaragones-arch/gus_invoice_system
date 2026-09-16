# 11 — Audit Trail Model

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Conceptual append-only AuditEvent model satisfying Phase 1 requirements.

## 2. AuditEvent Entity

| Field | Required | Immutable |
|---|---|---|
| id | Yes | Yes |
| eventType | Yes | Yes |
| timestamp | Yes | Yes |
| businessId | Yes | Yes |
| actorUserId | Yes | Yes |
| entityType | Yes | Yes |
| entityId | Yes | Yes |
| priorValues | When change | Yes |
| newValues | When applicable | Yes |
| metadata | Optional | Yes |

**Append-only**: Audit events are never edited or deleted.

## 3. Required Event Types (14 — Preserved)

| # | Event Type | Trigger |
|---|---|---|
| 1 | Invoice created (Draft) | New draft invoice |
| 2 | Invoice finalized | Draft → Finalized |
| 3 | Invoice send attempted | Send action |
| 4 | Invoice voided | Finalized → Void |
| 5 | Replacement invoice created | Correction finalization with link |
| 6 | Payment recorded | New payment |
| 7 | Payment reversed | Reversal created |
| 8 | Payment method/note corrected | Non-financial payment edit |
| 9 | Tax configuration changed | New TaxConfigurationVersion |
| 10 | Business branding/settings changed | Invoice-affecting settings |
| 11 | Work candidate approved | Approval → line item |
| 12 | Work candidate rejected | Rejection |
| 13 | Work candidate edited | Pre-approval edit |
| 14 | Calendar connection established/disconnected | OAuth connect/disconnect |

## 4. Prior Value Preservation (DEC-AUDIT-001)

Events representing changes must capture prior values:

- Tax configuration changes
- Payment reversals (original amount/date)
- Business settings affecting invoice appearance

Additive events (creation, recording) have no prior value.

## 5. Business Scoping

Every AuditEvent carries `businessId` of the affected entity's business. No cross-business audit queries without explicit authorization (none authorized).

## 6. Actor

`actorUserId` populated on every event. Single-owner model today; field exists for future extensibility (SEC-AUTHZ-002).

## 7. Calendar Chain Reconstruction

Audit trail must support tracing:

```
Calendar Event → Work Candidate → (edits) → Approval → Invoice Line Item → (correction) Void + Replacement
```

Achieved via:
- WorkCandidate audit events
- InvoiceLineItem.workCandidateId provenance
- Invoice replacement linkage
- Payment audit events

## 8. Relationship to Application Logs

AuditEvent is not generic application logging. It records financially and approval-material actions only. Operational/debug logs are separate and must not substitute for audit trail.

## 9. Void/Correction Audit Sequence

Correction produces at minimum:
1. Invoice voided (original)
2. Replacement invoice created (on replacement finalization)

Original audit history not altered by void — new events appended.

## 10. Implementation Note

Storage mechanism (dedicated table, event sourcing) is Phase 3 decision. Behavioral requirements are binding.
