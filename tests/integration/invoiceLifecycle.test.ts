import { describe, expect, it } from "vitest";
import { createFullTestFixture, withTx } from "../support/factories";
import {
  createDraftInvoice,
  createReplacementDraft,
  finalizeInvoice,
  setDraftLineItems,
  voidInvoice,
} from "@/server/domain/invoiceLifecycle";
import { InvalidStateError } from "@/server/domain/errors";

describe("invoice lifecycle — states and transitions (INV-LIFE-*)", () => {
  it("a Draft can be finalized", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const finalized = await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      expect(draft.status).toBe("DRAFT");
      expect(draft.invoiceNumber).toBeNull();

      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Consulting", quantity: "2", unitPrice: "100.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);

      return finalizeInvoice(tx, auth, { invoiceId: draft.id });
    });

    expect(finalized.status).toBe("FINALIZED");
    expect(finalized.invoiceNumber).not.toBeNull();
  });

  it("a Draft cannot be voided (drafts are deleted, not voided)", async () => {
    const { auth, business, client } = await createFullTestFixture();

    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await expect(voidInvoice(tx, auth, { invoiceId: draft.id })).rejects.toBeInstanceOf(InvalidStateError);
    });
  });

  it("a Finalized invoice cannot return to Draft (no unfinalize operation exists)", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "50.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      const finalized = await finalizeInvoice(tx, auth, { invoiceId: draft.id });
      expect(finalized.status).toBe("FINALIZED");

      // Attempting to finalize again (the only state-changing operation
      // that could move it) fails — there is no unfinalize path at all.
      await expect(finalizeInvoice(tx, auth, { invoiceId: draft.id })).rejects.toBeInstanceOf(InvalidStateError);
    });
  });

  it("Void is terminal: cannot be finalized again or replaced twice", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "50.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      const finalized = await finalizeInvoice(tx, auth, { invoiceId: draft.id });
      const voided = await voidInvoice(tx, auth, { invoiceId: finalized.id, reason: "test" });
      expect(voided.status).toBe("VOID");

      await expect(finalizeInvoice(tx, auth, { invoiceId: voided.id })).rejects.toBeInstanceOf(InvalidStateError);
      await expect(voidInvoice(tx, auth, { invoiceId: voided.id })).rejects.toBeInstanceOf(InvalidStateError);

      // A replacement can be created once...
      const replacement = await createReplacementDraft(tx, auth, voided.id);
      expect(replacement.replacesInvoiceId).toBe(voided.id);
      // ...but not twice.
      await expect(createReplacementDraft(tx, auth, voided.id)).rejects.toBeInstanceOf(InvalidStateError);
    });
  });

  it("correction: void + replacement gets its own number and its own date, never backdated", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Original work", quantity: "1", unitPrice: "500.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      const original = await finalizeInvoice(tx, auth, {
        invoiceId: draft.id,
        invoiceDate: new Date("2025-01-15"),
      });
      const voided = await voidInvoice(tx, auth, { invoiceId: original.id, reason: "wrong amount" });

      const replacementDraft = await createReplacementDraft(tx, auth, voided.id);
      await setDraftLineItems(tx, auth, replacementDraft.id, [
        { description: "Corrected work", quantity: "1", unitPrice: "550.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      const replacement = await finalizeInvoice(tx, auth, {
        invoiceId: replacementDraft.id,
        invoiceDate: new Date("2025-03-01"),
      });

      expect(replacement.invoiceNumber).not.toBe(original.invoiceNumber);
      expect(replacement.invoiceDate?.toISOString().slice(0, 10)).toBe("2025-03-01");
      expect(replacement.replacesInvoiceId).toBe(original.id);
      expect(replacement.preTaxSubtotal?.toFixed(2)).toBe("550.00");

      // Original remains visible, frozen, and Void.
      const originalReloaded = await tx.invoice.findUniqueOrThrow({ where: { id: original.id } });
      expect(originalReloaded.status).toBe("VOID");
      expect(originalReloaded.preTaxSubtotal?.toFixed(2)).toBe("500.00");
    });
  });
});
