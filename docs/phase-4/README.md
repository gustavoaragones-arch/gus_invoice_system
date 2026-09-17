# Phase 4 — Application Workflow & Core UI

Status: Implementation complete, pending Project Director review
Phase: 4

## Objective

Deliver the first complete user-facing billing workflow on top of the approved Phase 3 domain and persistence foundation:

```text
Business → Clients → Services → Invoice Draft → Invoice Review → Finalize
```

Phase 4 does not introduce new accounting rules, tax assignment fields, invoice lifecycle states, or schema changes.

## Implemented Routes

| Route | Purpose |
|---|---|
| `/` | Redirects to overview or login |
| `/login` | Development email sign-in |
| `/overview` | Operational summary |
| `/clients` | Client list with search |
| `/clients/new` | Create client |
| `/clients/[id]` | Edit client |
| `/services` | Service list |
| `/services/new` | Create service |
| `/services/[id]` | Edit service |
| `/invoices` | Invoice list |
| `/invoices/new` | Create draft invoice |
| `/invoices/[id]` | Draft editor or finalized/void read-only view |
| `/invoices/[id]/review` | Pre-finalization review |

## UI Architecture

- **Next.js App Router** with server components for initial data loading
- **Server actions** for authenticated mutations
- **Application layer** (`src/server/application/`) between UI and Phase 3 domain functions
- **Small custom design system** in `src/app/globals.css` and reusable components under `src/components/`
- **No global state library**; business context stored in an httpOnly cookie and validated server-side

## Server / Client Boundaries

- All financial calculations, finalization, void, and authorization remain in the Phase 3 domain layer
- UI may show non-authoritative preview subtotals while editing, but tax/total values on review and finalized views come from server preview/finalized records
- Client components are limited to forms, dialogs, business selector, and navigation affordances

## Authentication

- Session cookie (`session_token`) stores a Supabase-compatible HS256 JWT
- `middleware.ts` protects application routes
- `/login` provisions a local user record and establishes a session
- API routes continue to accept Bearer tokens for programmatic access

## Business Isolation

- Selected business stored in `selected_business_id` cookie
- Every application operation resolves the selected business and calls `assertBusinessAccess`
- UI business selector is not a security mechanism; server authorization remains authoritative

## Invoice Lifecycle UI

- Draft invoices are editable
- Review screen shows billing identity, line items, and server-calculated summary
- Finalization calls `finalizeInvoice` through the application layer
- Finalized invoices are read-only and display frozen billed client/business snapshots
- Void and replacement draft entry points use existing Phase 3 domain operations

## Tax Applicability Containment

- Single configured tax group: supported end-to-end
- Multiple configured tax groups: review/finalization blocked with a professional explanation
- UI does not calculate multiple tax groups independently or invent line-level tax assignment

## Tests

Application workflow tests live in `tests/application/phase4Workflow.test.ts` and run with the integration test suite.

Coverage includes:

- client create/edit/list
- service create/edit/list
- draft invoice create/edit/preview/finalize
- unresolved tax applicability blocking
- finalized snapshot independence from later client edits
- business isolation
- Draft → Finalized → Void lifecycle

## Known Limitations

- Development email sign-in only; no live Supabase Auth UI integration yet
- No Google Calendar sync, email sending, PDF generation, payment recording UI, or reporting dashboards
- Multi-tax-group applicability remains unresolved per Phase 3 remediation
- Business must exist before workflow can begin; no in-app business creation UI beyond existing API capability

## Explicitly Out of Scope

Calendar synchronization, payments UI, reporting dashboards, recurring billing, inventory, public API, PDF/email, tax rule invention, and all items listed in the Phase 4 brief Section 27.
