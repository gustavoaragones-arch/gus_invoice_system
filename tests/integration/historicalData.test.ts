import { describe, expect, it } from "vitest";
import { createFullTestFixture, withTx } from "../support/factories";
import { importHistoricalInvoice } from "@/server/domain/historicalImport";

describe("historical data and provenance (DEC-HIST-*; INV-HIST-*)", () => {
  it("a historical invoice is created directly as Finalized with HISTORICAL_IMPORT provenance", async () => {
    const { auth, business, client } = await createFullTestFixture();

    const imported = await withTx(auth, (tx) =>
      importHistoricalInvoice(tx, auth, {
        businessId: business.id,
        clientId: client.id,
        invoiceNumber: "INV-1998-042",
        invoiceDate: new Date("1998-06-01"),
        lineItems: [
          {
            description: "Legacy consulting work",
            quantity: "10.00",
            unitPrice: "50.00",
            lineSubtotal: "500.00",
            taxStatus: "TAXABLE",
          },
        ],
        taxLines: [
          {
            taxAuthority: "CRA",
            taxType: "GST",
            rate: "0.07", // the GST rate in 1998 — different from today's 5%
            taxableSubtotal: "500.00",
            taxAmount: "35.00",
          },
        ],
        preTaxSubtotal: "500.00",
        totalTax: "35.00",
        invoiceTotal: "535.00",
        billedClientSnapshot: { name: "Old Client Name", billingAddress: null, contactEmail: null },
        billedBusinessSnapshot: {
          legalName: "Legacy Business Name",
          address: null,
          gstHstRegistrationNumber: null,
          brandingLogoRef: null,
        },
      }),
    );

    expect(imported.status).toBe("FINALIZED");
    expect(imported.provenance).toBe("HISTORICAL_IMPORT");
    expect(imported.invoiceNumber).toBe("INV-1998-042"); // preserved exactly, not renumbered
  });

  it("historical tax values are preserved exactly, not recalculated against current configuration", async () => {
    // Current configuration uses 5% GST — deliberately different from the
    // historical invoice's recorded 7% GST, proving no recalculation
    // happens against today's rate.
    const { auth, business, client } = await createFullTestFixture({
      taxLines: [{ taxAuthority: "CRA", taxType: "GST", rate: "0.05" }],
    });

    const imported = await withTx(auth, (tx) =>
      importHistoricalInvoice(tx, auth, {
        businessId: business.id,
        clientId: client.id,
        invoiceNumber: "HIST-1",
        invoiceDate: new Date("1998-06-01"),
        lineItems: [
          { description: "Work", quantity: "1", unitPrice: "1000.00", lineSubtotal: "1000.00", taxStatus: "TAXABLE" },
        ],
        taxLines: [
          { taxAuthority: "CRA", taxType: "GST", rate: "0.07", taxableSubtotal: "1000.00", taxAmount: "70.00" },
        ],
        preTaxSubtotal: "1000.00",
        totalTax: "70.00",
        invoiceTotal: "1070.00",
        billedClientSnapshot: { name: "Client", billingAddress: null, contactEmail: null },
        billedBusinessSnapshot: { legalName: "Biz", address: null, gstHstRegistrationNumber: null, brandingLogoRef: null },
      }),
    );

    const taxLine = await withTx(auth, (tx) => tx.invoiceTaxLine.findFirstOrThrow({ where: { invoiceId: imported.id } }));
    expect(taxLine.rate.toFixed(5)).toBe("0.07000"); // preserved, not today's 0.05
    expect(imported.totalTax?.toFixed(2)).toBe("70.00");
  });

  it("unverified historical fields are represented explicitly via fieldVerification, never silently defaulted", async () => {
    const { auth, business, client } = await createFullTestFixture();

    const imported = await withTx(auth, (tx) =>
      importHistoricalInvoice(tx, auth, {
        businessId: business.id,
        clientId: client.id,
        invoiceNumber: "HIST-2",
        invoiceDate: new Date("2001-01-01"),
        lineItems: [
          { description: "Work", quantity: "1", unitPrice: "100.00", lineSubtotal: "100.00", taxStatus: "TAXABLE" },
        ],
        taxLines: [],
        preTaxSubtotal: "100.00",
        totalTax: "0.00",
        invoiceTotal: "100.00",
        billedClientSnapshot: { name: "Client", billingAddress: null, contactEmail: null },
        billedBusinessSnapshot: { legalName: "Biz", address: null, gstHstRegistrationNumber: null, brandingLogoRef: null },
        // The historical source could not confirm the due date.
        fieldVerification: { dueDate: "unverified" },
      }),
    );

    expect(imported.dueDate).toBeNull();
    expect(imported.fieldVerification).toEqual({ dueDate: "unverified" });
  });

  it("a duplicate historical invoice number within the same business is rejected", async () => {
    const { auth, business, client } = await createFullTestFixture();

    const historicalPayload = {
      businessId: business.id,
      clientId: client.id,
      invoiceNumber: "DUP-1",
      invoiceDate: new Date("2001-01-01"),
      lineItems: [
        { description: "Work", quantity: "1", unitPrice: "100.00", lineSubtotal: "100.00", taxStatus: "TAXABLE" as const },
      ],
      taxLines: [],
      preTaxSubtotal: "100.00",
      totalTax: "0.00",
      invoiceTotal: "100.00",
      billedClientSnapshot: { name: "Client", billingAddress: null, contactEmail: null },
      billedBusinessSnapshot: { legalName: "Biz", address: null, gstHstRegistrationNumber: null, brandingLogoRef: null },
    };

    await withTx(auth, (tx) => importHistoricalInvoice(tx, auth, historicalPayload));
    await expect(withTx(auth, (tx) => importHistoricalInvoice(tx, auth, historicalPayload))).rejects.toThrow();
  });
});
