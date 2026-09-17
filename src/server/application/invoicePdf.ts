import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { InvalidStateError, NotFoundError, ValidationError } from "@/server/domain/errors";
import type { BilledBusinessSnapshot, BilledClientSnapshot } from "@/server/domain/invoiceSnapshots";
import { getInvoiceBalance } from "@/server/domain/payments";
import {
  buildInvoicePdfFilename,
  generateInvoicePdf,
  type InvoicePdfInput,
} from "@/server/pdf/invoicePdf";

export async function getFinalizedInvoicePdf(
  auth: AuthContext,
  businessId: string,
  invoiceId: string,
): Promise<{ filename: string; content: Buffer }> {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);

    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: {
        lineItems: { orderBy: { lineOrder: "asc" } },
        taxLines: true,
      },
    });
    if (!invoice) throw new NotFoundError("Invoice not found.");

    if (invoice.status !== "FINALIZED" && invoice.status !== "VOID") {
      throw new InvalidStateError("Only finalized or void invoices can generate a PDF.");
    }

    const billedClient = invoice.billedClientSnapshot as BilledClientSnapshot | null;
    const billedBusiness = invoice.billedBusinessSnapshot as BilledBusinessSnapshot | null;
    if (!billedClient || !billedBusiness || !invoice.invoiceNumber || !invoice.invoiceDate) {
      throw new ValidationError("Finalized invoice snapshots and invoice metadata are required for PDF generation.");
    }

    const balance = await getInvoiceBalance(tx, auth, invoice.id);
    const input: InvoicePdfInput = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      billedClient,
      billedBusiness,
      lineItems: invoice.lineItems,
      taxLines: invoice.taxLines,
      preTaxSubtotal: invoice.preTaxSubtotal?.toString() ?? "0.00",
      totalTax: invoice.totalTax?.toString() ?? "0.00",
      invoiceTotal: invoice.invoiceTotal?.toString() ?? "0.00",
      balance,
    };

    const content = await generateInvoicePdf(input);
    return {
      filename: buildInvoicePdfFilename(invoice.invoiceNumber),
      content,
    };
  });
}
