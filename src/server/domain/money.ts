import { Decimal } from "decimal.js";

/**
 * Centralized exact-decimal money engine (Section 8 of the Phase 3 brief;
 * Phase 1 §08-money-and-rounding-rules.md; Phase 2 §07-financial-calculation-model.md).
 *
 * No financial calculation anywhere in this codebase may use native
 * JavaScript number arithmetic on money. Every function here operates on
 * `Decimal` (decimal.js — the same library Prisma's `Decimal` fields use
 * internally, so values pass between this module and Prisma without
 * conversion loss).
 *
 * Rounding convention: round-half-up to the nearest cent (DEC-MONEY-003 /
 * INV-RND-001) — a defensible, common default; Phase 1 flags it as still
 * requiring professional confirmation before reliance on real filings
 * (see docs/phase-1/07-tax-and-pricing-rules.md §4). This module does not
 * decide that question — it implements the rule Phase 1 currently states.
 */

// decimal.js default rounding mode ROUND_HALF_UP matches our requirement
// exactly; set it explicitly so this module's behavior does not silently
// depend on a global default someone else's import order might change.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

const CENT = new Decimal("0.01");

/** Round a Decimal to the nearest cent, half-up (INV-RND-001). */
export function roundToCent(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Parse an arbitrary numeric input into a Decimal without float drift. */
export function toDecimal(value: Decimal | string | number): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/**
 * DEC-MONEY-004/005: quantity and unit price are each stored with up to 2
 * decimal places, full stop — not silently rounded/truncated to fit.
 * Callers must validate with this *before* persisting, so an over-precise
 * input is rejected with a clear error rather than quietly losing
 * precision (accuracy-before-convenience, Phase 0 §01) and then having a
 * later recalculation (e.g. at finalization, from the now-truncated
 * stored value) produce a different, silently wrong result.
 */
export function hasAtMostDecimalPlaces(value: Decimal, places: number): boolean {
  return value.decimalPlaces() <= places;
}

export function isNonNegative(value: Decimal): boolean {
  return value.greaterThanOrEqualTo(0);
}

export function isPositive(value: Decimal): boolean {
  return value.greaterThan(0);
}

export const ZERO = new Decimal(0);

/**
 * Line Subtotal = Quantity × Unit Price, rounded half-up to the cent
 * (Phase 2 §07 Section 2 / INV-RND-002).
 */
export function calculateLineSubtotal(quantity: Decimal, unitPrice: Decimal): Decimal {
  return roundToCent(quantity.times(unitPrice));
}

/**
 * Pre-Tax Subtotal = Σ (already-rounded) line subtotals (Phase 2 §07
 * Section 3). No further rounding — every input is already cent-precise.
 */
export function sumLineSubtotals(lineSubtotals: Decimal[]): Decimal {
  return lineSubtotals.reduce((sum, line) => sum.plus(line), ZERO);
}

/**
 * Tax Group Amount = Group Taxable Subtotal × rate, rounded once per group
 * (Phase 2 §07 Section 5 / INV-RND-003). Never blend rates, never apply a
 * global rate (INV-TAX-006).
 */
export function calculateTaxGroupAmount(taxableSubtotal: Decimal, rate: Decimal): Decimal {
  return roundToCent(taxableSubtotal.times(rate));
}

/** Total Tax = Σ (already-rounded) tax group amounts (Phase 2 §07 Section 6). */
export function sumTaxGroups(taxGroupAmounts: Decimal[]): Decimal {
  return taxGroupAmounts.reduce((sum, group) => sum.plus(group), ZERO);
}

/**
 * Invoice Total = Pre-Tax Subtotal + Total Tax (Phase 2 §07 Section 7 /
 * INV-RND-004). No further rounding.
 */
export function calculateInvoiceTotal(preTaxSubtotal: Decimal, totalTax: Decimal): Decimal {
  return preTaxSubtotal.plus(totalTax);
}

/**
 * Amount Paid = Σ amount of non-reversed Payments on an invoice
 * (DEC-PAY-001 / Phase 2 §07 Section 13).
 */
export function sumNonReversedPayments(amounts: Decimal[]): Decimal {
  return amounts.reduce((sum, amount) => sum.plus(amount), ZERO);
}

/** Balance Due = MAX(0, Invoice Total − Amount Paid) (DEC-PAY-001). */
export function calculateBalanceDue(invoiceTotal: Decimal, amountPaid: Decimal): Decimal {
  const diff = invoiceTotal.minus(amountPaid);
  return Decimal.max(ZERO, diff);
}

/** Overpayment = MAX(0, Amount Paid − Invoice Total) (DEC-PAY-001). */
export function calculateOverpayment(invoiceTotal: Decimal, amountPaid: Decimal): Decimal {
  const diff = amountPaid.minus(invoiceTotal);
  return Decimal.max(ZERO, diff);
}

export { Decimal };
