import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { NotFoundError, ValidationError } from "@/server/domain/errors";
import { sendInvoice } from "@/server/domain/invoiceDelivery";
import type { BilledClientSnapshot } from "@/server/domain/invoiceSnapshots";

export async function listSendAttempts(auth: AuthContext, businessId: string, invoiceId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    return tx.invoiceSendAttempt.findMany({
      where: { invoiceId },
      orderBy: { attemptedAt: "desc" },
    });
  });
}

export async function getDeliveryPreview(auth: AuthContext, businessId: string, invoiceId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    const billedClient = invoice.billedClientSnapshot as BilledClientSnapshot | null;
    return {
      destinationEmail: billedClient?.contactEmail ?? "",
      canSend: invoice.status === "FINALIZED",
      status: invoice.status,
    };
  });
}

export async function sendInvoiceForBusiness(
  auth: AuthContext,
  businessId: string,
  invoiceId: string,
  destinationEmail: string,
) {
  const result = await withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    return sendInvoice(tx, auth, { invoiceId, destinationEmail });
  });

  if (result.attempt.status === "FAILURE") {
    throw new ValidationError(result.errorMessage ?? "Invoice delivery failed.");
  }

  return result.attempt;
}
