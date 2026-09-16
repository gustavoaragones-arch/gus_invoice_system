# 12 — Google Calendar Boundary

Status: Draft for Project Director review
Phase: 2

## 1. Critical Principle

Google Calendar is an **assistive evidence source**, not an authoritative financial source.

```
Calendar Event → Work Candidate → Review → Invoice Draft
```

Never:

```
Calendar Event → Automatic Invoice
```

## 2. Separate Conceptual Objects

| Object | Role | Financial? |
|---|---|---|
| CalendarConnection | OAuth link per Business | No |
| SelectedCalendar | Calendar chosen as source | No |
| CalendarEvent | Retrieved event snapshot | No |
| WorkCandidate | Suggested billable work | No (until approved) |
| InvoiceLineItem | Authoritative billed item | Yes (on finalized invoice) |

## 3. Calendar Connection

- One or more per Business
- Stores OAuth tokens server-side only (encrypted)
- Disconnection invalidates tokens (SEC-REVOKE-001)
- Does not delete approved WorkCandidates or line items (SEC-REVOKE-002)

## 4. Calendar Event

| Field Category | Purpose |
|---|---|
| sourceEventId | Google's event identifier |
| sourceConnectionId | Which connection retrieved it |
| title, start, end, description | Matching signals |
| retrievedAt | Sync metadata |
| lastModifiedAt | Duplicate detection input |

System does not edit Google's event. Stores retrieval snapshot.

## 5. Work Candidate

| Field Category | Purpose |
|---|---|
| calendarEventId | Source reference |
| reviewState | pending / edited / approved / rejected |
| clientId, serviceId | Matched or user-assigned |
| editedDescription, editedQuantity | User corrections |
| matchConfidence | **UNRESOLVED** display model |

### Lifecycle

```
Created (on sync)
  → Edited (optional)
  → Approved → becomes Invoice Line Item
  → Rejected → retained for audit/duplicate detection
```

Approved candidates are not billable until converted to line item on an invoice.

## 6. Review Gate

Architecture invariant: No Calendar-derived data enters Invoice financial fields without:
1. WorkCandidate in approved state
2. Explicit user approval action
3. Audit event (Work candidate approved)

Bulk approval, if offered, must audit each item individually.

## 7. Duplicate Detection

Architecture must support (algorithm **UNRESOLVED**):
- Same source event not creating duplicate candidates
- Approved candidate not offered again
- Rejected candidate not resurfacing without user action

Fields enabling detection: `sourceEventId`, `lastModifiedAt`, `reviewState`.

## 8. Prohibited Behaviors

| Prohibited | Reason |
|---|---|
| Auto-create invoice from event | Phase 0 critical rule |
| Auto-create payment from event | Out of scope |
| Treat event as financial record | Evidence only |
| Edit Google event from system | Read-only (CAL-SCOPE-001) |
| Cross-business event visibility | SEC-ISO-001 |

## 9. Audit Chain

```
CalendarEvent.id
  → WorkCandidate.calendarEventId
  → InvoiceLineItem.workCandidateId
  → Invoice (finalized)
```

Full chain reconstructable via audit events and provenance fields.

## 10. OAuth Boundary

- Tokens: server-side, encrypted, never client-exposed
- Scope: minimum read-only Calendar access
- Per-business scoping: token usable only for owning Business's connection
- Implementation deferred to Phase 3+

## 11. Unresolved Algorithmic Decisions (Preserved)

- Client/service matching algorithm
- Confidence model
- Duplicate detection algorithm
- Recurring event treatment
- Cancelled/edited event treatment
- Event identity across syncs

Architecture provides entities and states; algorithms deferred.
