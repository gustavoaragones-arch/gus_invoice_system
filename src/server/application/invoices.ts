import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { NotFoundError, ValidationError } from "@/server/domain/errors";
import {
  createDraftInvoice,
  createReplacementDraft,
  finalizeInvoice,
  recordReplacementFinalizedAudit,
  setDraftLineItems,
  voidInvoice,
  type DraftLineItemInput,
} from "@/server/domain/invoiceLifecycle";
import { getInvoiceBalance } from "@/server/domain/payments";
import { Decimal } from "@/server/domain/money";
import { resolveEffectiveTaxConfiguration } from "@/server/domain/taxConfiguration";
import { calculateInvoice, isTaxApplicabilityResolvable } from "@/server/domain/taxCalculation";
import type { BilledBusinessSnapshot, BilledClientSnapshot } from "@/server/domain/invoiceSnapshots";

export async function listInvoices(auth: AuthContext, businessId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const invoices = await tx.invoice.findMany({
      where: { businessId },
      include: { client: true },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    const balances = await Promise.all(
      invoices
        .filter((inv) => inv.status === "FINALIZED")
        .map(async (inv) => {
          const balance = await getInvoiceBalance(tx, auth, inv.id);
          return { invoiceId: inv.id, balanceDue: balance.balanceDue.toFixed(2) };
        }),
    );
    const balanceMap = new Map(balances.map((b) => [b.invoiceId, b.balanceDue]));

    return invoices.map((invoice) => ({
      ...invoice,
      balanceDue: balanceMap.get(invoice.id) ?? null,
    }));
  });
}

export async function getInvoice(auth: AuthContext, businessId: string, invoiceId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: {
        client: true,
        business: true,
        lineItems: { orderBy: { lineOrder: "asc" } },
        taxLines: true,
        payments: {
          include: { reversal: true },
          orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
        },
        sendAttempts: { orderBy: { attemptedAt: "desc" } },
        replaces: { select: { id: true, invoiceNumber: true, status: true } },
        replacedBy: { select: { id: true, invoiceNumber: true, status: true } },
      },
    });
    if (!invoice) throw new NotFoundError("Invoice not found.");

    let balanceDue: string | null = null;
    let amountCollected: string | null = null;
    let overpayment: string | null = null;
    let paymentStatus: string | null = null;

    if (invoice.status === "FINALIZED" || invoice.status === "VOID") {
      const balance = await getInvoiceBalance(tx, auth, invoice.id);
      balanceDue = balance.balanceDue.toFixed(2);
      amountCollected = balance.amountPaid.toFixed(2);
      overpayment = balance.overpayment.toFixed(2);
      paymentStatus =
        balance.overpayment.greaterThan(0)
          ? "Overpaid"
          : balance.balanceDue.isZero() && balance.amountPaid.greaterThan(0)
            ? "Paid"
            : balance.amountPaid.greaterThan(0)
              ? "Partially Paid"
              : "Unpaid";
    }

    return {
      ...invoice,
      balanceDue,
      amountCollected,
      overpayment,
      paymentStatus,
    };
  });
}

export interface DraftPreview {
  canFinalize: boolean;
  taxApplicabilityStatus: "resolved" | "unresolved";
  taxApplicabilityMessage?: string;
  preTaxSubtotal: string;
  totalTax: string | null;
  invoiceTotal: string | null;
  taxLines: Array<{
    taxAuthority: string;
    taxType: string;
    rate: string;
    taxableSubtotal: string;
    taxAmount: string;
  }>;
}

export async function getDraftInvoicePreview(
  auth: AuthContext,
  businessId: string,
  invoiceId: string,
  invoiceDate?: Date,
): Promise<DraftPreview> {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: { lineItems: { orderBy: { lineOrder: "asc" } } },
    });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    if (invoice.status !== "DRAFT") {
      throw new ValidationError("Preview is only available for Draft invoices.");
    }
    if (invoice.lineItems.length === 0) {
      return {
        canFinalize: false,
        taxApplicabilityStatus: "resolved",
        preTaxSubtotal: "0.00",
        totalTax: "0.00",
        invoiceTotal: "0.00",
        taxLines: [],
      };
    }

    const date = invoiceDate ?? invoice.invoiceDate ?? new Date();
    const taxConfig = await resolveEffectiveTaxConfiguration(tx, businessId, date);
    const lineSubtotalSum = invoice.lineItems.reduce(
      (sum, line) => sum.plus(new Decimal(line.lineSubtotal.toString())),
      new Decimal(0),
    );

    if (!isTaxApplicabilityResolvable(taxConfig.taxLines)) {
      return {
        canFinalize: false,
        taxApplicabilityStatus: "unresolved",
        taxApplicabilityMessage:
          "This invoice cannot be finalized because the business tax configuration defines multiple tax groups, and the approved system does not yet define which tax groups apply to which invoice lines. Professional review is required before mixed tax-group invoices can be finalized.",
        preTaxSubtotal: lineSubtotalSum.toFixed(2),
        totalTax: null,
        invoiceTotal: null,
        taxLines: [],
      };
    }

    const calculation = calculateInvoice(
      invoice.lineItems.map((line) => ({
        key: line.id,
        quantity: new Decimal(line.quantity.toString()),
        unitPrice: new Decimal(line.unitPrice.toString()),
        taxStatus: line.taxStatus,
      })),
      taxConfig.taxLines,
    );

    return {
      canFinalize: true,
      taxApplicabilityStatus: "resolved",
      preTaxSubtotal: calculation.preTaxSubtotal.toFixed(2),
      totalTax: calculation.totalTax.toFixed(2),
      invoiceTotal: calculation.invoiceTotal.toFixed(2),
      taxLines: calculation.taxGroups.map((group) => ({
        taxAuthority: group.taxAuthority,
        taxType: group.taxType,
        rate: group.rate.toFixed(5),
        taxableSubtotal: group.taxableSubtotal.toFixed(2),
        taxAmount: group.taxAmount.toFixed(2),
      })),
    };
  });
}

export function getBilledClientSnapshot(invoice: {
  status: string;
  billedClientSnapshot: unknown;
  client: { name: string; billingAddress: string | null; contactEmail: string | null };
}): BilledClientSnapshot {
  if (invoice.status === "FINALIZED" || invoice.status === "VOID") {
    return invoice.billedClientSnapshot as BilledClientSnapshot;
  }
  return {
    name: invoice.client.name,
    billingAddress: invoice.client.billingAddress,
    contactEmail: invoice.client.contactEmail,
  };
}

export function getBilledBusinessSnapshot(invoice: {
  status: string;
  billedBusinessSnapshot: unknown;
  business?: {
    name: string;
    legalName: string | null;
    address: string | null;
    gstHstRegistrationNumber: string | null;
    brandingLogoRef: string | null;
  };
}): BilledBusinessSnapshot | null {
  if (invoice.status === "FINALIZED" || invoice.status === "VOID") {
    return invoice.billedBusinessSnapshot as BilledBusinessSnapshot;
  }
  if (!invoice.business) return null;
  return {
    legalName: invoice.business.legalName ?? invoice.business.name,
    address: invoice.business.address,
    gstHstRegistrationNumber: invoice.business.gstHstRegistrationNumber,
    brandingLogoRef: invoice.business.brandingLogoRef,
  };
}

export async function createInvoiceDraft(
  auth: AuthContext,
  businessId: string,
  input: { clientId: string; invoiceDate?: Date; notes?: string; dueDate?: Date },
) {
  return withAuthorizedTransaction(auth, (tx) =>
    createDraftInvoice(tx, auth, {
      businessId,
      clientId: input.clientId,
      notes: input.notes,
      dueDate: input.dueDate,
    }),
  );
}

export async function updateDraftInvoice(
  auth: AuthContext,
  businessId: string,
  invoiceId: string,
  input: { clientId?: string; invoiceDate?: Date | null; notes?: string; dueDate?: Date | null },
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    if (invoice.status !== "DRAFT") {
      throw new ValidationError("Only Draft invoices can be edited.");
    }
    if (input.clientId) {
      const client = await tx.client.findFirst({ where: { id: input.clientId, businessId } });
      if (!client) throw new ValidationError("Client does not belong to the selected business.");
    }
    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        clientId: input.clientId ?? invoice.clientId,
        invoiceDate: input.invoiceDate === undefined ? invoice.invoiceDate : input.invoiceDate,
        notes: input.notes === undefined ? invoice.notes : input.notes,
        dueDate: input.dueDate === undefined ? invoice.dueDate : input.dueDate,
      },
    });
  });
}

export async function saveDraftLineItems(
  auth: AuthContext,
  businessId: string,
  invoiceId: string,
  lines: DraftLineItemInput[],
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    return setDraftLineItems(tx, auth, invoiceId, lines);
  });
}

export async function finalizeInvoiceForBusiness(
  auth: AuthContext,
  businessId: string,
  invoiceId: string,
  invoiceDate?: Date,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    const finalized = await finalizeInvoice(tx, auth, { invoiceId, invoiceDate });
    if (finalized.replacesInvoiceId) {
      await recordReplacementFinalizedAudit(tx, auth, finalized.id, finalized.replacesInvoiceId);
    }
    return finalized;
  });
}

export async function voidInvoiceForBusiness(
  auth: AuthContext,
  businessId: string,
  invoiceId: string,
  reason?: string,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    return voidInvoice(tx, auth, { invoiceId, reason });
  });
}

export async function createReplacementDraftForBusiness(
  auth: AuthContext,
  businessId: string,
  invoiceId: string,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundError("Invoice not found.");
    return createReplacementDraft(tx, auth, invoiceId);
  });
}
