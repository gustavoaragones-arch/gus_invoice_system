import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { NotFoundError } from "@/server/domain/errors";
import {
  getInvoiceBalance,
  recordPayment,
  reversePayment,
  type RecordPaymentInput,
  type ReversePaymentInput,
} from "@/server/domain/payments";

export async function listInvoicePayments(auth: AuthContext, businessId: string, invoiceId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    return tx.payment.findMany({
      where: { invoiceId },
      include: { reversal: true },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });
  });
}

export async function getInvoiceFinancialSummary(auth: AuthContext, businessId: string, invoiceId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");

    if (invoice.status !== "FINALIZED" && invoice.status !== "VOID") {
      return null;
    }

    const balance = await getInvoiceBalance(tx, auth, invoiceId);
    const paymentStatus =
      balance.overpayment.greaterThan(0)
        ? "Overpaid"
        : balance.balanceDue.isZero() && balance.amountPaid.greaterThan(0)
          ? "Paid"
          : balance.amountPaid.greaterThan(0)
            ? "Partially Paid"
            : "Unpaid";

    return {
      invoiceTotal: balance.invoiceTotal.toFixed(2),
      amountCollected: balance.amountPaid.toFixed(2),
      balanceDue: balance.balanceDue.toFixed(2),
      overpayment: balance.overpayment.toFixed(2),
      paymentStatus,
    };
  });
}

export async function recordPaymentForBusiness(
  auth: AuthContext,
  businessId: string,
  input: RecordPaymentInput,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: input.invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    return recordPayment(tx, auth, input);
  });
}

export async function reversePaymentForBusiness(
  auth: AuthContext,
  businessId: string,
  input: ReversePaymentInput,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: { invoice: true },
    });
    if (!payment || payment.invoice.businessId !== businessId) {
      throw new NotFoundError("Payment not found.");
    }
    await assertBusinessAccess(tx, auth, businessId);
    return reversePayment(tx, auth, input);
  });
}
