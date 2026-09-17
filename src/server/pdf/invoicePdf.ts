import PDFDocument from "pdfkit";
import type { InvoiceLineItem, InvoiceTaxLine } from "@prisma/client";
import type { BilledBusinessSnapshot, BilledClientSnapshot } from "@/server/domain/invoiceSnapshots";
import type { InvoiceBalance } from "@/server/domain/payments";
import { formatDate, formatMoney } from "@/lib/format";

export interface InvoicePdfInput {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date | null;
  billedClient: BilledClientSnapshot;
  billedBusiness: BilledBusinessSnapshot;
  lineItems: InvoiceLineItem[];
  taxLines: InvoiceTaxLine[];
  preTaxSubtotal: string;
  totalTax: string;
  invoiceTotal: string;
  balance: InvoiceBalance;
}

export function buildInvoicePdfFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `Invoice-${safe || "document"}.pdf`;
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 50,
      info: {
        Title: `Invoice ${input.invoiceNumber}`,
        CreationDate: input.invoiceDate,
        ModDate: input.invoiceDate,
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text(input.billedBusiness.legalName, { align: "left" });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor("#444444");
    if (input.billedBusiness.address) {
      doc.text(input.billedBusiness.address);
    }
    if (input.billedBusiness.gstHstRegistrationNumber) {
      doc.text(`GST/HST: ${input.billedBusiness.gstHstRegistrationNumber}`);
    }
    if (input.billedBusiness.brandingLogoRef) {
      doc.text(`Logo ref: ${input.billedBusiness.brandingLogoRef}`);
    }

    doc.moveDown(1);
    doc.fillColor("#000000").fontSize(14).text(`Invoice ${input.invoiceNumber}`);
    doc.fontSize(10);
    doc.text(`Invoice date: ${formatDate(input.invoiceDate)}`);
    if (input.dueDate) {
      doc.text(`Due date: ${formatDate(input.dueDate)}`);
    }

    doc.moveDown(1);
    doc.fontSize(12).text("Bill to");
    doc.fontSize(10).text(input.billedClient.name);
    if (input.billedClient.billingAddress) {
      doc.text(input.billedClient.billingAddress);
    }
    if (input.billedClient.contactEmail) {
      doc.text(input.billedClient.contactEmail);
    }

    doc.moveDown(1);
    const tableTop = doc.y;
    doc.fontSize(10).text("Description", 50, tableTop);
    doc.text("Qty", 300, tableTop);
    doc.text("Unit", 350, tableTop);
    doc.text("Subtotal", 450, tableTop, { width: 100, align: "right" });

    let rowY = tableTop + 18;
    for (const line of input.lineItems) {
      doc.text(line.description, 50, rowY, { width: 240 });
      doc.text(line.quantity.toString(), 300, rowY);
      doc.text(formatMoney(line.unitPrice.toString()), 350, rowY);
      doc.text(formatMoney(line.lineSubtotal.toString()), 450, rowY, { width: 100, align: "right" });
      rowY += 18;
    }

    doc.moveDown(2);
    doc.text(`Subtotal: ${formatMoney(input.preTaxSubtotal)}`, { align: "right" });
    doc.text(`Tax: ${formatMoney(input.totalTax)}`, { align: "right" });
    doc.text(`Invoice total: ${formatMoney(input.invoiceTotal)}`, { align: "right" });
    doc.text(`Amount collected: ${formatMoney(input.balance.amountPaid.toFixed(2))}`, { align: "right" });
    doc.text(`Balance due: ${formatMoney(input.balance.balanceDue.toFixed(2))}`, { align: "right" });

    if (input.taxLines.length > 0) {
      doc.moveDown(1);
      doc.fontSize(11).text("Tax lines");
      for (const taxLine of input.taxLines) {
        doc.fontSize(10).text(
          `${taxLine.taxType} (${taxLine.taxAuthority}) — ${formatMoney(taxLine.taxAmount.toString())}`,
        );
      }
    }

    doc.end();
  });
}
