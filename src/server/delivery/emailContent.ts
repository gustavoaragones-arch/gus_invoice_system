import type { Invoice, InvoiceLineItem, InvoiceTaxLine } from "@prisma/client";
import type { BilledBusinessSnapshot, BilledClientSnapshot } from "@/server/domain/invoiceSnapshots";
import type { InvoiceBalance } from "@/server/domain/payments";
import { formatDate, formatMoney } from "@/lib/format";

export interface InvoiceEmailContentInput {
  invoice: Pick<Invoice, "invoiceNumber" | "invoiceDate" | "invoiceTotal" | "preTaxSubtotal" | "totalTax">;
  billedClient: BilledClientSnapshot;
  billedBusiness: BilledBusinessSnapshot;
  lineItems: InvoiceLineItem[];
  taxLines: InvoiceTaxLine[];
  balance: InvoiceBalance;
}

export function buildInvoiceEmailContent(input: InvoiceEmailContentInput) {
  const businessName = input.billedBusiness.legalName ?? "Your service provider";
  const invoiceNumber = input.invoice.invoiceNumber ?? "—";
  const invoiceDate = formatDate(input.invoice.invoiceDate);
  const total = formatMoney(input.invoice.invoiceTotal?.toString() ?? null);
  const balanceDue = formatMoney(input.balance.balanceDue.toFixed(2));

  const lines = input.lineItems
    .map(
      (line) =>
        `${line.description} — ${line.quantity.toString()} × ${formatMoney(line.unitPrice.toString())} = ${formatMoney(line.lineSubtotal.toString())}`,
    )
    .join("\n");

  const taxSummary = input.taxLines.length
    ? input.taxLines
        .map((tax) => `${tax.taxType} (${tax.taxAuthority}): ${formatMoney(tax.taxAmount.toString())}`)
        .join("\n")
    : "No tax lines recorded.";

  const subject = `Invoice ${invoiceNumber} from ${businessName}`;

  const text = [
    `Hello ${input.billedClient.name},`,
    "",
    `${businessName} has sent you invoice ${invoiceNumber} dated ${invoiceDate}.`,
    "",
    "Line items:",
    lines,
    "",
    `Subtotal: ${formatMoney(input.invoice.preTaxSubtotal?.toString() ?? null)}`,
    `Tax: ${formatMoney(input.invoice.totalTax?.toString() ?? null)}`,
    taxSummary,
    `Invoice total: ${total}`,
    `Balance due: ${balanceDue}`,
    "",
    "This message contains invoice details only. No payment instructions are included because none are configured in the system.",
    "",
    `Regards,`,
    businessName,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1a2332; line-height: 1.5;">
      <p>Hello ${escapeHtml(input.billedClient.name)},</p>
      <p><strong>${escapeHtml(businessName)}</strong> has sent you invoice <strong>${escapeHtml(invoiceNumber)}</strong> dated ${escapeHtml(invoiceDate)}.</p>
      <h3>Line items</h3>
      <ul>${input.lineItems.map((line) => `<li>${escapeHtml(line.description)} — ${escapeHtml(line.quantity.toString())} × ${escapeHtml(formatMoney(line.unitPrice.toString()))} = ${escapeHtml(formatMoney(line.lineSubtotal.toString()))}</li>`).join("")}</ul>
      <p><strong>Subtotal:</strong> ${escapeHtml(formatMoney(input.invoice.preTaxSubtotal?.toString() ?? null))}<br/>
      <strong>Tax:</strong> ${escapeHtml(formatMoney(input.invoice.totalTax?.toString() ?? null))}<br/>
      <strong>Invoice total:</strong> ${escapeHtml(total)}<br/>
      <strong>Balance due:</strong> ${escapeHtml(balanceDue)}</p>
      <p style="color:#5b6777;">This message contains invoice details only. No payment instructions are included because none are configured in the system.</p>
      <p>Regards,<br/>${escapeHtml(businessName)}</p>
    </div>
  `;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
