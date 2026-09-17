# Phase 5 — Invoice Delivery & Payment Recording

## Objective

Phase 5 extends the approved billing workflow from finalization into delivery and payment recording:

```text
Business → Client → Work → Invoice → Finalize → Send → Payment → Revenue
```

This phase does not introduce general accounting, payment processing, or new invoice lifecycle states.

## Delivery Architecture

Delivery is implemented as an application workflow backed by the approved `InvoiceSendAttempt` entity and a replaceable email provider boundary.

### Provider abstraction

- `src/server/delivery/types.ts` — `EmailProvider` interface
- `src/server/delivery/emailProvider.ts` — provider factory
- `src/server/delivery/developmentEmailProvider.ts` — deterministic development/test provider

`EMAIL_PROVIDER=development` is the supported local/test configuration. The development provider validates destination addresses and records messages in server logs only. It does not deliver to a real mailbox and must not be described as production delivery.

Production email delivery remains pending provider configuration. Setting `EMAIL_PROVIDER` to any non-development value without a configured production integration throws a server-side configuration error.

### Email content

`src/server/delivery/emailContent.ts` builds professional invoice email content from finalized invoice snapshots and line items. The email includes:

- sender/business identity
- client identity
- invoice number
- invoice date
- invoice total
- balance due

The email does not invent payment instructions, bank details, payment links, or unsupported tax claims. It does not alter invoice financial data.

### PDF dependency

Phase 0 delivery requirements reference PDF delivery. The approved Phase 3/4 implementation does not yet include a PDF generation mechanism. Phase 5 therefore stops at the approved delivery boundary and sends the currently available invoice representation in email body form only. PDF attachment support remains an unresolved dependency.

## Send Workflow

```text
Finalized Invoice
→ Review delivery details
→ Send
→ Record InvoiceSendAttempt
→ Show result
```

Rules:

- Only `FINALIZED` invoices may be sent.
- `DRAFT` and `VOID` invoices are rejected.
- Each send creates a new `InvoiceSendAttempt`.
- Resend preserves prior attempts.
- Delivery does not modify invoice number or financial values.
- Destination email is validated at send time.
- Destination is stored in audit metadata (`INVOICE_SEND_ATTEMPTED`) because the approved `InvoiceSendAttempt` schema does not include a destination field.

Delivery status is derived from attempt history. No new persisted invoice lifecycle state such as `Sent` or `Delivered` was introduced.

## InvoiceSendAttempt Behavior

Each attempt records:

- invoice identity
- attempt timestamp
- result status (`SUCCESS` or `FAILURE`)
- error message when supported

Failed provider attempts are persisted within the send transaction. The application layer throws only after the transaction commits, so failed attempts remain visible in delivery history.

## Payment Workflow

Payment recording uses the existing Phase 3 domain layer in `src/server/domain/payments.ts`.

### Payment creation

Payments may be recorded only against finalized, non-void invoices. Each payment stores:

- amount
- payment date
- optional method
- optional notes

Amount and payment date are immutable after creation.

### Payment history

The finalized invoice page shows payment date, amount, method, reversal status, and notes. Reversed payments remain visible.

### Reversal

Corrections use:

```text
Original Payment → Payment Reversal → New Correct Payment
```

Reversal:

- references the original payment
- preserves the original payment
- prevents double reversal
- updates derived balance due

### Overpayment

Overpayments are allowed. The application surfaces overpayment through derived financial summary values and does not cap or silently absorb excess payment amounts.

### Balance calculation

Authoritative balance values come from the domain layer:

```text
Balance Due = Invoice Total − Non-Reversed Payments
Overpayment = max(0, Amount Paid − Invoice Total)
```

The UI displays derived values only; it does not perform its own money arithmetic.

## Business Isolation

All delivery and payment operations are business-scoped through the existing Phase 3 authorization model:

- `assertBusinessAccess`
- invoice ownership checks in application wrappers

A user cannot send, view, record, or reverse payments for another business's invoices.

## UI

The finalized invoice page is the post-finalization workspace and includes:

- financial summary
- delivery send + history
- payment history
- record payment
- reverse payment

Confirmation dialogs are required for send, payment recording, and reversal.

## Tests

Phase 5 adds `tests/application/phase5Workflow.test.ts` covering:

- finalized send success
- draft/void send rejection
- failed attempt recording
- resend attempt preservation
- payment record/reject draft/void
- reversal and double-reversal rejection
- overpayment surfacing
- void invoice payment retention
- replacement invoice zero payments
- business isolation
- balance formula integrity

Existing Phase 0–4 tests remain required and must continue passing.

## Known Limitations

- No production email provider integration yet
- No PDF attachment support
- `InvoiceSendAttempt` has no persisted destination field; destination is available from audit metadata and billed client snapshot
- Payment method remains optional free text per approved schema
- Multi-tax-group finalization containment remains unresolved
- No accounting reports, fiscal-year logic, or payment processor integration

## Explicitly Out of Scope

- Google Calendar synchronization
- automatic invoice generation
- tax filing / CRA remittance
- general ledger or accounting reports
- payment processor integration
- bank feeds / reconciliation
- recurring invoices / subscriptions
- multi-currency
- public API
- mobile native application
