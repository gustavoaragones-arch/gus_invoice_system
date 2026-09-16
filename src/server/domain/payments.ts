import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { recordAuditEvent } from "./audit";
import { Decimal, calculateBalanceDue, calculateOverpayment, sumNonReversedPayments } from "./money";
import { InvalidStateError, NotFoundError, ValidationError } from "./errors";

// ─────────────────────────────────────────────────────────────────────────
// Recording (DEC-PAY-003; INV-PAY-*)
// ─────────────────────────────────────────────────────────────────────────

export interface RecordPaymentInput {
  invoiceId: string;
  amount: string;
  paymentDate: Date;
  method?: string;
  notes?: string;
}

export async function recordPayment(tx: Tx, auth: AuthContext, input: RecordPaymentInput) {
  const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new NotFoundError("Invoice not found.");
  await assertBusinessAccess(tx, auth, invoice.businessId);

  // Payments may only be created against Finalized + non-Void invoices
  // (Section 17 of the Phase 3 brief; Phase 1 FR-PAY-007).
  if (invoice.status !== "FINALIZED") {
    throw new InvalidStateError(
      `Payments can only be recorded against a Finalized invoice (current status: ${invoice.status}).`,
    );
  }

  const amount = new Decimal(input.amount);
  if (!amount.greaterThan(0)) {
    throw new ValidationError("Payment amount must be greater than zero.");
  }

  // Overpayment is accepted, not blocked (DEC-PAY-002) — the excess is
  // surfaced via calculateOverpayment/getInvoiceBalance, never silently
  // applied elsewhere and never rejected.
  const payment = await tx.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: amount.toFixed(2),
      paymentDate: input.paymentDate,
      method: input.method,
      notes: input.notes,
    },
  });

  await recordAuditEvent(tx, {
    businessId: invoice.businessId,
    eventType: "PAYMENT_RECORDED",
    actorUserId: auth.userId,
    entityType: "Payment",
    entityId: payment.id,
    newValues: { invoiceId: invoice.id, amount: amount.toFixed(2), paymentDate: input.paymentDate },
  });

  return payment;
}

// ─────────────────────────────────────────────────────────────────────────
// Non-financial correction — method/notes only (DEC-PAY-003)
// ─────────────────────────────────────────────────────────────────────────

export interface CorrectPaymentMethodNoteInput {
  paymentId: string;
  method?: string;
  notes?: string;
}

export async function correctPaymentMethodNote(
  tx: Tx,
  auth: AuthContext,
  input: CorrectPaymentMethodNoteInput,
) {
  const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { invoice: true } });
  if (!payment) throw new NotFoundError("Payment not found.");
  await assertBusinessAccess(tx, auth, payment.invoice.businessId);

  const priorValues = { method: payment.method, notes: payment.notes };

  const updated = await tx.payment.update({
    where: { id: payment.id },
    data: { method: input.method, notes: input.notes },
  });

  await recordAuditEvent(tx, {
    businessId: payment.invoice.businessId,
    eventType: "PAYMENT_METHOD_NOTE_CORRECTED",
    actorUserId: auth.userId,
    entityType: "Payment",
    entityId: payment.id,
    priorValues,
    newValues: { method: input.method ?? null, notes: input.notes ?? null },
  });

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────
// Reversal — the only way to correct amount/date (DEC-PAY-004; INV-PREV-*)
// ─────────────────────────────────────────────────────────────────────────

export interface ReversePaymentInput {
  paymentId: string;
  reason?: string;
}

export async function reversePayment(tx: Tx, auth: AuthContext, input: ReversePaymentInput) {
  const payment = await tx.payment.findUnique({
    where: { id: input.paymentId },
    include: { invoice: true, reversal: true },
  });
  if (!payment) throw new NotFoundError("Payment not found.");
  await assertBusinessAccess(tx, auth, payment.invoice.businessId);

  if (payment.reversal) {
    throw new InvalidStateError("This payment has already been reversed.");
  }

  // The original Payment is never modified or deleted — reversal is
  // additive (INV-PREV-002).
  const reversal = await tx.paymentReversal.create({
    data: { paymentId: payment.id, reason: input.reason },
  });

  await recordAuditEvent(tx, {
    businessId: payment.invoice.businessId,
    eventType: "PAYMENT_REVERSED",
    actorUserId: auth.userId,
    entityType: "Payment",
    entityId: payment.id,
    priorValues: { amount: payment.amount.toFixed(2), paymentDate: payment.paymentDate },
    newValues: { reversalId: reversal.id, reason: input.reason ?? null },
  });

  return reversal;
}

// ─────────────────────────────────────────────────────────────────────────
// Balance (DEC-PAY-001)
// ─────────────────────────────────────────────────────────────────────────

export interface InvoiceBalance {
  invoiceTotal: Decimal;
  amountPaid: Decimal;
  balanceDue: Decimal;
  overpayment: Decimal;
}

export async function getInvoiceBalance(tx: Tx, auth: AuthContext, invoiceId: string): Promise<InvoiceBalance> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { include: { reversal: true } } },
  });
  if (!invoice) throw new NotFoundError("Invoice not found.");
  await assertBusinessAccess(tx, auth, invoice.businessId);

  const invoiceTotal = new Decimal(invoice.invoiceTotal?.toString() ?? "0");
  const nonReversedAmounts = invoice.payments
    .filter((p) => !p.reversal)
    .map((p) => new Decimal(p.amount.toString()));
  const amountPaid = sumNonReversedPayments(nonReversedAmounts);

  return {
    invoiceTotal,
    amountPaid,
    balanceDue: calculateBalanceDue(invoiceTotal, amountPaid),
    overpayment: calculateOverpayment(invoiceTotal, amountPaid),
  };
}
