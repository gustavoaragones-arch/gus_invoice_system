import { describe, expect, it } from "vitest";
import { BusinessAuthorizationError } from "@/server/domain/errors";
import {
  createInvoiceDraft,
  createReplacementDraftForBusiness,
  finalizeInvoiceForBusiness,
  saveDraftLineItems,
  voidInvoiceForBusiness,
} from "@/server/application/invoices";
import { getFinancialReport } from "@/server/application/reporting";
import {
  recordPaymentForBusiness,
  reversePaymentForBusiness,
} from "@/server/application/payments";
import { createFullTestFixture, withTx } from "../support/factories";
import { importHistoricalInvoice } from "@/server/domain/historicalImport";
import { buildBilledBusinessSnapshot, buildBilledClientSnapshot } from "@/server/domain/invoiceSnapshots";

const AS_OF = new Date("2025-09-17");

async function finalizeFixtureInvoice(
  auth: Awaited<ReturnType<typeof createFullTestFixture>>["auth"],
  business: { id: string },
  client: { id: string },
  service: { id: string },
  options: {
    amount?: string;
    invoiceDate?: Date;
  } = {},
) {
  const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
  await saveDraftLineItems(auth, business.id, draft.id, [
    {
      description: "Work",
      quantity: "1",
      unitPrice: options.amount ?? "100.00",
      taxStatus: "TAXABLE",
      serviceId: service.id,
    },
  ]);
  return finalizeInvoiceForBusiness(auth, business.id, draft.id, options.invoiceDate);
}

describe("Phase 8 financial reporting workflow", () => {
  it("includes finalized non-void invoice revenue and excludes sales tax", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "1000.00",
      invoiceDate: new Date("2025-06-15"),
    });

    const report = await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      asOf: AS_OF,
    });

    expect(report.summary.revenue).toBe("1000.00");
    expect(report.summary.salesTax).toBe("50.00");
    expect(report.summary.invoiceCount).toBe(1);
  });

  it("excludes draft and void invoices from revenue", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await createInvoiceDraft(auth, business.id, { clientId: client.id });

    const finalized = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "200.00",
      invoiceDate: new Date("2025-03-01"),
    });
    await voidInvoiceForBusiness(auth, business.id, finalized.id, "Cancelled");

    const report = await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      asOf: AS_OF,
    });

    expect(report.summary.revenue).toBe("0.00");
    expect(report.summary.invoiceCount).toBe(0);
  });

  it("attributes collections by payment date and excludes reversed payments", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const finalized = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "100.00",
      invoiceDate: new Date("2024-12-01"),
    });

    const payment = await recordPaymentForBusiness(auth, business.id, {
      invoiceId: finalized.id,
      amount: "100.00",
      paymentDate: new Date("2025-02-15"),
      method: "E-Transfer",
    });

    await reversePaymentForBusiness(auth, business.id, { paymentId: payment.id, reason: "error" });

    const report = await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      asOf: AS_OF,
    });

    expect(report.summary.amountCollected).toBe("0.00");
    expect(report.summary.paymentCount).toBe(0);
    expect(report.collectionPayments).toHaveLength(0);
  });

  it("keeps payments on void invoices in amount collected", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const finalized = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "500.00",
      invoiceDate: new Date("2025-01-10"),
    });

    await recordPaymentForBusiness(auth, business.id, {
      invoiceId: finalized.id,
      amount: "500.00",
      paymentDate: new Date("2025-01-20"),
    });

    await voidInvoiceForBusiness(auth, business.id, finalized.id, "Cancelled after payment");

    const report = await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      asOf: AS_OF,
    });

    expect(report.summary.amountCollected).toBe("500.00");
    expect(report.summary.outstanding).toBe("0.00");
    expect(report.summary.revenue).toBe("0.00");
  });

  it("reports outstanding balances for finalized invoices and excludes paid invoices", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const unpaid = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "300.00",
      invoiceDate: new Date("2025-04-01"),
    });
    const paid = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "200.00",
      invoiceDate: new Date("2025-04-02"),
    });

    await recordPaymentForBusiness(auth, business.id, {
      invoiceId: paid.id,
      amount: "220.00",
      paymentDate: new Date("2025-04-10"),
    });

    const report = await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      asOf: AS_OF,
    });

    expect(report.summary.outstanding).toBe("315.00");
    expect(report.outstandingInvoices).toHaveLength(1);
    expect(report.outstandingInvoices[0]?.id).toBe(unpaid.id);
    expect(report.overpaidInvoices).toHaveLength(1);
    expect(report.overpaidInvoices[0]?.id).toBe(paid.id);
  });

  it("uses calendar YTD boundaries and excludes prior-year invoices", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "100.00",
      invoiceDate: new Date("2024-12-31"),
    });
    await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "250.00",
      invoiceDate: new Date("2025-01-01"),
    });

    const report = await getFinancialReport(auth, business.id, {
      periodKind: "calendar-ytd",
      asOf: AS_OF,
    });

    expect(report.period.start).toBe("2025-01-01");
    expect(report.period.end).toBe("2025-09-17");
    expect(report.summary.revenue).toBe("250.00");
  });

  it("groups monthly revenue by invoice date and collections by payment date", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const invoice = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "400.00",
      invoiceDate: new Date("2025-03-10"),
    });

    await recordPaymentForBusiness(auth, business.id, {
      invoiceId: invoice.id,
      amount: "400.00",
      paymentDate: new Date("2025-04-05"),
    });

    const report = await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-03-01",
      endDate: "2025-04-30",
      asOf: AS_OF,
    });

    const march = report.monthlyActivity.find((row) => row.month === "2025-03");
    const april = report.monthlyActivity.find((row) => row.month === "2025-04");

    expect(march?.revenue).toBe("400.00");
    expect(march?.amountCollected).toBe("0.00");
    expect(april?.revenue).toBe("0.00");
    expect(april?.amountCollected).toBe("400.00");
  });

  it("attributes replacement invoice revenue to its own invoice date", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const original = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "100.00",
      invoiceDate: new Date("2025-01-15"),
    });
    await voidInvoiceForBusiness(auth, business.id, original.id, "Correction");

    const replacementDraft = await createReplacementDraftForBusiness(auth, business.id, original.id);
    await saveDraftLineItems(auth, business.id, replacementDraft.id, [
      {
        description: "Corrected work",
        quantity: "1",
        unitPrice: "150.00",
        taxStatus: "TAXABLE",
        serviceId: service.id,
      },
    ]);
    await finalizeInvoiceForBusiness(auth, business.id, replacementDraft.id, new Date("2025-06-01"));

    const janReport = await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      asOf: AS_OF,
    });
    const junReport = await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-06-01",
      endDate: "2025-06-30",
      asOf: AS_OF,
    });

    expect(janReport.summary.revenue).toBe("0.00");
    expect(junReport.summary.revenue).toBe("150.00");
  });

  it("includes valid historical finalized invoices and uses snapshot client names", async () => {
    const { auth, business, client } = await createFullTestFixture();

    const businessRecord = await withTx(auth, (tx) =>
      tx.business.findFirstOrThrow({ where: { id: business.id } }),
    );

    await withTx(auth, (tx) =>
      importHistoricalInvoice(tx, auth, {
        businessId: business.id,
        clientId: client.id,
        invoiceNumber: "HIST-2025-001",
        invoiceDate: new Date("2025-02-01"),
        lineItems: [
          {
            description: "Legacy work",
            quantity: "1.00",
            unitPrice: "800.00",
            lineSubtotal: "800.00",
            taxStatus: "TAXABLE",
          },
        ],
        taxLines: [
          {
            taxAuthority: "CRA",
            taxType: "GST",
            rate: "0.05",
            taxableSubtotal: "800.00",
            taxAmount: "40.00",
          },
        ],
        preTaxSubtotal: "800.00",
        totalTax: "40.00",
        invoiceTotal: "840.00",
        billedClientSnapshot: { name: "Frozen Historical Client", billingAddress: null, contactEmail: null },
        billedBusinessSnapshot: buildBilledBusinessSnapshot(businessRecord),
      }),
    );

    const report = await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-02-01",
      endDate: "2025-02-28",
      asOf: AS_OF,
    });

    expect(report.summary.revenue).toBe("800.00");
    expect(report.revenueInvoices[0]?.clientName).toBe("Frozen Historical Client");
    expect(report.revenueInvoices[0]?.provenance).toBe("HISTORICAL_IMPORT");
  });

  it("rejects cross-business reporting access", async () => {
    const fixtureA = await createFullTestFixture();
    const fixtureB = await createFullTestFixture();

    await expect(
      getFinancialReport(fixtureA.auth, fixtureB.business.id, {
        periodKind: "calendar-ytd",
        asOf: AS_OF,
      }),
    ).rejects.toBeInstanceOf(BusinessAuthorizationError);
  });

  it("does not mutate invoices, payments, or snapshots when generating reports", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const finalized = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "125.00",
      invoiceDate: new Date("2025-05-01"),
    });

    const before = await withTx(auth, (tx) =>
      tx.invoice.findUniqueOrThrow({
        where: { id: finalized.id },
        include: { payments: true },
      }),
    );

    await getFinancialReport(auth, business.id, {
      periodKind: "custom",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      asOf: AS_OF,
    });

    const after = await withTx(auth, (tx) =>
      tx.invoice.findUniqueOrThrow({
        where: { id: finalized.id },
        include: { payments: true },
      }),
    );

    expect(after.status).toBe(before.status);
    expect(after.preTaxSubtotal?.toString()).toBe(before.preTaxSubtotal?.toString());
    expect(after.billedClientSnapshot).toEqual(before.billedClientSnapshot);
    expect(after.payments).toHaveLength(before.payments.length);
  });
});
