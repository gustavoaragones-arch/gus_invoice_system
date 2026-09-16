import {
  Decimal,
  calculateInvoiceTotal,
  calculateLineSubtotal,
  calculateTaxGroupAmount,
  sumLineSubtotals,
  sumTaxGroups,
} from "./money";
import { UnresolvedTaxApplicabilityError } from "./errors";

/**
 * Tax grouping and the binding calculation sequence from Phase 2
 * §07-financial-calculation-model.md Section 16, elaborating Phase 1
 * §07-tax-and-pricing-rules.md. This module never invents a tax fact
 * (rate, registration status, applicability) — it only computes from
 * whatever `TaxConfigurationVersion` the caller resolved and passed in
 * (Section 16 of the Phase 3 brief: "Do not hard-code Canadian tax rates").
 */

export type LineTaxStatus = "TAXABLE" | "ZERO_RATED" | "EXEMPT";

export interface DraftLineItemInput {
  /** Caller-assigned identifier used only to correlate results back to input lines. */
  key: string;
  quantity: Decimal;
  unitPrice: Decimal;
  taxStatus: LineTaxStatus;
}

/** One tax line from the business's resolved TaxConfigurationVersion. */
export interface ConfiguredTaxLine {
  taxAuthority: string;
  taxType: string;
  rate: Decimal;
}

export interface CalculatedLineItem {
  key: string;
  quantity: Decimal;
  unitPrice: Decimal;
  lineSubtotal: Decimal;
  taxStatus: LineTaxStatus;
  /** Set only for TAXABLE lines once tax groups are assigned; null for
   * ZERO_RATED/EXEMPT lines, which participate in no tax group
   * (Phase 1 §07 Sections 5-6). */
  taxGroupKey: string | null;
}

export interface CalculatedTaxGroup {
  taxGroupKey: string;
  taxAuthority: string;
  taxType: string;
  rate: Decimal;
  taxableSubtotal: Decimal;
  taxAmount: Decimal;
}

export interface InvoiceCalculationResult {
  lineItems: CalculatedLineItem[];
  taxGroups: CalculatedTaxGroup[];
  preTaxSubtotal: Decimal;
  totalTax: Decimal;
  invoiceTotal: Decimal;
}

/** taxGroupKey identity = taxAuthority + taxType + rate (INV-TAX-004). Never
 * reduce this to authority + rate alone — two different tax types at the
 * same rate, or the same type at two different rates, are distinct groups
 * (Phase 2 §07 Section 4). */
export function buildTaxGroupKey(taxAuthority: string, taxType: string, rate: Decimal): string {
  return `${taxAuthority}|${taxType}|${rate.toFixed()}`;
}

/**
 * Returns true when the approved Phase 1/2 data model provides enough
 * information to determine tax-group applicability for the supplied
 * configuration. A single configured tax line is unambiguous: every
 * TAXABLE line belongs to that one group. More than one configured tax
 * line is ambiguous because Phase 2 §07 Section 9 implies line-level
 * applicability while no approved field establishes which lines each
 * group applies to.
 */
export function isTaxApplicabilityResolvable(taxLines: ConfiguredTaxLine[]): boolean {
  return taxLines.length <= 1;
}

/**
 * Runs the full binding calculation sequence (Phase 2 §07 Section 16):
 *   1. line subtotal (rounded)
 *   2. pre-tax subtotal
 *   3. assign taxable lines to tax groups (taxAuthority + taxType + rate)
 *   4. tax group amount (rounded once per group)
 *   5. total tax
 *   6. invoice total
 *
 * `taxLines` is the full set of tax lines from the business's *effective*
 * TaxConfigurationVersion at the time of calculation (resolved by the
 * caller — see invoiceLifecycle.ts). When exactly one tax line is
 * configured, every TAXABLE line is assigned to that group and the group
 * taxable subtotal is the sum of those line subtotals (Phase 2 §07
 * Section 8). When more than one tax line is configured, tax-group
 * applicability cannot be determined from the approved model and this
 * function throws `UnresolvedTaxApplicabilityError` rather than silently
 * choosing between a common-invoice-base interpretation and a line-level
 * applicability interpretation — see docs/phase-3/01-tax-applicability-remediation.md.
 */
export function calculateInvoice(
  lines: DraftLineItemInput[],
  taxLines: ConfiguredTaxLine[],
): InvoiceCalculationResult {
  if (!isTaxApplicabilityResolvable(taxLines)) {
    throw new UnresolvedTaxApplicabilityError();
  }
  const calculatedLines: CalculatedLineItem[] = lines.map((line) => ({
    key: line.key,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineSubtotal: calculateLineSubtotal(line.quantity, line.unitPrice),
    taxStatus: line.taxStatus,
    taxGroupKey: null,
  }));

  const preTaxSubtotal = sumLineSubtotals(calculatedLines.map((l) => l.lineSubtotal));

  const taxableLines = calculatedLines.filter((l) => l.taxStatus === "TAXABLE");

  const taxGroups: CalculatedTaxGroup[] = taxLines.map((configured) => {
    const key = buildTaxGroupKey(configured.taxAuthority, configured.taxType, configured.rate);
    const taxableSubtotal = sumLineSubtotals(taxableLines.map((l) => l.lineSubtotal));
    const taxAmount = calculateTaxGroupAmount(taxableSubtotal, configured.rate);

    for (const line of taxableLines) {
      // A line may belong to more than one tax group (e.g. GST + PST);
      // taxGroupKey on the persisted line item records the *first*
      // assigned group for display purposes, while the full breakdown
      // lives in InvoiceTaxLine records. See invoiceLifecycle.ts for how
      // this is persisted.
      if (line.taxGroupKey === null) {
        line.taxGroupKey = key;
      }
    }

    return {
      taxGroupKey: key,
      taxAuthority: configured.taxAuthority,
      taxType: configured.taxType,
      rate: configured.rate,
      taxableSubtotal,
      taxAmount,
    };
  });

  const totalTax = sumTaxGroups(taxGroups.map((g) => g.taxAmount));
  const invoiceTotal = calculateInvoiceTotal(preTaxSubtotal, totalTax);

  return {
    lineItems: calculatedLines,
    taxGroups,
    preTaxSubtotal,
    totalTax,
    invoiceTotal,
  };
}
