import { describe, expect, it, afterEach } from "vitest";
import { BusinessAuthorizationError, InvalidStateError, ValidationError } from "@/server/domain/errors";
import {
  createInvoiceDraft,
  finalizeInvoiceForBusiness,
  saveDraftLineItems,
  voidInvoiceForBusiness,
} from "@/server/application/invoices";
import { createBusinessForUser, getBusinessProfile, updateBusinessProfile } from "@/server/application/business";
import { getFinalizedInvoicePdf } from "@/server/application/invoicePdf";
import { getDeliveryPreview, listSendAttempts, sendInvoiceForBusiness } from "@/server/application/delivery";
import { updateClient } from "@/server/application/clients";
import { buildInvoiceEmailContent } from "@/server/delivery/emailContent";
import { EmailProviderConfigurationError, getSmtpEmailConfig } from "@/server/delivery/emailConfig";
import { resetEmailProvidersForTests } from "@/server/delivery/emailProvider";
import { Decimal, ZERO } from "@/server/domain/money";
import { createFullTestFixture, withTx } from "../support/factories";

async function finalizeFixtureInvoice(
  auth: Awaited<ReturnType<typeof createFullTestFixture>>["auth"],
  business: { id: string },
  client: { id: string },
  service: { id: string },
  amount = "100.00",
) {
  const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
  await saveDraftLineItems(auth, business.id, draft.id, [
    {
      description: "Work",
      quantity: "1",
      unitPrice: amount,
      taxStatus: "TAXABLE",
      serviceId: service.id,
    },
  ]);
  return finalizeInvoiceForBusiness(auth, business.id, draft.id);
}

describe("Phase 9 business setup, PDF, and delivery workflow", () => {
  const envBackup = {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };

  afterEach(() => {
    if (envBackup.EMAIL_PROVIDER === undefined) {
      delete process.env.EMAIL_PROVIDER;
    } else {
      process.env.EMAIL_PROVIDER = envBackup.EMAIL_PROVIDER;
    }
    if (envBackup.SMTP_HOST === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = envBackup.SMTP_HOST;
    if (envBackup.SMTP_PORT === undefined) delete process.env.SMTP_PORT;
    else process.env.SMTP_PORT = envBackup.SMTP_PORT;
    if (envBackup.SMTP_USER === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = envBackup.SMTP_USER;
    if (envBackup.SMTP_PASSWORD === undefined) delete process.env.SMTP_PASSWORD;
    else process.env.SMTP_PASSWORD = envBackup.SMTP_PASSWORD;
    if (envBackup.EMAIL_FROM === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = envBackup.EMAIL_FROM;
    resetEmailProvidersForTests();
  });

  it("creates and updates a business profile with authorization", async () => {
    const { auth } = await createFullTestFixture();

    const created = await createBusinessForUser(auth, {
      name: "New Billing Co",
      legalName: "New Billing Co Ltd",
      address: "123 Main St",
      gstHstRegistrationNumber: "123456789RT0001",
      brandingLogoRef: "logo-ref-1",
    });

    expect(created.name).toBe("New Billing Co");
    expect(created.ownerUserId).toBe(auth.userId);

    const updated = await updateBusinessProfile(auth, created.id, {
      name: "Updated Billing Co",
      legalName: "Updated Billing Co Ltd",
      address: "456 King St",
      gstHstRegistrationNumber: "987654321RT0001",
      brandingLogoRef: "logo-ref-2",
    });

    expect(updated.name).toBe("Updated Billing Co");

    const auditEvents = await withTx(auth, (tx) =>
      tx.auditEvent.findMany({
        where: { entityType: "Business", entityId: created.id, eventType: "BUSINESS_SETTINGS_CHANGED" },
      }),
    );
    expect(auditEvents).toHaveLength(1);
  });

  it("generates a finalized invoice PDF from frozen snapshots", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const finalized = await finalizeFixtureInvoice(auth, business, client, service);

    const pdf = await getFinalizedInvoicePdf(auth, business.id, finalized.id);
    expect(pdf.filename).toContain("Invoice-");
    expect(pdf.content.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.content.length).toBeGreaterThan(100);
  });

  it("does not change historical PDF content when live client or business records change", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const finalized = await finalizeFixtureInvoice(auth, business, client, service);

    const before = await getFinalizedInvoicePdf(auth, business.id, finalized.id);

    await updateClient(auth, business.id, client.id, {
      name: "Changed Client Name",
      billingAddress: "New Address",
      contactEmail: "changed@example.test",
      status: "ACTIVE",
    });
    await updateBusinessProfile(auth, business.id, {
      name: "Changed Business Name",
      legalName: "Changed Legal Name",
      address: "New Business Address",
      gstHstRegistrationNumber: "000000000RT0000",
      brandingLogoRef: "changed-logo",
    });

    const after = await getFinalizedInvoicePdf(auth, business.id, finalized.id);
    expect(after.content.equals(before.content)).toBe(true);
  });

  it("rejects PDF generation for draft invoices and allows void invoice PDF viewing", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
    await expect(getFinalizedInvoicePdf(auth, business.id, draft.id)).rejects.toBeInstanceOf(InvalidStateError);

    const finalized = await finalizeFixtureInvoice(auth, business, client, service);
    await voidInvoiceForBusiness(auth, business.id, finalized.id, "Cancelled");
    const voidPdf = await getFinalizedInvoicePdf(auth, business.id, finalized.id);
    expect(voidPdf.content.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("uses the approved email subject and body wording", async () => {
    const content = buildInvoiceEmailContent({
      invoice: {
        invoiceNumber: "INV-1001",
        invoiceDate: new Date("2025-06-01"),
        dueDate: new Date("2025-06-15"),
        invoiceTotal: new Decimal("105.00") as unknown as import("@prisma/client").Prisma.Decimal,
      },
      billedClient: { name: "Client Co", billingAddress: null, contactEmail: "client@example.test" },
      billedBusiness: {
        legalName: "Billing Co",
        address: null,
        gstHstRegistrationNumber: null,
        brandingLogoRef: null,
      },
      lineItems: [],
      taxLines: [],
      balance: {
        invoiceTotal: new Decimal("105.00"),
        amountPaid: ZERO,
        balanceDue: new Decimal("105.00"),
        overpayment: ZERO,
      },
    });

    expect(content.subject).toBe("Invoice INV-1001 from Billing Co");
    expect(content.text).toContain("Hello Client Co,");
    expect(content.text).toContain("Please find attached invoice INV-1001 from Billing Co.");
    expect(content.text).toContain("Invoice date:");
    expect(content.text).toContain("Amount due:");
    expect(content.text).toContain("Due date:");
    expect(content.text).toContain("Thank you.");
  });

  it("sends finalized invoices with PDF attachment and rejects draft/void sends", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
    await expect(
      sendInvoiceForBusiness(auth, business.id, draft.id, "billing@client.test"),
    ).rejects.toBeInstanceOf(InvalidStateError);

    const finalized = await finalizeFixtureInvoice(auth, business, client, service);
    const attempt = await sendInvoiceForBusiness(auth, business.id, finalized.id, "billing@client.test");
    expect(attempt.status).toBe("SUCCESS");

    const audit = await withTx(auth, (tx) =>
      tx.auditEvent.findFirst({
        where: { entityType: "Invoice", entityId: finalized.id, eventType: "INVOICE_SEND_ATTEMPTED" },
        orderBy: { timestamp: "desc" },
      }),
    );
    expect(audit?.metadata).toMatchObject({
      destination: "billing@client.test",
      provider: "development",
    });

    await voidInvoiceForBusiness(auth, business.id, finalized.id, "Cancelled");
    await expect(
      sendInvoiceForBusiness(auth, business.id, finalized.id, "billing@client.test"),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("preserves failed send attempts and supports resend history", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const finalized = await finalizeFixtureInvoice(auth, business, client, service);

    await expect(sendInvoiceForBusiness(auth, business.id, finalized.id, "invalid-email")).rejects.toThrow();
    const failed = await listSendAttempts(auth, business.id, finalized.id);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.status).toBe("FAILURE");

    const success = await sendInvoiceForBusiness(auth, business.id, finalized.id, "billing@client.test");
    expect(success.status).toBe("SUCCESS");

    const attempts = await listSendAttempts(auth, business.id, finalized.id);
    expect(attempts).toHaveLength(2);
  });

  it("fails explicitly when production SMTP configuration is missing", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    delete process.env.SMTP_HOST;
    resetEmailProvidersForTests();

    expect(() => getSmtpEmailConfig()).toThrow(EmailProviderConfigurationError);
    try {
      getSmtpEmailConfig();
    } catch (error) {
      expect((error as Error).message).not.toContain("super-secret");
    }
  });

  describe("email destination confirmation and delivery path", () => {
    it("exposes the destination for review before a finalized invoice can be sent", async () => {
      const { auth, business, client, service } = await createFullTestFixture();
      await updateClient(auth, business.id, client.id, {
        name: client.name,
        billingAddress: "",
        contactEmail: "billing@client.test",
        status: "ACTIVE",
      });
      const finalized = await finalizeFixtureInvoice(auth, business, client, service);

      const preview = await getDeliveryPreview(auth, business.id, finalized.id);
      expect(preview.canSend).toBe(true);
      expect(preview.destinationEmail).toBe("billing@client.test");
    });

    it("rejects send attempts with an empty destination before delivery executes", async () => {
      const { auth, business, client, service } = await createFullTestFixture();
      const finalized = await finalizeFixtureInvoice(auth, business, client, service);

      await expect(sendInvoiceForBusiness(auth, business.id, finalized.id, "   ")).rejects.toBeInstanceOf(
        ValidationError,
      );
      const attempts = await listSendAttempts(auth, business.id, finalized.id);
      expect(attempts).toHaveLength(0);
    });

    it("uses the explicitly provided destination when send succeeds", async () => {
      const { auth, business, client, service } = await createFullTestFixture();
      const finalized = await finalizeFixtureInvoice(auth, business, client, service);
      const confirmedDestination = "confirmed.destination@client.test";

      const attempt = await sendInvoiceForBusiness(
        auth,
        business.id,
        finalized.id,
        confirmedDestination,
      );
      expect(attempt.status).toBe("SUCCESS");

      const audit = await withTx(auth, (tx) =>
        tx.auditEvent.findFirst({
          where: { entityType: "Invoice", entityId: finalized.id, eventType: "INVOICE_SEND_ATTEMPTED" },
          orderBy: { timestamp: "desc" },
        }),
      );
      expect(audit?.metadata).toMatchObject({ destination: confirmedDestination });
    });

    it("rejects draft and void invoices and preserves business isolation for delivery", async () => {
      const fixtureA = await createFullTestFixture();
      const fixtureB = await createFullTestFixture();

      const draft = await createInvoiceDraft(fixtureA.auth, fixtureA.business.id, {
        clientId: fixtureA.client.id,
      });
      await expect(
        sendInvoiceForBusiness(fixtureA.auth, fixtureA.business.id, draft.id, "billing@client.test"),
      ).rejects.toBeInstanceOf(InvalidStateError);

      const finalized = await finalizeFixtureInvoice(
        fixtureA.auth,
        fixtureA.business,
        fixtureA.client,
        fixtureA.service,
      );
      await voidInvoiceForBusiness(fixtureA.auth, fixtureA.business.id, finalized.id, "Cancelled");
      await expect(
        sendInvoiceForBusiness(fixtureA.auth, fixtureA.business.id, finalized.id, "billing@client.test"),
      ).rejects.toBeInstanceOf(InvalidStateError);

      const invoiceB = await finalizeFixtureInvoice(
        fixtureB.auth,
        fixtureB.business,
        fixtureB.client,
        fixtureB.service,
      );
      await expect(
        sendInvoiceForBusiness(fixtureA.auth, fixtureA.business.id, invoiceB.id, "billing@client.test"),
      ).rejects.toThrow();
    });
  });

  it("enforces business isolation for business profile, PDF, and delivery", async () => {
    const fixtureA = await createFullTestFixture();
    const fixtureB = await createFullTestFixture();
    const invoiceB = await finalizeFixtureInvoice(
      fixtureB.auth,
      fixtureB.business,
      fixtureB.client,
      fixtureB.service,
    );

    await expect(getBusinessProfile(fixtureA.auth, fixtureB.business.id)).rejects.toBeInstanceOf(
      BusinessAuthorizationError,
    );
    await expect(getFinalizedInvoicePdf(fixtureA.auth, fixtureA.business.id, invoiceB.id)).rejects.toThrow();
    await expect(
      sendInvoiceForBusiness(fixtureA.auth, fixtureA.business.id, invoiceB.id, "billing@client.test"),
    ).rejects.toThrow();
  });
});
