import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { recordAuditEvent } from "./audit";
import { getInvoiceBalance } from "./payments";
import type { BilledBusinessSnapshot, BilledClientSnapshot } from "./invoiceSnapshots";
import { buildInvoiceEmailContent } from "@/server/delivery/emailContent";
import { getEmailProvider } from "@/server/delivery/emailProvider";
import { buildInvoicePdfFilename, generateInvoicePdf } from "@/server/pdf/invoicePdf";
import { InvalidStateError, NotFoundError, ValidationError } from "./errors";

export interface SendInvoiceInput {
  invoiceId: string;
  destinationEmail: string;
}

export async function sendInvoice(tx: Tx, auth: AuthContext, input: SendInvoiceInput) {
  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId },
    include: {
      lineItems: { orderBy: { lineOrder: "asc" } },
      taxLines: true,
    },
  });
  if (!invoice) throw new NotFoundError("Invoice not found.");
  await assertBusinessAccess(tx, auth, invoice.businessId);

  if (invoice.status !== "FINALIZED") {
    throw new InvalidStateError("Only a finalized invoice can be sent.");
  }

  const destinationEmail = input.destinationEmail.trim();
  if (!destinationEmail) {
    throw new ValidationError("A destination email address is required.");
  }

  const billedClient = invoice.billedClientSnapshot as BilledClientSnapshot | null;
  const billedBusiness = invoice.billedBusinessSnapshot as BilledBusinessSnapshot | null;
  if (!billedClient || !billedBusiness || !invoice.invoiceNumber || !invoice.invoiceDate) {
    throw new ValidationError("Finalized invoice snapshots are required before delivery.");
  }

  const balance = await getInvoiceBalance(tx, auth, invoice.id);
  const emailContent = buildInvoiceEmailContent({
    invoice,
    billedClient,
    billedBusiness,
    lineItems: invoice.lineItems,
    taxLines: invoice.taxLines,
    balance,
  });

  const pdfContent = await generateInvoicePdf({
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
  });

  let status: "SUCCESS" | "FAILURE" = "SUCCESS";
  let errorMessage: string | null = null;

  try {
    await getEmailProvider().send({
      to: destinationEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      attachments: [
        {
          filename: buildInvoicePdfFilename(invoice.invoiceNumber),
          content: pdfContent,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (error) {
    status = "FAILURE";
    errorMessage = error instanceof Error ? error.message : "Invoice delivery failed.";
  }

  const attempt = await tx.invoiceSendAttempt.create({
    data: {
      invoiceId: invoice.id,
      status,
      errorMessage,
    },
  });

  await recordAuditEvent(tx, {
    businessId: invoice.businessId,
    eventType: "INVOICE_SEND_ATTEMPTED",
    actorUserId: auth.userId,
    entityType: "Invoice",
    entityId: invoice.id,
    newValues: { sendAttemptId: attempt.id, status },
    metadata: {
      destination: destinationEmail,
      provider: getEmailProvider().name,
      attachmentFilename: buildInvoicePdfFilename(invoice.invoiceNumber),
    },
  });

  return { attempt, errorMessage };
}
