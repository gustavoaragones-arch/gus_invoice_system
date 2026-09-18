import { describe, expect, it } from "vitest";
import { BusinessAuthorizationError, ValidationError } from "@/server/domain/errors";
import {
  createTaxConfigurationForBusiness,
  listTaxConfigurations,
} from "@/server/application/taxConfiguration";
import {
  createInvoiceDraft,
  finalizeInvoiceForBusiness,
  saveDraftLineItems,
} from "@/server/application/invoices";
import { getFinancialReport } from "@/server/application/reporting";
import { recordPaymentForBusiness } from "@/server/application/payments";
import { resolveEffectiveTaxConfiguration } from "@/server/domain/taxConfiguration";
import {
  authFor,
  createFullTestFixture,
  createTestBusiness,
  createTestUser,
  withTx,
} from "../support/factories";

const AS_OF = new Date("2025-09-17");

async function finalizeFixtureInvoice(
  auth: Awaited<ReturnType<typeof createFullTestFixture>>["auth"],
  business: { id: string },
  client: { id: string },
  service: { id: string },
  options: { amount?: string; invoiceDate?: Date } = {},
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

describe("Phase 10 accounting administration workflow", () => {
  it("lists tax configuration versions for the selected business", async () => {
    const { auth, business } = await createFullTestFixture();
    const versions = await listTaxConfigurations(auth, business.id);

    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0]?.isCurrent).toBe(true);
    expect(versions[0]?.taxLines.length).toBeGreaterThan(0);
  });

  it("creates the first tax configuration version for a business without one", async () => {
    const user = await createTestUser();
    const auth = authFor(user);
    const business = await createTestBusiness(auth);

    const created = await createTaxConfigurationForBusiness(auth, business.id, {
      effectiveFrom: new Date("2024-01-01"),
      isGstHstRegistered: true,
      taxLines: [{ taxAuthority: "Authority A", taxType: "TYPE_A", rate: "0.10" }],
    });

    expect(created.effectiveTo).toBeNull();
    expect(created.isGstHstRegistered).toBe(true);

    const auditEvents = await withTx(auth, (tx) =>
      tx.auditEvent.findMany({
        where: {
          businessId: business.id,
          eventType: "TAX_CONFIGURATION_CHANGED",
          entityId: created.id,
        },
      }),
    );
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]?.priorValues).toBeNull();
  });

  it("closes the prior current version when creating a new tax configuration version", async () => {
    const { auth, business } = await createFullTestFixture();

    const created = await createTaxConfigurationForBusiness(auth, business.id, {
      effectiveFrom: new Date("2025-06-01"),
      isGstHstRegistered: true,
      taxLines: [{ taxAuthority: "Authority B", taxType: "TYPE_B", rate: "0.13" }],
    });

    const versions = await listTaxConfigurations(auth, business.id);
    const prior = versions.find((version) => version.id !== created.id && version.effectiveTo !== null);
    const current = versions.find((version) => version.isCurrent);

    expect(prior?.effectiveTo).toBe("2025-05-31");
    expect(current?.effectiveFrom).toBe("2025-06-01");
    expect(current?.taxLines[0]?.rate).toBe("0.13");

    const auditEvents = await withTx(auth, (tx) =>
      tx.auditEvent.findMany({
        where: {
          businessId: business.id,
          eventType: "TAX_CONFIGURATION_CHANGED",
          entityId: created.id,
        },
      }),
    );
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]?.priorValues).not.toBeNull();
    expect(auditEvents[0]?.newValues).not.toBeNull();
  });

  it("rejects a new version that does not start after the current version", async () => {
    const { auth, business } = await createFullTestFixture();

    await expect(
      createTaxConfigurationForBusiness(auth, business.id, {
        effectiveFrom: new Date("2019-01-01"),
        isGstHstRegistered: true,
        taxLines: [{ taxAuthority: "Authority C", taxType: "TYPE_C", rate: "0.07" }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("resolves the effective tax configuration by date", async () => {
    const { auth, business } = await createFullTestFixture();

    await createTaxConfigurationForBusiness(auth, business.id, {
      effectiveFrom: new Date("2025-06-01"),
      isGstHstRegistered: true,
      taxLines: [{ taxAuthority: "Authority D", taxType: "TYPE_D", rate: "0.08" }],
    });

    const before = await withTx(auth, (tx) =>
      resolveEffectiveTaxConfiguration(tx, business.id, new Date("2025-05-15")),
    );
    const after = await withTx(auth, (tx) =>
      resolveEffectiveTaxConfiguration(tx, business.id, new Date("2025-06-01")),
    );

    expect(before.taxLines[0]?.rate.toString()).toBe("0.05");
    expect(after.taxLines[0]?.rate.toString()).toBe("0.08");
  });

  it("keeps version date ranges contiguous and non-overlapping across successive versions", async () => {
    const { auth, business } = await createFullTestFixture();

    await createTaxConfigurationForBusiness(auth, business.id, {
      effectiveFrom: new Date("2025-06-01"),
      isGstHstRegistered: true,
      taxLines: [{ taxAuthority: "Authority G", taxType: "TYPE_G", rate: "0.08" }],
    });
    await createTaxConfigurationForBusiness(auth, business.id, {
      effectiveFrom: new Date("2026-01-01"),
      isGstHstRegistered: true,
      taxLines: [{ taxAuthority: "Authority G", taxType: "TYPE_G", rate: "0.09" }],
    });

    const versions = (await listTaxConfigurations(auth, business.id)).slice().reverse(); // ascending
    expect(versions).toHaveLength(3);
    expect(versions.filter((v) => v.effectiveTo === null)).toHaveLength(1);
    expect(versions[2]?.isCurrent).toBe(true);

    for (let i = 0; i < versions.length - 1; i++) {
      const closed = versions[i]!;
      const next = versions[i + 1]!;
      expect(closed.effectiveTo).not.toBeNull();
      // closed period ends strictly before the next one starts, with no gap
      expect(closed.effectiveTo! < next.effectiveFrom).toBe(true);
      const dayAfter = new Date(closed.effectiveTo! + "T00:00:00Z");
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      expect(dayAfter.toISOString().slice(0, 10)).toBe(next.effectiveFrom);
    }
  });

  it("tax configuration changes never modify or recalculate an already-finalized invoice", async () => {
    // Version A (fixture): 5% effective from 2020-01-01.
    const { auth, business, client, service } = await createFullTestFixture();

    const finalized = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "1000.00",
      invoiceDate: new Date("2025-03-01"),
    });
    await recordPaymentForBusiness(auth, business.id, {
      invoiceId: finalized.id,
      amount: "400.00",
      paymentDate: new Date("2025-03-10"),
    });

    const period = {
      periodKind: "custom" as const,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    };
    const snapshot = async () => {
      const invoice = await withTx(auth, (tx) =>
        tx.invoice.findUniqueOrThrow({
          where: { id: finalized.id },
          include: { taxLines: true, lineItems: true },
        }),
      );
      const report = await getFinancialReport(auth, business.id, period);
      return {
        status: invoice.status,
        invoiceNumber: invoice.invoiceNumber,
        preTaxSubtotal: invoice.preTaxSubtotal?.toFixed(2),
        totalTax: invoice.totalTax?.toFixed(2),
        invoiceTotal: invoice.invoiceTotal?.toFixed(2),
        billedClientSnapshot: invoice.billedClientSnapshot,
        billedBusinessSnapshot: invoice.billedBusinessSnapshot,
        taxLines: invoice.taxLines
          .map((t) => ({
            authority: t.taxAuthority,
            type: t.taxType,
            rate: t.rate.toFixed(5),
            taxable: t.taxableSubtotal.toFixed(2),
            amount: t.taxAmount.toFixed(2),
          }))
          .sort((a, b) => a.type.localeCompare(b.type)),
        lineItems: invoice.lineItems.map((l) => ({
          id: l.id,
          lineSubtotal: l.lineSubtotal.toFixed(2),
          taxGroupKey: l.taxGroupKey,
        })),
        reportSummary: report.summary,
        reportInvoices: report.revenueInvoices,
      };
    };

    const before = await snapshot();
    expect(before.taxLines).toEqual([
      { authority: "CRA", type: "GST", rate: "0.05000", taxable: "1000.00", amount: "50.00" },
    ]);
    expect(before.totalTax).toBe("50.00");
    expect(before.invoiceTotal).toBe("1050.00");
    expect(before.reportSummary.revenue).toBe("1000.00");
    expect(before.reportSummary.salesTax).toBe("50.00");

    // Version B: different rate/authority, effective later.
    const versionB = await createTaxConfigurationForBusiness(auth, business.id, {
      effectiveFrom: new Date("2025-06-01"),
      isGstHstRegistered: true,
      taxLines: [{ taxAuthority: "Authority H", taxType: "TYPE_H", rate: "0.13" }],
    });

    // Future dates resolve to B; the invoice's own date still resolves to A.
    const future = await withTx(auth, (tx) =>
      resolveEffectiveTaxConfiguration(tx, business.id, new Date("2025-09-01")),
    );
    expect(future.taxConfigurationVersionId).toBe(versionB.id);
    expect(future.taxLines[0]?.rate.toString()).toBe("0.13");
    const atInvoiceDate = await withTx(auth, (tx) =>
      resolveEffectiveTaxConfiguration(tx, business.id, new Date("2025-03-01")),
    );
    expect(atInvoiceDate.taxLines[0]?.rate.toString()).toBe("0.05");

    // Re-read the finalized invoice and the report: nothing changed.
    const after = await snapshot();
    expect(after).toEqual(before);

    // A new invoice finalized after B takes effect uses B — future only.
    const later = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "1000.00",
      invoiceDate: new Date("2025-09-01"),
    });
    expect(later.totalTax?.toFixed(2)).toBe("130.00");
    const original = await snapshot();
    expect(original.invoiceTotal).toBe(before.invoiceTotal);
    expect(original.totalTax).toBe("50.00");
    expect(original.taxLines).toEqual(before.taxLines);
  });

  it("enforces business isolation for tax configuration administration", async () => {
    const fixtureA = await createFullTestFixture();
    const fixtureB = await createFullTestFixture();

    await expect(listTaxConfigurations(fixtureA.auth, fixtureB.business.id)).rejects.toBeInstanceOf(
      BusinessAuthorizationError,
    );

    await expect(
      createTaxConfigurationForBusiness(fixtureA.auth, fixtureB.business.id, {
        effectiveFrom: new Date("2026-01-01"),
        isGstHstRegistered: true,
        taxLines: [{ taxAuthority: "Authority E", taxType: "TYPE_E", rate: "0.09" }],
      }),
    ).rejects.toBeInstanceOf(BusinessAuthorizationError);
  });

  it("preserves calendar YTD reporting behavior", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "500.00",
      invoiceDate: new Date("2025-04-10"),
    });

    const report = await getFinancialReport(auth, business.id, {
      periodKind: "calendar-ytd",
      asOf: AS_OF,
    });

    expect(report.period.start).toBe("2025-01-01");
    expect(report.period.end).toBe("2025-09-17");
    expect(report.summary.revenue).toBe("500.00");
  });

  it("preserves invoice finalization after tax configuration changes", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    await createTaxConfigurationForBusiness(auth, business.id, {
      effectiveFrom: new Date("2025-07-01"),
      isGstHstRegistered: true,
      taxLines: [{ taxAuthority: "Authority F", taxType: "TYPE_F", rate: "0.10" }],
    });

    const finalized = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "200.00",
      invoiceDate: new Date("2025-08-01"),
    });

    expect(finalized.status).toBe("FINALIZED");
    expect(finalized.totalTax?.toFixed(2)).toBe("20.00");
    expect(finalized.preTaxSubtotal?.toFixed(2)).toBe("200.00");
  });

  it("preserves payment recording behavior", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const finalized = await finalizeFixtureInvoice(auth, business, client, service, {
      amount: "150.00",
      invoiceDate: new Date("2025-02-01"),
    });

    const payment = await recordPaymentForBusiness(auth, business.id, {
      invoiceId: finalized.id,
      amount: "75.00",
      paymentDate: new Date("2025-02-15"),
      method: "e-transfer",
      notes: "Partial payment",
    });

    expect(payment.method).toBe("e-transfer");
    expect(payment.amount.toFixed(2)).toBe("75.00");
  });
});
