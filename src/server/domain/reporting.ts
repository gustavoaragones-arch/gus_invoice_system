import type { InvoiceStatus } from "@prisma/client";
import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { assertBusinessAccess } from "./businessAuthorization";
import type { BilledClientSnapshot } from "./invoiceSnapshots";
import {
  Decimal,
  ZERO,
  calculateBalanceDue,
  calculateOverpayment,
  sumLineSubtotals,
  sumNonReversedPayments,
} from "./money";

/**
 * Reporting/query primitives (Phase 2 §15; Phase 8). No reporting UI in this
 * module — these are domain functions the application layer calls. Every
 * function requires an AuthContext and a businessId and scopes strictly to
 * that one business.
 */

export interface PeriodRange {
  start: Date;
  end: Date;
}

export interface PeriodSummary {
  revenue: Decimal;
  salesTax: Decimal;
  amountCollected: Decimal;
  outstanding: Decimal;
  invoiceCount: number;
  paymentCount: number;
}

export interface MonthlyActivityRow {
  month: string;
  revenue: Decimal;
  amountCollected: Decimal;
}

export interface InvoiceRevenueDetailRow {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: Date;
  clientName: string;
  preTaxSubtotal: string;
  salesTaxTotal: string;
  invoiceTotal: string;
  balanceDue: string;
  status: InvoiceStatus;
  provenance: string | null;
}

export interface PaymentCollectionDetailRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  paymentDate: Date;
  amount: string;
  method: string | null;
  isReversed: boolean;
}

export interface OutstandingDetailRow {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: Date;
  dueDate: Date | null;
  clientName: string;
  invoiceTotal: string;
  amountCollected: string;
  balanceDue: string;
  overpayment: string;
  paymentStatus: "Unpaid" | "Partially Paid" | "Paid" | "Overpaid";
  isOverdue: boolean;
}

export type PaymentStatusLabel = OutstandingDetailRow["paymentStatus"];

/** Calendar YTD: January 1 of the calendar year containing `asOf` through `asOf`. */
export function getCalendarYtdPeriod(asOf: Date): PeriodRange {
  const yearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
  return { start: yearStart, end: asOf };
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthsInPeriod(period: PeriodRange): string[] {
  const months: string[] = [];
  let cursor = new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(period.end.getUTCFullYear(), period.end.getUTCMonth(), 1));

  while (cursor <= endMonth) {
    months.push(monthKey(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return months;
}

function clientNameFromSnapshot(snapshot: unknown): string {
  const billed = snapshot as BilledClientSnapshot | null;
  return billed?.name ?? "Unknown client";
}

export function derivePaymentStatus(
  invoiceTotal: Decimal,
  amountPaid: Decimal,
): PaymentStatusLabel {
  const overpayment = calculateOverpayment(invoiceTotal, amountPaid);
  const balanceDue = calculateBalanceDue(invoiceTotal, amountPaid);

  if (overpayment.greaterThan(0)) return "Overpaid";
  if (balanceDue.isZero() && amountPaid.greaterThan(0)) return "Paid";
  if (amountPaid.greaterThan(0)) return "Partially Paid";
  return "Unpaid";
}

export function deriveOverdueStatus(
  paymentStatus: PaymentStatusLabel,
  dueDate: Date | null,
  asOf: Date,
): boolean {
  if (!dueDate) return false;
  if (paymentStatus !== "Unpaid" && paymentStatus !== "Partially Paid") return false;
  const due = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  return today > due;
}

/** Revenue = Σ pre-tax subtotal of Finalized, non-Void invoices, by invoice date. */
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

/** Sales Tax = Σ tax amounts on Finalized, non-Void invoices, by invoice date. */
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

/** Amount Collected = Σ non-reversed Payments, by payment date. */
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

/** Outstanding = Σ Balance Due across Finalized, non-Void invoices — point-in-time. */
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

export async function getRevenueInvoiceCount(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  period: PeriodRange,
) {
  await assertBusinessAccess(tx, auth, businessId);
  return tx.invoice.count({
    where: {
      businessId,
      status: "FINALIZED",
      invoiceDate: { gte: period.start, lte: period.end },
    },
  });
}

export async function getCollectedPaymentCount(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  period: PeriodRange,
) {
  await assertBusinessAccess(tx, auth, businessId);
  return tx.payment.count({
    where: {
      invoice: { businessId },
      paymentDate: { gte: period.start, lte: period.end },
      reversal: null,
    },
  });
}

export async function getPeriodSummary(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  period: PeriodRange,
): Promise<PeriodSummary> {
  const [revenue, salesTax, amountCollected, outstanding, invoiceCount, paymentCount] = await Promise.all([
    getRevenue(tx, auth, businessId, period),
    getSalesTax(tx, auth, businessId, period),
    getAmountCollected(tx, auth, businessId, period),
    getOutstanding(tx, auth, businessId),
    getRevenueInvoiceCount(tx, auth, businessId, period),
    getCollectedPaymentCount(tx, auth, businessId, period),
  ]);

  return {
    revenue,
    salesTax,
    amountCollected,
    outstanding,
    invoiceCount,
    paymentCount,
  };
}

/** Calendar-year-to-date Revenue. Fiscal-year support is UNRESOLVED. */
export async function getYtdRevenue(tx: Tx, auth: AuthContext, businessId: string, asOf: Date = new Date()) {
  return getRevenue(tx, auth, businessId, getCalendarYtdPeriod(asOf));
}

export async function getMonthlyActivity(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  period: PeriodRange,
): Promise<MonthlyActivityRow[]> {
  await assertBusinessAccess(tx, auth, businessId);

  const [invoices, payments] = await Promise.all([
    tx.invoice.findMany({
      where: {
        businessId,
        status: "FINALIZED",
        invoiceDate: { gte: period.start, lte: period.end },
      },
      select: { invoiceDate: true, preTaxSubtotal: true },
    }),
    tx.payment.findMany({
      where: {
        invoice: { businessId },
        paymentDate: { gte: period.start, lte: period.end },
        reversal: null,
      },
      select: { paymentDate: true, amount: true },
    }),
  ]);

  const revenueByMonth = new Map<string, Decimal>();
  const collectedByMonth = new Map<string, Decimal>();

  for (const invoice of invoices) {
    if (!invoice.invoiceDate) continue;
    const key = monthKey(invoice.invoiceDate);
    const current = revenueByMonth.get(key) ?? ZERO;
    revenueByMonth.set(key, current.plus(new Decimal(invoice.preTaxSubtotal?.toString() ?? "0")));
  }

  for (const payment of payments) {
    const key = monthKey(payment.paymentDate);
    const current = collectedByMonth.get(key) ?? ZERO;
    collectedByMonth.set(key, current.plus(new Decimal(payment.amount.toString())));
  }

  return monthsInPeriod(period).map((month) => ({
    month,
    revenue: revenueByMonth.get(month) ?? ZERO,
    amountCollected: collectedByMonth.get(month) ?? ZERO,
  }));
}

export async function getInvoiceRevenueDetail(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  period: PeriodRange,
): Promise<InvoiceRevenueDetailRow[]> {
  await assertBusinessAccess(tx, auth, businessId);

  const invoices = await tx.invoice.findMany({
    where: {
      businessId,
      status: "FINALIZED",
      invoiceDate: { gte: period.start, lte: period.end },
    },
    include: { payments: { include: { reversal: true } } },
    orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }],
  });

  return invoices.flatMap((invoice) => {
    if (!invoice.invoiceDate) return [];

    const invoiceTotal = new Decimal(invoice.invoiceTotal?.toString() ?? "0");
    const amountPaid = sumNonReversedPayments(
      invoice.payments.filter((p) => !p.reversal).map((p) => new Decimal(p.amount.toString())),
    );

    return [{
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      clientName: clientNameFromSnapshot(invoice.billedClientSnapshot),
      preTaxSubtotal: new Decimal(invoice.preTaxSubtotal?.toString() ?? "0").toFixed(2),
      salesTaxTotal: new Decimal(invoice.totalTax?.toString() ?? "0").toFixed(2),
      invoiceTotal: invoiceTotal.toFixed(2),
      balanceDue: calculateBalanceDue(invoiceTotal, amountPaid).toFixed(2),
      status: invoice.status,
      provenance: invoice.provenance,
    }];
  });
}

export async function getPaymentCollectionDetail(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  period: PeriodRange,
): Promise<PaymentCollectionDetailRow[]> {
  await assertBusinessAccess(tx, auth, businessId);

  const payments = await tx.payment.findMany({
    where: {
      invoice: { businessId },
      paymentDate: { gte: period.start, lte: period.end },
      reversal: null,
    },
    include: { invoice: { select: { invoiceNumber: true } } },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
  });

  return payments.map((payment) => ({
    id: payment.id,
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoice.invoiceNumber,
    paymentDate: payment.paymentDate,
    amount: new Decimal(payment.amount.toString()).toFixed(2),
    method: payment.method,
    isReversed: false,
  }));
}

export async function getOutstandingDetail(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  asOf: Date = new Date(),
): Promise<{ outstanding: OutstandingDetailRow[]; overpaid: OutstandingDetailRow[] }> {
  await assertBusinessAccess(tx, auth, businessId);

  const invoices = await tx.invoice.findMany({
    where: { businessId, status: "FINALIZED" },
    include: { payments: { include: { reversal: true } } },
    orderBy: [{ dueDate: "asc" }, { invoiceDate: "desc" }],
  });

  const outstanding: OutstandingDetailRow[] = [];
  const overpaid: OutstandingDetailRow[] = [];

  for (const invoice of invoices) {
    if (!invoice.invoiceDate) continue;

    const invoiceTotal = new Decimal(invoice.invoiceTotal?.toString() ?? "0");
    const amountPaid = sumNonReversedPayments(
      invoice.payments.filter((p) => !p.reversal).map((p) => new Decimal(p.amount.toString())),
    );
    const balanceDue = calculateBalanceDue(invoiceTotal, amountPaid);
    const overpayment = calculateOverpayment(invoiceTotal, amountPaid);
    const paymentStatus = derivePaymentStatus(invoiceTotal, amountPaid);

    const row: OutstandingDetailRow = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      clientName: clientNameFromSnapshot(invoice.billedClientSnapshot),
      invoiceTotal: invoiceTotal.toFixed(2),
      amountCollected: amountPaid.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
      overpayment: overpayment.toFixed(2),
      paymentStatus,
      isOverdue: deriveOverdueStatus(paymentStatus, invoice.dueDate, asOf),
    };

    if (balanceDue.greaterThan(0)) {
      outstanding.push(row);
    } else if (overpayment.greaterThan(0)) {
      overpaid.push(row);
    }
  }

  return { outstanding, overpaid };
}
