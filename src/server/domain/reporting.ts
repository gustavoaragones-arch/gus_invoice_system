import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { Decimal, ZERO, calculateBalanceDue, sumLineSubtotals, sumNonReversedPayments } from "./money";

/**
 * Reporting/query primitives (Section 20 of the Phase 3 brief; Phase 2
 * §15). No reporting UI — these are domain functions a future UI/API
 * layer calls. Every function requires an AuthContext and a businessId
 * and scopes strictly to that one business (INV-ISO-*, INV-SCOPE-003) —
 * there is no function anywhere in this module, or reachable from it,
 * that accepts more than one businessId or aggregates across businesses.
 */

export interface PeriodRange {
  start: Date;
  end: Date;
}

/** Revenue = Σ pre-tax subtotal of Finalized, non-Void invoices, by
 * invoice date (DEC-ACC-001 / INV-REV-001/002/003/004). Excludes tax. */
export async function getRevenue(tx: Tx, auth: AuthContext, businessId: string, period: PeriodRange) {
  await assertBusinessAccess(tx, auth, businessId);
  const invoices = await tx.invoice.findMany({
    where: {
      businessId,
      status: "FINALIZED",
      invoiceDate: { gte: period.start, lte: period.end },
    },
    select: { preTaxSubtotal: true },
  });
  return sumLineSubtotals(invoices.map((i) => new Decimal(i.preTaxSubtotal?.toString() ?? "0")));
}

/** Sales Tax = Σ tax amounts on Finalized, non-Void invoices, by invoice
 * date (INV-TAX-001/002/003). Reported separately from Revenue, always. */
export async function getSalesTax(tx: Tx, auth: AuthContext, businessId: string, period: PeriodRange) {
  await assertBusinessAccess(tx, auth, businessId);
  const invoices = await tx.invoice.findMany({
    where: {
      businessId,
      status: "FINALIZED",
      invoiceDate: { gte: period.start, lte: period.end },
    },
    select: { totalTax: true },
  });
  return sumLineSubtotals(invoices.map((i) => new Decimal(i.totalTax?.toString() ?? "0")));
}

/** Amount Collected = Σ non-reversed Payments, by payment date
 * (INV-COL-001/002). Includes payments on later-voided invoices
 * (INV-VOID-004) — deliberately does not filter on invoice status. */
export async function getAmountCollected(tx: Tx, auth: AuthContext, businessId: string, period: PeriodRange) {
  await assertBusinessAccess(tx, auth, businessId);
  const payments = await tx.payment.findMany({
    where: {
      invoice: { businessId },
      paymentDate: { gte: period.start, lte: period.end },
      reversal: null,
    },
    select: { amount: true },
  });
  return sumNonReversedPayments(payments.map((p) => new Decimal(p.amount.toString())));
}

/** Outstanding = Σ Balance Due across Finalized, non-Void invoices — a
 * point-in-time snapshot, not period-bound (INV-OUT-001/002). */
export async function getOutstanding(tx: Tx, auth: AuthContext, businessId: string) {
  await assertBusinessAccess(tx, auth, businessId);
  const invoices = await tx.invoice.findMany({
    where: { businessId, status: "FINALIZED" },
    include: { payments: { include: { reversal: true } } },
  });

  let total = ZERO;
  for (const invoice of invoices) {
    const invoiceTotal = new Decimal(invoice.invoiceTotal?.toString() ?? "0");
    const amountPaid = sumNonReversedPayments(
      invoice.payments.filter((p) => !p.reversal).map((p) => new Decimal(p.amount.toString())),
    );
    total = total.plus(calculateBalanceDue(invoiceTotal, amountPaid));
  }
  return total;
}

/** Calendar-year-to-date Revenue (DEC-ACC-002). Fiscal-year support is
 * explicitly UNRESOLVED (Phase 1/2 open item) and not built here. */
export async function getYtdRevenue(tx: Tx, auth: AuthContext, businessId: string, asOf: Date = new Date()) {
  const yearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
  return getRevenue(tx, auth, businessId, { start: yearStart, end: asOf });
}
