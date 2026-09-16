import type { AuditEventType, Prisma } from "@prisma/client";
import type { Tx } from "@/server/db/authorizedTransaction";

/**
 * Records one append-only AuditEvent (Phase 1 §10; Phase 2 §11;
 * INV-AUD-001/002/003). This is the *only* sanctioned way to write to the
 * audit_event table — no domain function should ever call
 * `tx.auditEvent.update(...)` or `.delete(...)`; those are additionally
 * blocked at the database level by a trigger (see the hand-written
 * migration) so this rule holds even if application code forgets it.
 *
 * `priorValues` must be supplied for any event representing a change to a
 * previously-established value (tax configuration changes, payment
 * reversals, invoice-affecting business settings changes — DEC-AUDIT-001).
 * Purely additive events (creation, recording) correctly have no prior
 * value and should omit it.
 */
export interface RecordAuditEventInput {
  businessId: string;
  eventType: AuditEventType;
  actorUserId: string;
  entityType: string;
  entityId: string;
  priorValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAuditEvent(tx: Tx, input: RecordAuditEventInput): Promise<void> {
  await tx.auditEvent.create({
    data: {
      businessId: input.businessId,
      eventType: input.eventType,
      actorUserId: input.actorUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      priorValues: input.priorValues,
      newValues: input.newValues,
      metadata: input.metadata,
    },
  });
}
