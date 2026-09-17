import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { ValidationError } from "@/server/domain/errors";
import {
  getCalendarYtdPeriod,
  getInvoiceRevenueDetail,
  getMonthlyActivity,
  getOutstandingDetail,
  getPaymentCollectionDetail,
  getPeriodSummary,
  type PeriodRange,
} from "@/server/domain/reporting";

export type ReportPeriodKind = "calendar-ytd" | "custom";

export interface FinancialReportInput {
  periodKind: ReportPeriodKind;
  startDate?: string;
  endDate?: string;
  asOf?: Date;
}

export interface FinancialReport {
  periodKind: ReportPeriodKind;
  periodLabel: string;
  period: { start: string; end: string };
  summary: {
    revenue: string;
    salesTax: string;
    amountCollected: string;
    outstanding: string;
    invoiceCount: number;
    paymentCount: number;
  };
  monthlyActivity: Array<{
    month: string;
    revenue: string;
    amountCollected: string;
  }>;
  revenueInvoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    clientName: string;
    preTaxSubtotal: string;
    salesTaxTotal: string;
    invoiceTotal: string;
    balanceDue: string;
    status: string;
    provenance: string | null;
  }>;
  collectionPayments: Array<{
    id: string;
    invoiceId: string;
    invoiceNumber: string | null;
    paymentDate: string;
    amount: string;
    method: string | null;
    isReversed: boolean;
  }>;
  outstandingInvoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    dueDate: string | null;
    clientName: string;
    invoiceTotal: string;
    amountCollected: string;
    balanceDue: string;
    overpayment: string;
    paymentStatus: string;
    isOverdue: boolean;
  }>;
  overpaidInvoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    dueDate: string | null;
    clientName: string;
    invoiceTotal: string;
    amountCollected: string;
    balanceDue: string;
    overpayment: string;
    paymentStatus: string;
    isOverdue: boolean;
  }>;
}

function parseDateOnly(value: string, fieldName: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new ValidationError(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError(`${fieldName} is not a valid calendar date.`);
  }

  return date;
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveReportPeriod(input: FinancialReportInput): { period: PeriodRange; label: string } {
  const asOf = input.asOf ?? new Date();

  if (input.periodKind === "calendar-ytd") {
    const period = getCalendarYtdPeriod(asOf);
    return {
      period,
      label: `Calendar year to date (${formatDateOnly(period.start)} – ${formatDateOnly(period.end)})`,
    };
  }

  if (!input.startDate || !input.endDate) {
    throw new ValidationError("Custom reporting periods require both a start date and an end date.");
  }

  const start = parseDateOnly(input.startDate, "Start date");
  const end = parseDateOnly(input.endDate, "End date");

  if (start > end) {
    throw new ValidationError("Start date must be on or before end date.");
  }

  return {
    period: { start, end },
    label: `Custom period (${formatDateOnly(start)} – ${formatDateOnly(end)})`,
  };
}

export async function getFinancialReport(
  auth: AuthContext,
  businessId: string,
  input: FinancialReportInput,
): Promise<FinancialReport> {
  const asOf = input.asOf ?? new Date();
  const { period, label } = resolveReportPeriod(input);

  return withAuthorizedTransaction(auth, async (tx) => {
    const [summary, monthlyActivity, revenueInvoices, collectionPayments, outstandingDetail] =
      await Promise.all([
        getPeriodSummary(tx, auth, businessId, period),
        getMonthlyActivity(tx, auth, businessId, period),
        getInvoiceRevenueDetail(tx, auth, businessId, period),
        getPaymentCollectionDetail(tx, auth, businessId, period),
        getOutstandingDetail(tx, auth, businessId, asOf),
      ]);

    const mapOutstanding = (row: (typeof outstandingDetail.outstanding)[number]) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: formatDateOnly(row.invoiceDate),
      dueDate: row.dueDate ? formatDateOnly(row.dueDate) : null,
      clientName: row.clientName,
      invoiceTotal: row.invoiceTotal,
      amountCollected: row.amountCollected,
      balanceDue: row.balanceDue,
      overpayment: row.overpayment,
      paymentStatus: row.paymentStatus,
      isOverdue: row.isOverdue,
    });

    return {
      periodKind: input.periodKind,
      periodLabel: label,
      period: {
        start: formatDateOnly(period.start),
        end: formatDateOnly(period.end),
      },
      summary: {
        revenue: summary.revenue.toFixed(2),
        salesTax: summary.salesTax.toFixed(2),
        amountCollected: summary.amountCollected.toFixed(2),
        outstanding: summary.outstanding.toFixed(2),
        invoiceCount: summary.invoiceCount,
        paymentCount: summary.paymentCount,
      },
      monthlyActivity: monthlyActivity.map((row) => ({
        month: row.month,
        revenue: row.revenue.toFixed(2),
        amountCollected: row.amountCollected.toFixed(2),
      })),
      revenueInvoices: revenueInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: formatDateOnly(invoice.invoiceDate),
        clientName: invoice.clientName,
        preTaxSubtotal: invoice.preTaxSubtotal,
        salesTaxTotal: invoice.salesTaxTotal,
        invoiceTotal: invoice.invoiceTotal,
        balanceDue: invoice.balanceDue,
        status: invoice.status,
        provenance: invoice.provenance,
      })),
      collectionPayments: collectionPayments.map((payment) => ({
        id: payment.id,
        invoiceId: payment.invoiceId,
        invoiceNumber: payment.invoiceNumber,
        paymentDate: formatDateOnly(payment.paymentDate),
        amount: payment.amount,
        method: payment.method,
        isReversed: payment.isReversed,
      })),
      outstandingInvoices: outstandingDetail.outstanding.map(mapOutstanding),
      overpaidInvoices: outstandingDetail.overpaid.map(mapOutstanding),
    };
  });
}
