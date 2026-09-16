import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { createFullTestFixture, createTestUser, authFor, withTx } from "../support/factories";
import { createDraftInvoice, finalizeInvoice, setDraftLineItems } from "@/server/domain/invoiceLifecycle";
import { getInvoiceBalance, recordPayment } from "@/server/domain/payments";
import { BusinessAuthorizationError } from "@/server/domain/errors";

describe("business isolation — two independent layers (Section 6/25; INV-ISO-*)", () => {
  it("authorized access to one's own business succeeds", async () => {
    const { auth, business } = await createFullTestFixture();
    await expect(
      withTx(auth, async (tx) => {
        const found = await tx.business.findFirst({ where: { id: business.id } });
        return found;
      }),
    ).resolves.not.toBeNull();
  });

  describe("application-layer authorization (assertBusinessAccess)", () => {
    it("rejects a request for Business B made using User A's authenticated context", async () => {
      const fixtureA = await createFullTestFixture();
      const fixtureB = await createFullTestFixture();

      await expect(
        withTx(fixtureA.auth, (tx) =>
          createDraftInvoice(tx, fixtureA.auth, { businessId: fixtureB.business.id, clientId: fixtureB.client.id }),
        ),
      ).rejects.toBeInstanceOf(BusinessAuthorizationError);
    });

    it("rejects reading a payment/invoice balance across businesses", async () => {
      const fixtureA = await createFullTestFixture();
      const fixtureB = await createFullTestFixture();

      const invoiceB = await withTx(fixtureB.auth, async (tx) => {
        const draft = await createDraftInvoice(tx, fixtureB.auth, {
          businessId: fixtureB.business.id,
          clientId: fixtureB.client.id,
        });
        await setDraftLineItems(tx, fixtureB.auth, draft.id, [
          { description: "Work", quantity: "1", unitPrice: "10.00", taxStatus: "TAXABLE", serviceId: fixtureB.service.id },
        ]);
        return finalizeInvoice(tx, fixtureB.auth, { invoiceId: draft.id });
      });

      // fixtureA's auth context attempts to read fixtureB's invoice balance.
      await expect(
        withTx(fixtureA.auth, (tx) => getInvoiceBalance(tx, fixtureA.auth, invoiceB.id)),
      ).rejects.toThrow(); // NotFoundError — the invoice is invisible under RLS, not just "forbidden"

      await expect(
        withTx(fixtureA.auth, (tx) =>
          recordPayment(tx, fixtureA.auth, { invoiceId: invoiceB.id, amount: "10.00", paymentDate: new Date() }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("database-layer authorization (Row-Level Security, defense-in-depth)", () => {
    it("a raw query with NO businessId filter, under user A's session, still cannot see business B's rows", async () => {
      const fixtureA = await createFullTestFixture();
      const fixtureB = await createFullTestFixture();

      // Deliberately bypass the application layer entirely — this proves
      // RLS itself (not assertBusinessAccess) is what blocks the read.
      const visibleBusinesses = await withAuthorizedTransaction(fixtureA.auth, async (tx) => {
        return tx.business.findMany({}); // no WHERE clause at all
      });

      const visibleIds = visibleBusinesses.map((b) => b.id);
      expect(visibleIds).toContain(fixtureA.business.id);
      expect(visibleIds).not.toContain(fixtureB.business.id);
    });

    it("RLS denies by default when no user context has been set at all", async () => {
      const fixtureA = await createFullTestFixture();

      // Query the raw prisma client directly, with no
      // withAuthorizedTransaction wrapper — app.user_id is never set, so
      // current_setting(..., true) is NULL and every policy denies.
      const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "business" WHERE id = ${fixtureA.business.id}::uuid`;
      expect(rows).toHaveLength(0);
    });

    it("a client-supplied businessId that does not belong to the caller is rejected even if it exists", async () => {
      const fixtureA = await createFullTestFixture();
      const fixtureB = await createFullTestFixture();
      const strangerUser = await createTestUser();
      const strangerAuth = authFor(strangerUser);

      // The stranger has no businesses at all; a forged/guessed businessId
      // belonging to fixtureA must not be reachable.
      await expect(
        withTx(strangerAuth, (tx) =>
          createDraftInvoice(tx, strangerAuth, { businessId: fixtureA.business.id, clientId: fixtureA.client.id }),
        ),
      ).rejects.toBeInstanceOf(BusinessAuthorizationError);

      // Sanity: fixtureB's own access to its own business still works.
      await expect(
        withTx(fixtureB.auth, (tx) =>
          createDraftInvoice(tx, fixtureB.auth, { businessId: fixtureB.business.id, clientId: fixtureB.client.id }),
        ),
      ).resolves.toMatchObject({ businessId: fixtureB.business.id });
    });
  });
});
