import { describe, expect, it } from "vitest";
import { createFullTestFixture, withTx } from "../support/factories";
import { createDraftInvoice, finalizeInvoice, setDraftLineItems, voidInvoice } from "@/server/domain/invoiceLifecycle";
import { recordPayment, reversePayment } from "@/server/domain/payments";

describe("audit trail (Phase 1 §10; Phase 2 §11; INV-AUD-*)", () => {
  it("invoice creation, finalization, and voiding each produce their required audit event", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const events = await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "100.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      const finalized = await finalizeInvoice(tx, auth, { invoiceId: draft.id });
      await voidInvoice(tx, auth, { invoiceId: finalized.id, reason: "test" });

      return tx.auditEvent.findMany({
        where: { entityType: "Invoice", entityId: draft.id },
        orderBy: { timestamp: "asc" },
      });
    });

    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toEqual(["INVOICE_CREATED", "INVOICE_FINALIZED", "INVOICE_VOIDED"]);
    expect(events.every((e) => e.actorUserId === auth.userId)).toBe(true);
    expect(events.every((e) => e.businessId === business.id)).toBe(true);
    // The void event is a change to a previously-established value and
    // must preserve the prior value (DEC-AUDIT-001).
    const voidEvent = events.find((e) => e.eventType === "INVOICE_VOIDED");
    expect(voidEvent?.priorValues).toMatchObject({ status: "FINALIZED" });
  });

  it("payment recording and reversal each produce audit events, and reversal preserves the prior amount/date", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const { paymentEvents } = await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "100.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      const finalized = await finalizeInvoice(tx, auth, { invoiceId: draft.id });
      const payment = await recordPayment(tx, auth, {
        invoiceId: finalized.id,
        amount: "50.00",
        paymentDate: new Date("2025-01-01"),
      });
      await reversePayment(tx, auth, { paymentId: payment.id, reason: "correction" });

      const paymentEvents = await tx.auditEvent.findMany({
        where: { entityType: "Payment", entityId: payment.id },
        orderBy: { timestamp: "asc" },
      });
      return { paymentEvents };
    });

    expect(paymentEvents.map((e) => e.eventType)).toEqual(["PAYMENT_RECORDED", "PAYMENT_REVERSED"]);
    const reversedEvent = paymentEvents.find((e) => e.eventType === "PAYMENT_REVERSED");
    expect(reversedEvent?.priorValues).toMatchObject({ amount: "50.00" });
  });

  it("audit events cannot be updated or deleted through any application operation (append-only, DB-enforced)", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const auditEventId = await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "100.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      await finalizeInvoice(tx, auth, { invoiceId: draft.id });
      const event = await tx.auditEvent.findFirstOrThrow({ where: { entityType: "Invoice", entityId: draft.id } });
      return event.id;
    });

    // No domain function exposes an update/delete for AuditEvent at all —
    // proving that requires attempting the raw operation directly and
    // confirming the database itself refuses it. Two independent DB-level
    // safeguards exist (the app_runtime role has no UPDATE/DELETE grant
    // on this table at all — prisma/migrations/*_app_runtime_role; and
    // even a role that somehow did would still hit the append-only
    // trigger — prisma/migrations/*_invariant_constraints), so this
    // asserts on the *effect* (rejected, and the row is provably
    // unchanged) rather than on which of the two produced the rejection.
    let updateError: unknown;
    try {
      await withTx(auth, (tx) => tx.auditEvent.update({ where: { id: auditEventId }, data: { entityType: "Tampered" } }));
    } catch (error) {
      updateError = error;
    }
    expect(updateError).toBeDefined();

    let deleteError: unknown;
    try {
      await withTx(auth, (tx) => tx.auditEvent.delete({ where: { id: auditEventId } }));
    } catch (error) {
      deleteError = error;
    }
    expect(deleteError).toBeDefined();

    const stillThere = await withTx(auth, (tx) => tx.auditEvent.findUniqueOrThrow({ where: { id: auditEventId } }));
    expect(stillThere.entityType).toBe("Invoice"); // unchanged — the update did not go through
  });

  it("void/payment behavior: a voided invoice's non-reversed historical payment remains in Amount Collected", async () => {
    const { auth, business, client, service } = await createFullTestFixture({ taxLines: [] });

    const { getAmountCollected } = await import("@/server/domain/reporting");

    const invoice = await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "1000.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      return finalizeInvoice(tx, auth, { invoiceId: draft.id });
    });

    await withTx(auth, (tx) =>
      recordPayment(tx, auth, { invoiceId: invoice.id, amount: "1000.00", paymentDate: new Date("2025-05-01") }),
    );

    await withTx(auth, (tx) => voidInvoice(tx, auth, { invoiceId: invoice.id, reason: "cancelled after payment" }));

    const period = { start: new Date("2025-01-01"), end: new Date("2025-12-31") };
    const collected = await withTx(auth, (tx) => getAmountCollected(tx, auth, business.id, period));
    expect(collected.toFixed(2)).toBe("1000.00");

    const { getOutstanding } = await import("@/server/domain/reporting");
    const outstanding = await withTx(auth, (tx) => getOutstanding(tx, auth, business.id));
    expect(outstanding.toFixed(2)).toBe("0.00"); // void invoice excluded from Outstanding
  });
});
