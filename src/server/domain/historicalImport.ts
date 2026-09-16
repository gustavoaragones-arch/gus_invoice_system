import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { recordAuditEvent } from "./audit";
import type { BilledBusinessSnapshot, BilledClientSnapshot } from "./invoiceSnapshots";

/**
 * Import-only path: a historical invoice enters directly as `Finalized`,
 * bypassing `Draft` (DEC-HIST-003 / Phase 2 §06 Section 10). This is the
 * one authorized exception to "ordinary invoices must pass through Draft"
 * (INV-LIFE-003) — it must never be reachable from the ordinary
 * create-invoice flow, only from an explicit, audited import operation.
 *
 * Historical Finalized invoices are exempt from the standard finalization
 * completeness validation that setDraftLineItems/finalizeInvoice enforce
 * (DEC-HIST-004): fields the historical source cannot supply are marked
 * `unverified` via `fieldVerification` rather than fabricated
 * (DEC-HIST-007). Historical tax values are preserved exactly as recorded
 * and are NOT recalculated against the business's current
 * TaxConfigurationVersion (DEC-HIST-006) — the caller supplies the
 * already-known tax lines directly; this function does not call the tax
 * engine at all.
 *
 * This function performs no migration itself (Section 22 of the Phase 3
 * brief prohibits building a migration pipeline in this phase) — it is
 * the persistence primitive a future migration process would call, one
 * invoice at a time, with facts already extracted from Business A's
 * historical records.
 */

export interface HistoricalLineItemInput {
  description: string;
  quantity: string;
  unitPrice: string;
  lineSubtotal: string;
  taxStatus: "TAXABLE" | "ZERO_RATED" | "EXEMPT";
  taxGroupKey?: string;
}

export interface HistoricalTaxLineInput {
  taxAuthority: string;
  taxType: string;
  rate: string;
  taxableSubtotal: string;
  taxAmount: string;
}

export interface ImportHistoricalInvoiceInput {
  businessId: string;
  clientId: string;
  /** Preserved exactly as it existed in the source system — never
   * renumbered to fit the new sequential scheme (DEC-HIST-005). */
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  paymentTerms?: string;
  notes?: string;
  lineItems: HistoricalLineItemInput[];
  taxLines: HistoricalTaxLineInput[];
  preTaxSubtotal: string;
  totalTax: string;
  invoiceTotal: string;
  billedClientSnapshot: BilledClientSnapshot;
  billedBusinessSnapshot: BilledBusinessSnapshot;
  /** e.g. { "dueDate": "unverified" } for facts the historical source
   * could not confirm (DEC-HIST-007). Never silently defaulted. */
  fieldVerification?: Record<string, "unverified">;
}

export async function importHistoricalInvoice(
  tx: Tx,
  auth: AuthContext,
  input: ImportHistoricalInvoiceInput,
) {
  await assertBusinessAccess(tx, auth, input.businessId);

  const client = await tx.client.findFirst({
    where: { id: input.clientId, businessId: input.businessId },
    select: { id: true },
  });
  if (!client) {
    throw new Error("Client does not belong to the specified business.");
  }

  const existingNumber = await tx.invoice.findFirst({
    where: { businessId: input.businessId, invoiceNumber: input.invoiceNumber },
    select: { id: true },
  });
  if (existingNumber) {
    throw new Error(`Invoice number ${input.invoiceNumber} already exists for this business.`);
  }

  const invoice = await tx.invoice.create({
    data: {
      businessId: input.businessId,
      clientId: input.clientId,
      status: "FINALIZED",
      provenance: "HISTORICAL_IMPORT",
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      paymentTerms: input.paymentTerms,
      notes: input.notes,
      preTaxSubtotal: input.preTaxSubtotal,
      totalTax: input.totalTax,
      invoiceTotal: input.invoiceTotal,
      billedClientSnapshot: input.billedClientSnapshot as unknown as object,
      billedBusinessSnapshot: input.billedBusinessSnapshot as unknown as object,
      fieldVerification: input.fieldVerification as unknown as object | undefined,
      finalizedAt: input.invoiceDate,
      lineItems: {
        create: input.lineItems.map((line, index) => ({
          lineOrder: index + 1,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineSubtotal: line.lineSubtotal,
          taxStatus: line.taxStatus,
          taxGroupKey: line.taxGroupKey,
        })),
      },
      taxLines: {
        create: input.taxLines.map((line) => ({
          taxAuthority: line.taxAuthority,
          taxType: line.taxType,
          rate: line.rate,
          taxableSubtotal: line.taxableSubtotal,
          taxAmount: line.taxAmount,
        })),
      },
    },
    include: { lineItems: true, taxLines: true },
  });

  await recordAuditEvent(tx, {
    businessId: input.businessId,
    eventType: "INVOICE_FINALIZED",
    actorUserId: auth.userId,
    entityType: "Invoice",
    entityId: invoice.id,
    newValues: {
      provenance: "HISTORICAL_IMPORT",
      invoiceNumber: input.invoiceNumber,
      invoiceTotal: input.invoiceTotal,
    },
    metadata: { importPath: true },
  });

  return invoice;
}
