import { describe, expect, it } from "vitest";
import { InvalidStateError, UnresolvedTaxApplicabilityError } from "@/server/domain/errors";
import { createClient, getClient, listClients, updateClient } from "@/server/application/clients";
import { createService, listServices, updateService } from "@/server/application/services";
import {
  createInvoiceDraft,
  finalizeInvoiceForBusiness,
  getBilledClientSnapshot,
  getDraftInvoicePreview,
  getInvoice,
  listInvoices,
  saveDraftLineItems,
  voidInvoiceForBusiness,
} from "@/server/application/invoices";
import { createFullTestFixture } from "../support/factories";

describe("Phase 4 application workflow", () => {
  it("creates, lists, and edits clients", async () => {
    const { auth, business } = await createFullTestFixture();
    const created = await createClient(auth, business.id, {
      name: "Acme Corp",
      billingAddress: "123 Main St",
      contactEmail: "billing@acme.test",
    });
    const clients = await listClients(auth, business.id, "Acme");
    expect(clients.some((client) => client.id === created.id)).toBe(true);

    const updated = await updateClient(auth, business.id, created.id, {
      name: "Acme Corporation",
      billingAddress: "456 King St",
      contactEmail: "accounts@acme.test",
    });
    expect(updated.name).toBe("Acme Corporation");
    const fetched = await getClient(auth, business.id, created.id);
    expect(fetched.contactEmail).toBe("accounts@acme.test");
  });

  it("creates, lists, and edits services", async () => {
    const { auth, business } = await createFullTestFixture();
    const created = await createService(auth, business.id, {
      description: "Consulting",
      unit: "hour",
      defaultRate: "150.00",
      taxStatus: "TAXABLE",
    });
    const services = await listServices(auth, business.id);
    expect(services.some((service) => service.id === created.id)).toBe(true);

    const updated = await updateService(auth, business.id, created.id, {
      description: "Senior consulting",
      unit: "hour",
      defaultRate: "175.00",
      taxStatus: "TAXABLE",
    });
    expect(updated.defaultRate.toFixed(2)).toBe("175.00");
  });

  it("supports draft invoice creation, editing, review preview, and finalization", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
    await saveDraftLineItems(auth, business.id, draft.id, [
      {
        description: "Consulting work",
        quantity: "2",
        unitPrice: "100.00",
        taxStatus: "TAXABLE",
        serviceId: service.id,
      },
    ]);

    const preview = await getDraftInvoicePreview(auth, business.id, draft.id);
    expect(preview.canFinalize).toBe(true);
    expect(preview.preTaxSubtotal).toBe("200.00");
    expect(preview.invoiceTotal).toBe("210.00");

    const finalized = await finalizeInvoiceForBusiness(auth, business.id, draft.id);
    expect(finalized.status).toBe("FINALIZED");
    expect(finalized.invoiceNumber).toBeTruthy();

    const invoice = await getInvoice(auth, business.id, draft.id);
    expect(invoice.status).toBe("FINALIZED");
    expect(invoice.lineItems).toHaveLength(1);
  });

  it("blocks finalization when multiple tax groups make applicability unresolved", async () => {
    const { auth, business, client, service } = await createFullTestFixture({
      taxLines: [
        { taxAuthority: "CRA", taxType: "GST", rate: "0.05" },
        { taxAuthority: "BC Ministry of Finance", taxType: "PST", rate: "0.07" },
      ],
    });
    const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
    await saveDraftLineItems(auth, business.id, draft.id, [
      {
        description: "Work",
        quantity: "1",
        unitPrice: "1000.00",
        taxStatus: "TAXABLE",
        serviceId: service.id,
      },
    ]);

    const preview = await getDraftInvoicePreview(auth, business.id, draft.id);
    expect(preview.canFinalize).toBe(false);
    expect(preview.taxApplicabilityStatus).toBe("unresolved");

    await expect(finalizeInvoiceForBusiness(auth, business.id, draft.id)).rejects.toThrow(
      UnresolvedTaxApplicabilityError,
    );
  });

  it("preserves finalized billed client snapshot after client edit", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
    await saveDraftLineItems(auth, business.id, draft.id, [
      {
        description: "Work",
        quantity: "1",
        unitPrice: "100.00",
        taxStatus: "TAXABLE",
        serviceId: service.id,
      },
    ]);
    await finalizeInvoiceForBusiness(auth, business.id, draft.id);

    await updateClient(auth, business.id, client.id, {
      name: "Renamed Client",
      billingAddress: "New Address",
      contactEmail: "new@client.test",
    });

    const invoice = await getInvoice(auth, business.id, draft.id);
    const snapshot = getBilledClientSnapshot(invoice);
    expect(snapshot.name).not.toBe("Renamed Client");
    expect(snapshot.name).toBe(client.name);
  });

  it("enforces business isolation for clients and invoices", async () => {
    const fixtureA = await createFullTestFixture();
    const fixtureB = await createFullTestFixture();
    const clientB = await createClient(fixtureB.auth, fixtureB.business.id, { name: "B Client" });
    const draftB = await createInvoiceDraft(fixtureB.auth, fixtureB.business.id, { clientId: clientB.id });

    await expect(getClient(fixtureA.auth, fixtureA.business.id, clientB.id)).rejects.toThrow();
    await expect(getInvoice(fixtureA.auth, fixtureA.business.id, draftB.id)).rejects.toThrow();

    const invoicesA = await listInvoices(fixtureA.auth, fixtureA.business.id);
    expect(invoicesA.some((invoice) => invoice.id === draftB.id)).toBe(false);
  });

  it("supports Draft → Finalized → Void lifecycle", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
    await saveDraftLineItems(auth, business.id, draft.id, [
      {
        description: "Work",
        quantity: "1",
        unitPrice: "100.00",
        taxStatus: "TAXABLE",
        serviceId: service.id,
      },
    ]);
    await finalizeInvoiceForBusiness(auth, business.id, draft.id);
    const voided = await voidInvoiceForBusiness(auth, business.id, draft.id, "Correction required");
    expect(voided.status).toBe("VOID");

    await expect(
      saveDraftLineItems(auth, business.id, draft.id, [
        {
          description: "Changed",
          quantity: "1",
          unitPrice: "50.00",
          taxStatus: "TAXABLE",
          serviceId: service.id,
        },
      ]),
    ).rejects.toThrow(InvalidStateError);
  });
});
