import type { Prisma } from "@prisma/client";
import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { recordAuditEvent } from "./audit";
import { InvalidStateError, NotFoundError, ValidationError } from "./errors";

/**
 * Persistence for the Calendar boundary (Section 23 of the Phase 3 brief;
 * Phase 2 §12): Calendar Event → Work Candidate → Review → Invoice Draft.
 *
 * This module deliberately implements NO synchronization with the Google
 * Calendar API, NO client/service matching algorithm, and NO confidence
 * scoring or duplicate-detection algorithm — all of those are explicitly
 * UNRESOLVED per Phase 0/1/2 (DEC-ARCH-023/024/025) and out of scope for
 * this phase (Section 23: "Do not implement full Google Calendar
 * synchronization yet"). What it implements is the review-gate state
 * machine and its persistence, which IS fully specified: a WorkCandidate
 * moves pending → edited → approved | rejected, and only an `approved`
 * candidate may back an InvoiceLineItem (Phase 0 critical rule; INV-CAL-*).
 */

export async function editWorkCandidate(
  tx: Tx,
  auth: AuthContext,
  workCandidateId: string,
  edits: { clientId?: string; serviceId?: string; editedDescription?: string; editedQuantity?: string },
) {
  const candidate = await tx.workCandidate.findUnique({ where: { id: workCandidateId } });
  if (!candidate) throw new NotFoundError("Work candidate not found.");
  await assertBusinessAccess(tx, auth, candidate.businessId);

  if (candidate.reviewState === "APPROVED" || candidate.reviewState === "REJECTED") {
    throw new InvalidStateError("Cannot edit a work candidate that has already been approved or rejected.");
  }

  const updated = await tx.workCandidate.update({
    where: { id: candidate.id },
    data: {
      clientId: edits.clientId,
      serviceId: edits.serviceId,
      editedDescription: edits.editedDescription,
      editedQuantity: edits.editedQuantity,
      reviewState: "EDITED",
    },
  });

  await recordAuditEvent(tx, {
    businessId: candidate.businessId,
    eventType: "WORK_CANDIDATE_EDITED",
    actorUserId: auth.userId,
    entityType: "WorkCandidate",
    entityId: candidate.id,
    newValues: edits as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

export async function rejectWorkCandidate(tx: Tx, auth: AuthContext, workCandidateId: string) {
  const candidate = await tx.workCandidate.findUnique({ where: { id: workCandidateId } });
  if (!candidate) throw new NotFoundError("Work candidate not found.");
  await assertBusinessAccess(tx, auth, candidate.businessId);

  if (candidate.reviewState === "APPROVED") {
    throw new InvalidStateError("Cannot reject a work candidate that has already been approved.");
  }

  const updated = await tx.workCandidate.update({
    where: { id: candidate.id },
    data: { reviewState: "REJECTED" },
  });

  // Retained, not deleted — supports audit and duplicate-detection on
  // later syncs (Phase 0 CAL-REJ-002).
  await recordAuditEvent(tx, {
    businessId: candidate.businessId,
    eventType: "WORK_CANDIDATE_REJECTED",
    actorUserId: auth.userId,
    entityType: "WorkCandidate",
    entityId: candidate.id,
    priorValues: { reviewState: candidate.reviewState },
    newValues: { reviewState: "REJECTED" },
  });

  return updated;
}

/**
 * Approves a WorkCandidate and converts it into an InvoiceLineItem on the
 * given Draft invoice (Phase 0 FR-CAL-011; the review gate, Phase 2 §12
 * Section 6). This is the ONLY path by which Calendar-derived data may
 * enter an Invoice's financial fields — it requires an explicit approval
 * action and produces its own audit event, distinct from and in addition
 * to whatever audit event later covers the invoice's own finalization.
 */
export async function approveWorkCandidate(
  tx: Tx,
  auth: AuthContext,
  workCandidateId: string,
  targetInvoiceId: string,
  lineOrder: number,
) {
  const candidate = await tx.workCandidate.findUnique({ where: { id: workCandidateId } });
  if (!candidate) throw new NotFoundError("Work candidate not found.");
  await assertBusinessAccess(tx, auth, candidate.businessId);

  if (candidate.reviewState === "APPROVED" || candidate.reviewState === "REJECTED") {
    throw new InvalidStateError("This work candidate has already been approved or rejected.");
  }
  if (!candidate.clientId || !candidate.editedDescription || !candidate.editedQuantity) {
    throw new ValidationError(
      "A work candidate must have a client, description, and quantity before it can be approved.",
    );
  }

  const invoice = await tx.invoice.findUnique({ where: { id: targetInvoiceId } });
  if (!invoice) throw new NotFoundError("Target invoice not found.");
  if (invoice.businessId !== candidate.businessId) {
    throw new ValidationError("Target invoice must belong to the same business as the work candidate.");
  }
  if (invoice.status !== "DRAFT") {
    throw new InvalidStateError("Approved work can only be added to a Draft invoice.");
  }

  let unitPrice = "0.00";
  if (candidate.serviceId) {
    const service = await tx.service.findUnique({ where: { id: candidate.serviceId } });
    if (service) unitPrice = service.defaultRate.toString();
  }

  const lineItem = await tx.invoiceLineItem.create({
    data: {
      invoiceId: invoice.id,
      lineOrder,
      description: candidate.editedDescription,
      quantity: candidate.editedQuantity,
      unitPrice,
      lineSubtotal: "0.00", // recalculated properly by setDraftLineItems/finalizeInvoice
      taxStatus: "TAXABLE",
      serviceId: candidate.serviceId,
      workCandidateId: candidate.id,
    },
  });

  await tx.workCandidate.update({ where: { id: candidate.id }, data: { reviewState: "APPROVED" } });

  await recordAuditEvent(tx, {
    businessId: candidate.businessId,
    eventType: "WORK_CANDIDATE_APPROVED",
    actorUserId: auth.userId,
    entityType: "WorkCandidate",
    entityId: candidate.id,
    newValues: { invoiceId: invoice.id, lineItemId: lineItem.id },
  });

  return lineItem;
}
