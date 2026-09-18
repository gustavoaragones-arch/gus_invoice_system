# Phase 10 — Accounting Administration & Production Readiness

Status: Implementation complete — pending Project Director review  
Phase: 10

## Objective

Establish a controlled accounting-administration layer and production-readiness foundation before further feature expansion:

**Business Configuration → Tax Configuration → Reporting Configuration (documented) → Invoice Administration (preserved) → Production Controls (security, audit, tests)**

Phase 10 explicitly resolves or formally preserves unresolved accounting decisions. It does not redesign Phase 0–9 architecture or alter locked financial definitions.

---

## Implemented scope

### Business administration (Phase 9 review)

- `/business` — edit business profile (`name`, `legalName`, `address`, `gstHstRegistrationNumber`, `brandingLogoRef`)
- Phase 10 adds administration links to tax configuration and reporting
- No new business fields; no logo upload infrastructure

### Tax configuration administration (new)

- `/business/tax` — list versioned tax configurations for the selected business
- `/business/tax/new` — create a new `TaxConfigurationVersion`
- Server-side domain: `createTaxConfigurationVersion`, `listTaxConfigurationVersions`
- Application layer and server action with authentication and business scoping
- Effective-dating: the prior current version's `effectiveTo` is set once, to the day before the new `effectiveFrom` (periods do not overlap)
- Version content (`effectiveFrom`, `isGstHstRegistered`, `taxLines`) is never edited; `effectiveTo` is the only field that changes, and only to close a period
- No retroactive invoice recalculation; already-finalized invoices are unaffected

### Reporting configuration (documented only)

- Calendar-year YTD behavior documented and preserved
- Link from business administration to `/reports`
- No fiscal-year configuration UI

### Not implemented (by design)

- Fiscal-year reporting configuration
- Zero-rated/exempt automatic classification
- Payment-method controlled vocabulary
- Reporting-configuration entity or settings framework
- Logo upload/storage
- Prisma schema or migration changes

---

## Accounting decisions

See [01-accounting-decisions.md](./01-accounting-decisions.md).

| Topic | Status |
|---|---|
| Calendar-year YTD reporting | **APPROVED** — preserved |
| Fiscal-year reporting | **UNRESOLVED** |
| Zero-rated/exempt auto-classification | **UNRESOLVED** |
| Payment method vocabulary | **UNRESOLVED** — free text preserved |
| Corrected-invoice period attribution (system behavior) | **APPROVED** — preserved |
| Professional acceptance of correction period attribution | **UNRESOLVED** |
| Versioned tax configuration administration | **APPROVED** — implemented |

---

## Security model

All Phase 10 administrative operations:

- Require authentication (`getServerAuthContext`)
- Enforce business authorization (`assertBusinessAccess`, `requireSelectedBusiness`)
- Execute server-side through `withAuthorizedTransaction` (RLS enforced)
- Scope strictly to the selected/authorized business

A user cannot list or create tax configuration versions for another business.

---

## Audit behavior

| Event | When |
|---|---|
| `TAX_CONFIGURATION_CHANGED` | New tax configuration version created; includes prior version snapshot when replacing a current version |
| `BUSINESS_SETTINGS_CHANGED` | Business profile updated (Phase 9; unchanged) |

Uses existing append-only `AuditEvent` architecture only. No second audit mechanism.

---

## Tests

`tests/application/phase10Workflow.test.ts`:

- List and create tax configuration versions
- Effective-date versioning (prior version closed)
- `resolveEffectiveTaxConfiguration` selects correct version by date
- `TAX_CONFIGURATION_CHANGED` audit emission
- Business isolation for tax configuration access
- Unauthorized cross-business access blocked
- Calendar YTD reporting behavior preserved
- Invoice finalization and payment recording preserved

All Phase 0–9 tests must continue passing.

---

## Known limitations

1. **Fiscal year:** Calendar YTD only; no configurable fiscal-year start.
2. **Tax lines:** Administrative UI accepts authority/type/rate as configured; no rate validation against jurisdiction tables.
3. **Zero-rated/exempt:** Manual line-level `taxStatus` only; no service-name inference.
4. **Payment method:** Free text; no enumerated list.
5. **Tax configuration:** Create/list only; no edit or delete of version content. Creating a new version closes the prior version's `effectiveTo` (its only modification).
6. **Branding logo:** `brandingLogoRef` is a reference field only; no upload in this phase.
7. **Reporting:** No separate reporting-configuration admin beyond existing `/reports` periods.

---

## Excluded functionality

- Fiscal-year reporting and configuration
- Automatic tax classification or rate selection from service names
- Payment-method vocabulary enforcement
- Generic settings framework
- Dashboard, invoice, calendar, or reporting redesign
- Schema/migration changes
- New dependencies

---

## Validation

Run before Project Director review:

```bash
npx tsc --noEmit
npx vitest run --config vitest.config.ts
npx vitest run --config vitest.integration.config.ts
npx next build
```

---

## Phase 0–9 preservation

Phase 10 does not modify:

- Invoice states (Draft / Finalized / Void) or immutability rules
- Revenue, Amount Collected, or Outstanding definitions
- Void + Replacement correction mechanism
- Invoice number allocation
- Finalized snapshots (`billedClientSnapshot`, `billedBusinessSnapshot`)
- Payment attachment to void invoices
- Calendar evidence-only rules
- Phase 0–9 documentation files
