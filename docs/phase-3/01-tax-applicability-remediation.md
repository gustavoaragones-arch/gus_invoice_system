# Phase 3 — Tax Applicability Remediation

Status: Remediation complete, pending Project Director review
Phase: 3

## Problem

Phase 2 §07 Section 9 contains a mixed-tax-group worked example in which:

- Line A is GST taxable ($500.00)
- Line B is PST taxable ($300.00)
- GST 5% is calculated on $500.00
- PST 7% is calculated on $300.00

That example implies line-level tax-group applicability. However, the approved Phase 1 and Phase 2 data model does not define a field or rule that establishes which configured tax groups apply to which individual invoice lines. `InvoiceLineItem` carries `taxStatus` (taxable / zero-rated / exempt) and a single derived `taxGroupKey` at finalization, but nothing selects which of a business's several configured tax lines a given line belongs to.

## Current Implementation (Before Remediation)

The Phase 3 tax engine (`src/server/domain/taxCalculation.ts`, function `calculateInvoice`) applied **every** configured tax line to the **same** full taxable invoice subtotal. For example, a business configured with GST 5% and PST 7% and a single $1,000.00 taxable line produced:

- GST group: $1,000.00 × 5% = $50.00
- PST group: $1,000.00 × 7% = $70.00
- Total tax: $120.00

This was a documented implementation interpretation, not an explicit Phase 1/2 requirement. It selected one competing interpretation (common taxable invoice base) without authority to do so.

## Determination

The approved Phase 1 and Phase 2 requirements do **not** provide sufficient authority to choose between these competing interpretations:

**Model A — Common taxable invoice base**

Every configured tax group applies to the same eligible taxable invoice subtotal.

**Model B — Line-level tax applicability**

Different tax groups may apply to different invoice lines, requiring explicit line-level applicability information.

Phase 1 §07 Step 3 states that each taxable line is assigned to exactly one tax group, and Step 5 groups taxable line subtotals by tax type/authority + applicable rate — language consistent with Model B. Phase 2 §07 Section 9's worked example is also consistent with Model B. However, no approved field or rule implements the line-to-tax-group assignment mechanism Model B requires. Model A is not explicitly approved either.

## Containment

The executable system now prevents an unapproved interpretation from generating finalized financial records:

1. `isTaxApplicabilityResolvable(taxLines)` returns `true` only when the business tax configuration contains **at most one** configured tax line.
2. `calculateInvoice` throws `UnresolvedTaxApplicabilityError` when more than one configured tax line is present.
3. `finalizeInvoice` calls `calculateInvoice` during its binding calculation sequence, so finalization cannot proceed under an ambiguous multi-group configuration.
4. No `InvoiceTaxLine` rows, tax totals, or finalized invoice financial values are persisted when the error is thrown.
5. Unambiguous single-group tax calculation, mixed tax-status lines (taxable / zero-rated / exempt), independent rounding, revenue exclusion, and historical import (which preserves caller-supplied tax values without recalculation) are unchanged.

## Required Professional Decision

Before the system can support invoices under a business tax configuration with more than one configured tax group, the Project Director and professional Canadian tax review must establish:

1. Whether tax groups apply to a common taxable invoice base under the approved model; **or**
2. Whether tax applicability must be represented at invoice-line level, and if so, what approved accounting/data rule and field specification defines that applicability.

This remediation does not recommend either outcome.

## Files Changed

- `src/server/domain/errors.ts` — added `UnresolvedTaxApplicabilityError`
- `src/server/domain/taxCalculation.ts` — added `isTaxApplicabilityResolvable`; `calculateInvoice` now blocks ambiguous multi-group configurations
- `src/server/http/errorResponse.ts` — maps the new error to HTTP 422
- `tests/unit/taxCalculation.test.ts` — multi-group test converted to unresolved-applicability containment test
- `tests/integration/financialCalculations.test.ts` — multi-group finalization tests converted to containment tests
- `tests/unit/money.test.ts` — Section 9 test clarified as isolated primitive arithmetic only
