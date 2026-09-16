import { describe, expect, it } from "vitest";
import { createFullTestFixture, withTx } from "../support/factories";
import { UnresolvedTaxApplicabilityError } from "@/server/domain/errors";
import { createDraftInvoice, finalizeInvoice, setDraftLineItems } from "@/server/domain/invoiceLifecycle";
import { getRevenue, getSalesTax } from "@/server/domain/reporting";

describe("financial calculations, end-to-end through finalization (Phase 2 §07, INV-TAX-*, INV-RND-*)", () => {
  it("rejects a quantity/unit price with more than 2 decimal places rather than silently truncating it (DEC-MONEY-004/005)", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await expect(
        setDraftLineItems(tx, auth, draft.id, [
          { description: "Line 1", quantity: "3", unitPrice: "33.333", taxStatus: "TAXABLE", serviceId: service.id },
        ]),
      ).rejects.toThrow(/decimal places/);
    });
  });

  it("rounds line subtotals (product of valid 2-decimal inputs) half-up to the nearest cent", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const finalized = await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        // 1.33 × 75.50 = 100.415 → rounds to 100.42 (round-half-up)
        { description: "Line 1", quantity: "1.33", unitPrice: "75.50", taxStatus: "TAXABLE", serviceId: service.id },
        // 1.50 × 0.33 = 0.495 → rounds to 0.50 (round-half-up)
        { description: "Line 2", quantity: "1.50", unitPrice: "0.33", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      return finalizeInvoice(tx, auth, { invoiceId: draft.id });
    });

    const lineItems = await withTx(auth, (tx) =>
      tx.invoiceLineItem.findMany({ where: { invoiceId: finalized.id }, orderBy: { lineOrder: "asc" } }),
    );
    expect(lineItems[0]?.lineSubtotal.toFixed(2)).toBe("100.42");
    expect(lineItems[1]?.lineSubtotal.toFixed(2)).toBe("0.50");
    expect(finalized.preTaxSubtotal?.toFixed(2)).toBe("100.92");
  });

  it("does not finalize an invoice when multiple configured tax groups make applicability unresolved", async () => {
    const { auth, business, client, service } = await createFullTestFixture({
      taxLines: [
        { taxAuthority: "CRA", taxType: "GST", rate: "0.05" },
        { taxAuthority: "BC Ministry of Finance", taxType: "PST", rate: "0.07" },
      ],
    });

    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "1000.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      await expect(finalizeInvoice(tx, auth, { invoiceId: draft.id })).rejects.toThrow(UnresolvedTaxApplicabilityError);
    });

    const draft = await withTx(auth, (tx) => tx.invoice.findFirstOrThrow({ where: { businessId: business.id } }));
    expect(draft.status).toBe("DRAFT");
    const taxLines = await withTx(auth, (tx) => tx.invoiceTaxLine.findMany({ where: { invoiceId: draft.id } }));
    expect(taxLines).toHaveLength(0);
  });

  it("does not finalize when the same authority/type has two rates because applicability is unresolved", async () => {
    const { auth, business, client, service } = await createFullTestFixture({
      taxLines: [
        { taxAuthority: "CRA", taxType: "GST", rate: "0.05" },
        { taxAuthority: "CRA", taxType: "GST", rate: "0.10" },
      ],
    });

    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "100.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      await expect(finalizeInvoice(tx, auth, { invoiceId: draft.id })).rejects.toThrow(UnresolvedTaxApplicabilityError);
    });
  });

  it("Revenue excludes sales tax (INV-REV-002)", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "1000.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      await finalizeInvoice(tx, auth, { invoiceId: draft.id, invoiceDate: new Date("2025-06-15") });
    });

    const period = { start: new Date("2025-01-01"), end: new Date("2025-12-31") };
    const revenue = await withTx(auth, (tx) => getRevenue(tx, auth, business.id, period));
    const salesTax = await withTx(auth, (tx) => getSalesTax(tx, auth, business.id, period));

    expect(revenue.toFixed(2)).toBe("1000.00");
    expect(salesTax.toFixed(2)).toBe("50.00");
    // Revenue must never include tax — confirm it is strictly the pre-tax figure.
    expect(revenue.toFixed(2)).not.toBe("1050.00");
  });
});
