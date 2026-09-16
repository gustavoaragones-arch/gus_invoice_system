import { describe, expect, it } from "vitest";
import { createFullTestFixture, withTx } from "../support/factories";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { createDraftInvoice, finalizeInvoice, setDraftLineItems, voidInvoice } from "@/server/domain/invoiceLifecycle";
import { ValidationError } from "@/server/domain/errors";

describe("invoice numbering (DEC-INV-002/003/004/005; INV-NUM-*)", () => {
  it("a Draft has no invoice number", async () => {
    const { auth, business, client } = await createFullTestFixture();
    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      expect(draft.invoiceNumber).toBeNull();
    });
  });

  it("a number is assigned only at finalization, and numbers are sequential per business", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await withTx(auth, async (tx) => {
      const numbers: string[] = [];
      for (let i = 0; i < 3; i++) {
        const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
        expect(draft.invoiceNumber).toBeNull();
        await setDraftLineItems(tx, auth, draft.id, [
          { description: `Work ${i}`, quantity: "1", unitPrice: "10.00", taxStatus: "TAXABLE", serviceId: service.id },
        ]);
        const finalized = await finalizeInvoice(tx, auth, { invoiceId: draft.id });
        numbers.push(finalized.invoiceNumber as string);
      }
      expect(numbers).toEqual(["1", "2", "3"]);
    });
  });

  it("numbers are Business-scoped: two businesses each start their own sequence at 1", async () => {
    const fixtureA = await createFullTestFixture();
    const fixtureB = await createFullTestFixture();

    async function finalizeOneInvoice(fixture: typeof fixtureA) {
      return withTx(fixture.auth, async (tx) => {
        const draft = await createDraftInvoice(tx, fixture.auth, {
          businessId: fixture.business.id,
          clientId: fixture.client.id,
        });
        await setDraftLineItems(tx, fixture.auth, draft.id, [
          { description: "Work", quantity: "1", unitPrice: "10.00", taxStatus: "TAXABLE", serviceId: fixture.service.id },
        ]);
        return finalizeInvoice(tx, fixture.auth, { invoiceId: draft.id });
      });
    }

    const invoiceA = await finalizeOneInvoice(fixtureA);
    const invoiceB = await finalizeOneInvoice(fixtureB);
    expect(invoiceA.invoiceNumber).toBe("1");
    expect(invoiceB.invoiceNumber).toBe("1");
    expect(invoiceA.businessId).not.toBe(invoiceB.businessId);
  });

  it("a voided invoice's number remains permanently consumed and is never reused", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await withTx(auth, async (tx) => {
      const draft1 = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft1.id, [
        { description: "Work", quantity: "1", unitPrice: "10.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      const finalized1 = await finalizeInvoice(tx, auth, { invoiceId: draft1.id });
      expect(finalized1.invoiceNumber).toBe("1");

      await voidInvoice(tx, auth, { invoiceId: finalized1.id });

      const draft2 = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft2.id, [
        { description: "More work", quantity: "1", unitPrice: "10.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      const finalized2 = await finalizeInvoice(tx, auth, { invoiceId: draft2.id });

      // Next number is 2, not a reuse of 1 — the gap at a void is expected.
      expect(finalized2.invoiceNumber).toBe("2");
    });
  });

  it("a failed finalization (validation error) does not consume a number", async () => {
    const { auth, business, client } = await createFullTestFixture();

    await withTx(auth, async (tx) => {
      const draft1 = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      // No line items set — finalization must fail validation.
      await expect(finalizeInvoice(tx, auth, { invoiceId: draft1.id })).rejects.toBeInstanceOf(ValidationError);

      const reloaded = await tx.invoice.findUniqueOrThrow({ where: { id: draft1.id } });
      expect(reloaded.status).toBe("DRAFT");
      expect(reloaded.invoiceNumber).toBeNull();
    });
  });

  it("finalization is truly atomic: a failure rolls back the whole top-level transaction", async () => {
    const { auth, business, client } = await createFullTestFixture();

    const draft = await withTx(auth, (tx) =>
      createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id }),
    );

    // finalizeInvoice run as its OWN top-level transaction (the way
    // production code calls it), not nested inside a broader one that
    // could mask a partial commit.
    await expect(
      withAuthorizedTransaction(auth, (tx) => finalizeInvoice(tx, auth, { invoiceId: draft.id })),
    ).rejects.toBeInstanceOf(ValidationError);

    // A fresh transaction confirms nothing from the failed attempt stuck.
    await withTx(auth, async (tx) => {
      const reloaded = await tx.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(reloaded.status).toBe("DRAFT");
      expect(reloaded.invoiceNumber).toBeNull();
      const taxLineCount = await tx.invoiceTaxLine.count({ where: { invoiceId: draft.id } });
      expect(taxLineCount).toBe(0);
    });
  });
});
