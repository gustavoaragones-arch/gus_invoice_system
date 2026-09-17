import type { Invoice, InvoiceLineItem, InvoiceTaxLine } from "@prisma/client";
import type { BilledBusinessSnapshot, BilledClientSnapshot } from "@/server/domain/invoiceSnapshots";
import type { InvoiceBalance } from "@/server/domain/payments";
import { formatDate, formatMoney } from "@/lib/format";

export interface InvoiceEmailContentInput {
  invoice: Pick<Invoice, "invoiceNumber" | "invoiceDate" | "dueDate" | "invoiceTotal">;
  billedClient: BilledClientSnapshot;
  billedBusiness: BilledBusinessSnapshot;
  lineItems: InvoiceLineItem[];
  taxLines: InvoiceTaxLine[];
  balance: InvoiceBalance;
}

export function buildInvoiceEmailContent(input: InvoiceEmailContentInput) {
  const businessName = input.billedBusiness.legalName;
  const invoiceNumber = input.invoice.invoiceNumber ?? "—";
  const clientName = input.billedClient.name;
  const invoiceDate = input.invoice.invoiceDate ? formatDate(input.invoice.invoiceDate) : null;
  const dueDate = input.invoice.dueDate ? formatDate(input.invoice.dueDate) : null;
  const amountDue = formatMoney(input.balance.balanceDue.toFixed(2));

  const subject = `Invoice ${invoiceNumber} from ${businessName}`;

  const bodyLines = [
    `Hello ${clientName},`,
    "",
    `Please find attached invoice ${invoiceNumber} from ${businessName}.`,
    "",
  ];

  if (invoiceDate) {
    bodyLines.push(`Invoice date: ${invoiceDate}`);
  }
  bodyLines.push(`Amount due: ${amountDue}`);
  if (dueDate) {
    bodyLines.push(`Due date: ${dueDate}`);
  }

  bodyLines.push("", "Thank you.", "", businessName);
  const text = bodyLines.join("\n");

  const htmlLines = [
    `<p>Hello ${escapeHtml(clientName)},</p>`,
    `<p>Please find attached invoice <strong>${escapeHtml(invoiceNumber)}</strong> from <strong>${escapeHtml(businessName)}</strong>.</p>`,
  ];

  if (invoiceDate) {
    htmlLines.push(`<p>Invoice date: ${escapeHtml(invoiceDate)}</p>`);
  }
  htmlLines.push(`<p>Amount due: ${escapeHtml(amountDue)}</p>`);
  if (dueDate) {
    htmlLines.push(`<p>Due date: ${escapeHtml(dueDate)}</p>`);
  }
  htmlLines.push(`<p>Thank you.</p><p>${escapeHtml(businessName)}</p>`);

  const html = `<div style="font-family: Arial, sans-serif; color: #1a2332; line-height: 1.5;">${htmlLines.join("")}</div>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
