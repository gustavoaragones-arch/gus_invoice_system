# Phase 9 — Production Invoice Documents, Email Delivery & Business Setup

## 1. Objective

Complete the production operational layer required for practical invoice use:

```text
Business Setup → Invoice Document → Finalized Invoice → PDF → Email Delivery → Delivery History
```

Phase 9 adds business profile management, deterministic finalized invoice PDF generation, and production-capable email delivery with PDF attachments.

## 2. Implemented Scope

### Business setup

- `/business` — view and edit the selected business profile
- `/business/new` — create a new business profile
- Server-side create/update through `src/server/domain/businessSettings.ts`
- Business settings changes audited with `BUSINESS_SETTINGS_CHANGED`

### Invoice PDF

- Server-side PDF generation in `src/server/pdf/invoicePdf.ts`
- On-demand generation from finalized invoice snapshots and persisted financial values
- `/api/invoices/[id]/pdf` — view inline or download via `?download=1`
- Invoice detail page PDF actions for finalized and void invoices

### Production email delivery

- Extended Phase 5 provider architecture
- `EMAIL_PROVIDER=development` — existing development provider
- `EMAIL_PROVIDER=smtp` — production SMTP provider with PDF attachments
- Finalized invoices only
- Approved fixed subject/body wording
- Each send creates a new `InvoiceSendAttempt`
- Destination confirmation gate in `SendInvoiceDialog`:
  - destination email is visible in the send dialog
  - user must explicitly check confirmation before send is enabled
  - send action is blocked until confirmation is given
  - confirmed destination is passed to the server-side send operation

## 3. Business Setup Behavior

Supported fields match the existing Business model:

- `name`
- `legalName`
- `address`
- `gstHstRegistrationNumber`
- `brandingLogoRef`

Creating a business sets it as the selected business cookie. Editing a business updates future invoices only; finalized invoice snapshots remain frozen.

## 4. PDF Architecture

```text
Invoice detail / API route
    ↓
application/invoicePdf.ts
    ↓
pdf/invoicePdf.ts
    ↓
Frozen billed snapshots + finalized invoice values
```

The PDF layer does not:

- recalculate finalized accounting values
- read live Client or Business records for finalized invoices
- persist generated documents

## 5. Email Provider Architecture

```text
Send invoice UI / action
    ↓
domain/invoiceDelivery.ts
    ↓
delivery/emailContent.ts + pdf/invoicePdf.ts
    ↓
delivery/emailProvider.ts
    ↓
DevelopmentEmailProvider | SmtpEmailProvider
```

## 6. Finalized Snapshot Usage

Finalized and void invoice PDFs and delivery emails use:

- `billedClientSnapshot`
- `billedBusinessSnapshot`
- finalized invoice number, dates, line items, tax lines, totals, and balance information

Live Client and Business records are not used to reconstruct finalized presentation.

## 7. Security Model

- Authentication required for all new routes and actions
- `assertBusinessAccess` enforced in domain/application layers
- RLS remains active through `withAuthorizedTransaction`
- PDF and email operations scoped to the authorized business and invoice
- Secrets remain server-side only

## 8. Environment Variables

| Variable | Purpose |
|---|---|
| `EMAIL_PROVIDER` | `development` or `smtp` |
| `SMTP_HOST` | SMTP host for production delivery |
| `SMTP_PORT` | SMTP port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `EMAIL_FROM` | Sender email address |
| `EMAIL_FROM_NAME` | Optional sender display name |
| `NEXT_PUBLIC_APP_URL` | Existing public app URL |

## 9. Dependencies Added

| Package | Version | Reason |
|---|---|---|
| `pdfkit` | `0.15.2` | Server-side deterministic PDF generation |
| `nodemailer` | `6.9.16` | Production SMTP email delivery with attachments |
| `@types/pdfkit` | `0.13.8` | TypeScript types for PDFKit |
| `@types/nodemailer` | `6.4.17` | TypeScript types for Nodemailer |

No existing dependency provided PDF generation or SMTP attachment delivery.

## 10. Tests Executed

Phase 9 adds `tests/application/phase9Workflow.test.ts` and `tests/unit/invoiceSendConfirmation.test.ts` covering:

- business create/update and audit
- finalized PDF generation
- snapshot immutability against live Client/Business changes
- draft PDF rejection and void PDF viewing
- approved email wording
- finalized send with PDF attachment
- draft/void send rejection
- failed/resend attempt history
- explicit SMTP configuration failure
- business isolation for profile, PDF, and delivery
- destination visibility and explicit confirmation before send
- confirmed destination passed through to delivery audit metadata
- empty destination rejected before send attempt creation

Required validation commands:

```bash
npx tsc --noEmit
npx vitest run --config vitest.config.ts
npx vitest run --config vitest.integration.config.ts
npx next build
```

## 11. Known Limitations

- No persistent document storage; PDFs are generated on demand
- `brandingLogoRef` is displayed as a reference string only; no logo file upload or image rendering pipeline exists
- Draft invoice PDF preview is not implemented
- SMTP is the production email integration; no additional mailbox providers are implemented
- Payment instructions are not included in email or PDF content

## 12. Unresolved Accounting Decisions

Phase 9 does not resolve:

- fiscal-year reporting
- zero-rated/exempt service classification refinements
- corrected-invoice period attribution beyond the existing void/replacement model
- payment-method configuration beyond existing free-text method notes
- logo asset storage and rendering semantics for `brandingLogoRef`

## 13. Explicitly Excluded Functionality

- automatic invoice sending
- new invoice lifecycle states such as "Sent"
- general ledger or accounting engine changes
- tax filing or remittance
- document storage entities
- Prisma schema changes
- changes to Revenue, Amount Collected, Outstanding, payment rules, or invoice lifecycle

## 14. Phase 0–8 Rule Confirmation

Phase 9 consumes existing accounting and lifecycle rules without modifying them.
