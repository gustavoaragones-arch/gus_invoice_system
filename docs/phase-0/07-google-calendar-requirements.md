# 07 — Google Calendar Requirements

Status: Draft for Project Director review
Phase: 0

## 1. Workflow (Authoritative Shape)

```
Google Calendar → Retrieved Events → Matching → Candidate Work → User Review → Approval → Invoice Line Item
```

Every stage before "Approval" produces only *evidence* or *candidates*. Nothing before "Approval" is a financial record, and nothing crosses into "Invoice Line Item" without an explicit, per-item user approval action.

## 2. Critical Rules (Non-Negotiable)

- **The system must never assume every calendar event is billable.** Retrieval and matching only ever produce candidate suggestions.
- **The system must never silently create an invoice or financial record from an uncertain Calendar event.** Every Candidate Work item requires explicit user review and approval before it can become an Invoice Line Item (see FR-CAL-008 through FR-CAL-012).
- These rules apply regardless of match confidence — even a high-confidence match remains a candidate until approved.

## 3. OAuth

- CAL-OAUTH-001: The system shall use Google OAuth 2.0 to obtain access to a connected Google account's Calendar data, on a per-Business basis (one Calendar Connection belongs to one Business — see 05-data-requirements.md).
- CAL-OAUTH-002: The requested OAuth scope shall be the minimum necessary for the required functionality. Initial access is read-only (CAL-SCOPE-001) — no scope that allows creating, editing, or deleting the user's Google Calendar events should be requested unless a future phase explicitly justifies it.
- CAL-OAUTH-003: OAuth tokens must be handled per 06-security-requirements.md (SEC-OAUTH-001 through 004): encrypted at rest, server-side only, never exposed to the client, and scoped to exactly one Business's connection.

## 4. Calendar Selection

- CAL-SEL-001: After connecting a Google account, the user shall be able to select which specific Google Calendar(s) (of potentially several under that account) are used as the event source for the active Business.
- CAL-SEL-002: Calendars not selected shall not be queried or have their events retrieved.

## 5. Read-Only Initial Access

- CAL-SCOPE-001: The initial Calendar integration is read-only with respect to the user's Google Calendar — the system reads events; it does not create, modify, or delete events in Google Calendar.

## 6. Date Ranges and Event Retrieval

- CAL-RET-001: The user shall be able to specify a date range (e.g., a billing period) for which Calendar events are retrieved.
- CAL-RET-002: Retrieval shall be scoped to the selected Calendar(s) (CAL-SEL-001) under the active Business's Calendar Connection only.
- CAL-RET-003: Retrieved events shall be stored/represented as Calendar Event records sufficient for matching and audit (see 05-data-requirements.md).

## 7. Client Matching

- CAL-MATCH-001: The system shall attempt to match a retrieved Calendar Event to an existing Client of the active Business, using event content (e.g., title, description, attendees — exact signal set is an architecture-phase decision).
- CAL-MATCH-002: A Calendar Event that cannot be confidently matched to a Client shall still be presented as Candidate Work, with the Client field left for the user to complete, rather than being silently discarded or silently assigned. **[UNRESOLVED → whether an unmatched event is shown by default or requires the user to opt in to seeing "unmatched" candidates — see 11-unresolved-decisions.md]**

## 8. Service Matching

- CAL-MATCH-003: The system shall attempt to match a retrieved Calendar Event to an existing Service of the active Business, using event content.
- CAL-MATCH-004: As with Client matching, an unmatched Service shall not block presentation of the Candidate Work item — the user completes/corrects it during review.

## 9. Confidence / Review State

- CAL-CONF-001: The system shall communicate to the user some indication of match confidence/quality for each Candidate Work item (e.g., matched vs. unmatched vs. partially matched), so the user can prioritize review. **[UNRESOLVED → the exact confidence model (binary matched/unmatched vs. a scored/tiered confidence) is not specified by the governing documents — see 11-unresolved-decisions.md]**
- CAL-CONF-002: No numeric confidence score, if one is ever introduced, shall be presented as a substitute for user review — it is a sorting/prioritization aid only.

## 10. Candidate Work

- CAL-CAND-001: A Candidate Work item is the system's suggestion that a given Calendar Event represents billable work; it is never itself billable (see 05-data-requirements.md, Candidate Work entity; and Critical Rules, Section 2 above).
- CAL-CAND-002: A Candidate Work item shall retain a reference to its source Calendar Event and the active Business, for audit purposes (FR-CAL-013).

## 11. Duplicate Detection

- CAL-DUP-001: The system shall attempt to detect when a Calendar Event has already produced a Candidate Work item (e.g., from a prior sync of an overlapping date range) to avoid presenting duplicate suggestions to the user.
- CAL-DUP-002: The system shall attempt to detect when a Candidate Work item has already been approved and converted to an Invoice Line Item, so it is not offered again as a new candidate.
- CAL-DUP-003: The exact algorithm for duplicate detection (e.g., matching on Google event ID and last-modified timestamp, vs. a broader heuristic) is not specified by the governing documents. **[UNRESOLVED → see 11-unresolved-decisions.md]**

## 12. Repeated Synchronization

- CAL-SYNC-001: The user shall be able to re-run Calendar retrieval for a date range more than once (e.g., after adding new events, or to catch up a previously un-synced range) without duplicating already-reviewed Candidate Work (see CAL-DUP-001/002).
- CAL-SYNC-002: A rejected Candidate Work item shall not resurface as a new candidate on the same source event in a later sync unless the user takes an action indicating they want to reconsider it. **[UNRESOLVED → exact re-surfacing rule — see 11-unresolved-decisions.md]**

## 13. User Edits

- CAL-EDIT-001: The user shall be able to edit a Candidate Work item's client, service, description, and quantity/duration before approving it (FR-CAL-009).
- CAL-EDIT-002: Edits to a Candidate Work item shall not alter the underlying Google Calendar event (read-only access, CAL-SCOPE-001) or the stored Calendar Event record (CAL-RET-003) — edits apply only to the derived Candidate Work.

## 14. Rejection

- CAL-REJ-001: The user shall be able to reject a Candidate Work item, marking it as not billable.
- CAL-REJ-002: A rejected Candidate Work item shall be retained (not deleted) for audit/duplicate-detection purposes (see CAL-SYNC-002), even though it will never become an Invoice Line Item.

## 15. Approval

- CAL-APR-001: The user shall be able to approve a Candidate Work item individually (not only in bulk), converting it into an Invoice Line Item on a specific invoice (draft or new).
- CAL-APR-002: Bulk approval, if offered, must still represent each item's approval individually for audit purposes (i.e., bulk approval is a UI convenience, not a different data operation) and must never approve items the user has not had the opportunity to review.

## 16. Auditability

- CAL-AUDIT-001: For every Invoice Line Item that originated from Calendar-assisted work, the system shall retain the chain: Calendar Event → Candidate Work → (edits, if any) → Approval → Invoice Line Item (see FR-CAL-013, Invoice/Work Relationship entity in 05-data-requirements.md).

## 17. Disconnect

- CAL-DISC-001: The user shall be able to disconnect a Calendar Connection for the active Business at any time (FR-CAL-014).
- CAL-DISC-002: Disconnecting shall invalidate the stored OAuth tokens (SEC-REVOKE-001) and stop future retrieval, but shall not delete or alter previously approved Candidate Work, Invoice Line Items, or audit records (SEC-REVOKE-002).

## 18. Token Security

- CAL-TOKEN-001: See 06-security-requirements.md, SEC-OAUTH. Restated here for completeness: tokens are encrypted at rest, server-side only, never exposed to the client, and scoped to one Business.

## 19. Failure Handling

- CAL-FAIL-001: If the Google Calendar API is unavailable or returns an error during retrieval, the system shall surface this to the user rather than silently returning an empty or partial result set without explanation (see NFR-ERR-002).
- CAL-FAIL-002: A failed sync shall not mark any Candidate Work as reviewed/approved, and shall not affect previously synced/approved data.

## 20. Unresolved Algorithmic Decisions (Explicitly Deferred, Not Invented Here)

The following are **not decided** by this document and must be resolved by the Project Director/architecture phase, informed by real usage patterns:

- The exact client/service matching algorithm or signal set (title parsing, attendee email matching, keyword rules, etc.).
- The exact confidence model and whether/how it is displayed.
- The exact duplicate-detection algorithm.
- Treatment of recurring Calendar events (e.g., a weekly recurring meeting — one Candidate Work per occurrence, or an aggregate).
- Treatment of cancelled events discovered on a later sync (i.e., an event previously synced as Candidate Work that is later cancelled in Google Calendar).
- Treatment of edited events (e.g., a meeting's time or attendees changed after being synced but before being reviewed/approved).
- The precise identity rule for "the same event" across syncs (needed to support duplicate detection and re-sync behavior).

These are recorded in full in [11-unresolved-decisions.md](11-unresolved-decisions.md).
