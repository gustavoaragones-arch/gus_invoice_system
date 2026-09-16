import { describe, expect, it } from "vitest";
import { createFullTestFixture, withTx } from "../support/factories";
import { createDraftInvoice, finalizeInvoice, setDraftLineItems } from "@/server/domain/invoiceLifecycle";
import type { BilledBusinessSnapshot, BilledClientSnapshot } from "@/server/domain/invoiceSnapshots";

describe("finalized invoice snapshots (INV-IMM-005/006/007; DEC-ARCH-031/032)", () => {
  it("captures a billedClientSnapshot and billedBusinessSnapshot at finalization", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const finalized = await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "100.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      return finalizeInvoice(tx, auth, { invoiceId: draft.id });
    });

    const clientSnapshot = finalized.billedClientSnapshot as unknown as BilledClientSnapshot;
    const businessSnapshot = finalized.billedBusinessSnapshot as unknown as BilledBusinessSnapshot;
    expect(clientSnapshot.name).toBe(client.name);
    expect(businessSnapshot.legalName).toBe(business.legalName ?? business.name);
  });

  it("changing the Client record later does not alter the frozen snapshot", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const finalized = await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "100.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      return finalizeInvoice(tx, auth, { invoiceId: draft.id });
    });

    const originalSnapshotName = (finalized.billedClientSnapshot as unknown as BilledClientSnapshot).name;

    await withTx(auth, (tx) =>
      tx.client.update({ where: { id: client.id }, data: { name: "Renamed Client Co." } }),
    );

    const reloaded = await withTx(auth, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: finalized.id } }));
    const reloadedSnapshotName = (reloaded.billedClientSnapshot as unknown as BilledClientSnapshot).name;

    expect(reloadedSnapshotName).toBe(originalSnapshotName);
    expect(reloadedSnapshotName).not.toBe("Renamed Client Co.");
  });

  it("changing the Business record later does not alter the frozen snapshot", async () => {
    const { auth, business, client, service } = await createFullTestFixture();

    const finalized = await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await setDraftLineItems(tx, auth, draft.id, [
        { description: "Work", quantity: "1", unitPrice: "100.00", taxStatus: "TAXABLE", serviceId: service.id },
      ]);
      return finalizeInvoice(tx, auth, { invoiceId: draft.id });
    });

    const originalLegalName = (finalized.billedBusinessSnapshot as unknown as BilledBusinessSnapshot).legalName;

    await withTx(auth, (tx) =>
      tx.business.update({ where: { id: business.id }, data: { legalName: "New Legal Name Inc." } }),
    );

    const reloaded = await withTx(auth, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: finalized.id } }));
    const reloadedLegalName = (reloaded.billedBusinessSnapshot as unknown as BilledBusinessSnapshot).legalName;

    expect(reloadedLegalName).toBe(originalLegalName);
    expect(reloadedLegalName).not.toBe("New Legal Name Inc.");
  });
});
