import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { recordAuditEvent } from "./audit";
import { allocateNextInvoiceNumber } from "./invoiceNumbering";
import { resolveEffectiveTaxConfiguration } from "./taxConfiguration";
import { buildBilledBusinessSnapshot, buildBilledClientSnapshot } from "./invoiceSnapshots";
import { calculateInvoice, type LineTaxStatus } from "./taxCalculation";
import { Decimal, hasAtMostDecimalPlaces } from "./money";
import { InvalidStateError, NotFoundError, ValidationError } from "./errors";

// ─────────────────────────────────────────────────────────────────────────
// Draft creation and editing (INV-LIFE-003: Draft → Finalized | deleted)
// ─────────────────────────────────────────────────────────────────────────

export interface CreateDraftInvoiceInput {
  businessId: string;
  clientId: string;
  paymentTerms?: string;
  notes?: string;
  dueDate?: Date;
}

export async function createDraftInvoice(tx: Tx, auth: AuthContext, input: CreateDraftInvoiceInput) {
  await assertBusinessAccess(tx, auth, input.businessId);

  const client = await tx.client.findFirst({
    where: { id: input.clientId, businessId: input.businessId },
    select: { id: true },
  });
  if (!client) {
    throw new ValidationError("Client does not belong to the specified business.");
  }

  const invoice = await tx.invoice.create({
    data: {
      businessId: input.businessId,
      clientId: input.clientId,
      status: "DRAFT",
      paymentTerms: input.paymentTerms,
      notes: input.notes,
      dueDate: input.dueDate,
    },
  });

  await recordAuditEvent(tx, {
    businessId: input.businessId,
    eventType: "INVOICE_CREATED",
    actorUserId: auth.userId,
    entityType: "Invoice",
    entityId: invoice.id,
    newValues: { status: "DRAFT", clientId: input.clientId },
  });

  return invoice;
}

export interface DraftLineItemInput {
  description: string;
  quantity: string;
  unitPrice: string;
  taxStatus: LineTaxStatus;
  serviceId?: string;
  workCandidateId?: string;
}

/**
 * Replaces the full set of line items on a Draft invoice (Phase 0
 * FR-INV-002: draft content is freely editable). Only permitted while the
 * invoice is Draft — INV-IMM-002 makes this a hard state check, not a
 * convention.
 */
export async function setDraftLineItems(
  tx: Tx,
  auth: AuthContext,
  invoiceId: string,
  lines: DraftLineItemInput[],
) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError("Invoice not found.");
  await assertBusinessAccess(tx, auth, invoice.businessId);

  if (invoice.status !== "DRAFT") {
    throw new InvalidStateError("Line items can only be edited while the invoice is a Draft.");
  }
  if (lines.length === 0) {
    throw new ValidationError("At least one line item is required.");
  }

  await tx.invoiceLineItem.deleteMany({ where: { invoiceId } });

  await tx.invoiceLineItem.createMany({
    data: lines.map((line, index) => {
      const quantity = new Decimal(line.quantity);
      const unitPrice = new Decimal(line.unitPrice);
      if (!quantity.greaterThan(0)) {
        throw new ValidationError(`Line ${index + 1}: quantity must be greater than zero.`);
      }
      if (unitPrice.isNegative()) {
        throw new ValidationError(`Line ${index + 1}: unit price cannot be negative.`);
      }
      // DEC-MONEY-004/005: reject over-precise input rather than silently
      // truncating it — see hasAtMostDecimalPlaces doc comment for why
      // silent truncation here would be a real (and easy to miss) bug.
      if (!hasAtMostDecimalPlaces(quantity, 2)) {
        throw new ValidationError(`Line ${index + 1}: quantity may have at most 2 decimal places.`);
      }
      if (!hasAtMostDecimalPlaces(unitPrice, 2)) {
        throw new ValidationError(`Line ${index + 1}: unit price may have at most 2 decimal places.`);
      }
      return {
        invoiceId,
        lineOrder: index + 1,
        description: line.description,
        quantity: quantity.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        lineSubtotal: quantity.times(unitPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
        taxStatus: line.taxStatus,
        serviceId: line.serviceId,
        workCandidateId: line.workCandidateId,
      };
    }),
  });

  return tx.invoiceLineItem.findMany({ where: { invoiceId }, orderBy: { lineOrder: "asc" } });
}

// ─────────────────────────────────────────────────────────────────────────
// Finalization (Section 10 of the Phase 3 brief; Phase 2 §06 Section 5-6)
// ─────────────────────────────────────────────────────────────────────────

export interface FinalizeInvoiceInput {
  invoiceId: string;
  /** Defaults to the current date if omitted. */
  invoiceDate?: Date;
}

/**
 * The single atomic finalization operation. Every step below runs inside
 * the caller's transaction (see withAuthorizedTransaction) — if any step
 * throws, Prisma rolls back the whole transaction: the invoice remains
 * Draft and no invoice number is consumed (DEC-INV-005 / INV-NUM-004).
 *
 * Step numbering below matches Section 10 of the Phase 3 brief exactly.
 */
export async function finalizeInvoice(tx: Tx, auth: AuthContext, input: FinalizeInvoiceInput) {
  const invoiceDate = input.invoiceDate ?? new Date();

  // Step 1-2: verify invoice is Draft; verify business authorization.
  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { lineItems: true, client: true, business: true },
  });
  if (!invoice) throw new NotFoundError("Invoice not found.");
  await assertBusinessAccess(tx, auth, invoice.businessId);

  if (invoice.status !== "DRAFT") {
    throw new InvalidStateError(`Cannot finalize an invoice in status ${invoice.status}.`);
  }

  // Step 3: validate required invoice data.
  if (invoice.lineItems.length === 0) {
    throw new ValidationError("Cannot finalize an invoice with no line items.");
  }

  // Step 4: resolve the applicable tax configuration.
  const taxConfig = await resolveEffectiveTaxConfiguration(tx, invoice.businessId, invoiceDate);

  // Steps 5-10: calculate line subtotals, pre-tax subtotal, tax groups,
  // total tax, invoice total — all via the single centralized engine.
  const calculation = calculateInvoice(
    invoice.lineItems
      .slice()
      .sort((a, b) => a.lineOrder - b.lineOrder)
      .map((line) => ({
        key: line.id,
        quantity: new Decimal(line.quantity.toString()),
        unitPrice: new Decimal(line.unitPrice.toString()),
        taxStatus: line.taxStatus,
      })),
    taxConfig.taxLines,
  );

  // Step 11: allocate the next invoice number for that Business.
  const invoiceNumber = await allocateNextInvoiceNumber(tx, invoice.businessId);

  // Step 13-14: frozen billed-identity snapshots.
  const billedClientSnapshot = buildBilledClientSnapshot(invoice.client);
  const billedBusinessSnapshot = buildBilledBusinessSnapshot(invoice.business);

  // Steps 5/12/15/16: persist frozen line item values, tax snapshot, set
  // status to Finalized, set finalizedAt — as one write set.
  const finalizedAt = new Date();

  for (const line of calculation.lineItems) {
    await tx.invoiceLineItem.update({
      where: { id: line.key },
      data: {
        lineSubtotal: line.lineSubtotal.toFixed(2),
        taxGroupKey: line.taxGroupKey,
      },
    });
  }

  await tx.invoiceTaxLine.createMany({
    data: calculation.taxGroups.map((group) => ({
      invoiceId: invoice.id,
      taxAuthority: group.taxAuthority,
      taxType: group.taxType,
      rate: group.rate.toFixed(5),
      taxableSubtotal: group.taxableSubtotal.toFixed(2),
      taxAmount: group.taxAmount.toFixed(2),
    })),
  });

  const updated = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "FINALIZED",
      invoiceNumber,
      invoiceDate,
      preTaxSubtotal: calculation.preTaxSubtotal.toFixed(2),
      totalTax: calculation.totalTax.toFixed(2),
      invoiceTotal: calculation.invoiceTotal.toFixed(2),
      billedClientSnapshot: billedClientSnapshot as unknown as object,
      billedBusinessSnapshot: billedBusinessSnapshot as unknown as object,
      finalizedAt,
    },
  });

  // Step 17: required audit event.
  await recordAuditEvent(tx, {
    businessId: invoice.businessId,
    eventType: "INVOICE_FINALIZED",
    actorUserId: auth.userId,
    entityType: "Invoice",
    entityId: invoice.id,
    newValues: {
      invoiceNumber,
      invoiceTotal: calculation.invoiceTotal.toFixed(2),
      taxConfigurationVersionId: taxConfig.taxConfigurationVersionId,
    },
  });

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────
// Void (DEC-INV-007; INV-VOID-*) and Correction (DEC-INV-008; INV-CORR-*)
// ─────────────────────────────────────────────────────────────────────────

export interface VoidInvoiceInput {
  invoiceId: string;
  reason?: string;
}

export async function voidInvoice(tx: Tx, auth: AuthContext, input: VoidInvoiceInput) {
  const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new NotFoundError("Invoice not found.");
  await assertBusinessAccess(tx, auth, invoice.businessId);

  if (invoice.status !== "FINALIZED") {
    throw new InvalidStateError("Only a Finalized invoice can be voided.");
  }

  // Void is permitted regardless of payment status (DEC-INV-007). Existing
  // payments are deliberately left untouched — no automatic reversal,
  // movement, or reassignment (INV-VOID-001/002).
  const updated = await tx.invoice.update({
    where: { id: invoice.id },
    data: { status: "VOID", voidedAt: new Date(), voidReason: input.reason },
  });

  await recordAuditEvent(tx, {
    businessId: invoice.businessId,
    eventType: "INVOICE_VOIDED",
    actorUserId: auth.userId,
    entityType: "Invoice",
    entityId: invoice.id,
    priorValues: { status: "FINALIZED" },
    newValues: { status: "VOID", voidReason: input.reason ?? null },
  });

  return updated;
}

/**
 * Step 2 of the correction mechanism (DEC-INV-008): creates a new Draft
 * linked to the original (now-Void) invoice via `replacesInvoiceId`. The
 * caller then edits/finalizes it like any ordinary invoice (own number,
 * own invoice date — INV-CORR-002) — this function does not finalize it
 * and does not copy line items across (the whole point of a correction is
 * that the content changes; copying stale content would defeat that).
 * Payments are never transferred (INV-CORR-004).
 */
export async function createReplacementDraft(tx: Tx, auth: AuthContext, originalInvoiceId: string) {
  const original = await tx.invoice.findUnique({ where: { id: originalInvoiceId } });
  if (!original) throw new NotFoundError("Original invoice not found.");
  await assertBusinessAccess(tx, auth, original.businessId);

  if (original.status !== "VOID") {
    throw new InvalidStateError(
      "A replacement can only be created for a Void invoice. Void the original first.",
    );
  }

  const existingReplacement = await tx.invoice.findUnique({
    where: { replacesInvoiceId: originalInvoiceId },
  });
  if (existingReplacement) {
    throw new InvalidStateError("This invoice has already been replaced.");
  }

  const replacement = await tx.invoice.create({
    data: {
      businessId: original.businessId,
      clientId: original.clientId,
      status: "DRAFT",
      replacesInvoiceId: original.id,
    },
  });

  await recordAuditEvent(tx, {
    businessId: original.businessId,
    eventType: "INVOICE_CREATED",
    actorUserId: auth.userId,
    entityType: "Invoice",
    entityId: replacement.id,
    newValues: { status: "DRAFT", replacesInvoiceId: original.id },
    metadata: { correctionOf: original.id },
  });

  return replacement;
}

/**
 * Convenience wrapper recording the REPLACEMENT_INVOICE_CREATED audit
 * event once the replacement Draft is itself finalized (Phase 2 §11
 * event #5 — distinct from the plain INVOICE_FINALIZED event every
 * invoice gets). Call immediately after finalizeInvoice for a Draft that
 * has a non-null replacesInvoiceId.
 */
export async function recordReplacementFinalizedAudit(
  tx: Tx,
  auth: AuthContext,
  replacementInvoiceId: string,
  originalInvoiceId: string,
) {
  const replacement = await tx.invoice.findUniqueOrThrow({ where: { id: replacementInvoiceId } });
  await recordAuditEvent(tx, {
    businessId: replacement.businessId,
    eventType: "REPLACEMENT_INVOICE_CREATED",
    actorUserId: auth.userId,
    entityType: "Invoice",
    entityId: replacementInvoiceId,
    newValues: { replacesInvoiceId: originalInvoiceId },
  });
}
