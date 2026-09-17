import { describe, expect, it } from "vitest";
import { InvalidStateError } from "@/server/domain/errors";
import {
  createInvoiceDraft,
  createReplacementDraftForBusiness,
  finalizeInvoiceForBusiness,
  getInvoice,
  saveDraftLineItems,
  voidInvoiceForBusiness,
} from "@/server/application/invoices";
import { listSendAttempts, sendInvoiceForBusiness } from "@/server/application/delivery";
import {
  getInvoiceFinancialSummary,
  listInvoicePayments,
  recordPaymentForBusiness,
  reversePaymentForBusiness,
} from "@/server/application/payments";
import { createFullTestFixture } from "../support/factories";
import { getInvoiceBalance } from "@/server/domain/payments";
import { withTx } from "../support/factories";

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

describe("Phase 5 delivery and payment workflow", () => {
  it("sends a finalized invoice and records a successful attempt", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const finalized = await finalizeFixtureInvoice(auth, business, client, service);

    const before = await getInvoice(auth, business.id, finalized.id);
    const attempt = await sendInvoiceForBusiness(auth, business.id, finalized.id, "billing@client.test");
    expect(attempt.status).toBe("SUCCESS");

    const attempts = await listSendAttempts(auth, business.id, finalized.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.status).toBe("SUCCESS");

    const after = await getInvoice(auth, business.id, finalized.id);
    expect(after.invoiceTotal?.toString()).toBe(before.invoiceTotal?.toString());
    expect(after.preTaxSubtotal?.toString()).toBe(before.preTaxSubtotal?.toString());
    expect(after.totalTax?.toString()).toBe(before.totalTax?.toString());
  });

  it("rejects send attempts for draft and void invoices", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
    await expect(
      sendInvoiceForBusiness(auth, business.id, draft.id, "billing@client.test"),
    ).rejects.toBeInstanceOf(InvalidStateError);

    const finalized = await finalizeFixtureInvoice(auth, business, client, service);
    await voidInvoiceForBusiness(auth, business.id, finalized.id, "Cancelled");
    await expect(
      sendInvoiceForBusiness(auth, business.id, finalized.id, "billing@client.test"),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("records failed send attempts and preserves previous attempts on resend", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const finalized = await finalizeFixtureInvoice(auth, business, client, service);

    await expect(sendInvoiceForBusiness(auth, business.id, finalized.id, "invalid-email")).rejects.toThrow();

    const failedAttempts = await listSendAttempts(auth, business.id, finalized.id);
    expect(failedAttempts).toHaveLength(1);
    expect(failedAttempts[0]?.status).toBe("FAILURE");

    const success = await sendInvoiceForBusiness(auth, business.id, finalized.id, "billing@client.test");
    expect(success.status).toBe("SUCCESS");

    const attempts = await listSendAttempts(auth, business.id, finalized.id);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.status).toBe("SUCCESS");
    expect(attempts[1]?.status).toBe("FAILURE");
  });

  it("enforces business isolation for delivery", async () => {
    const fixtureA = await createFullTestFixture();
    const fixtureB = await createFullTestFixture();
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

  it("records payments against finalized invoices and rejects draft/void invoices", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const draft = await createInvoiceDraft(auth, business.id, { clientId: client.id });
    await expect(
      recordPaymentForBusiness(auth, business.id, {
        invoiceId: draft.id,
        amount: "50.00",
        paymentDate: new Date("2025-09-01"),
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);

    const finalized = await finalizeFixtureInvoice(auth, business, client, service);
    const payment = await recordPaymentForBusiness(auth, business.id, {
      invoiceId: finalized.id,
      amount: "50.00",
      paymentDate: new Date("2025-09-01"),
      method: "E-transfer",
    });
    expect(payment.amount.toFixed(2)).toBe("50.00");

    const payments = await listInvoicePayments(auth, business.id, finalized.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]?.method).toBe("E-transfer");

    await voidInvoiceForBusiness(auth, business.id, finalized.id, "Cancelled");
    await expect(
      recordPaymentForBusiness(auth, business.id, {
        invoiceId: finalized.id,
        amount: "10.00",
        paymentDate: new Date("2025-09-02"),
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("supports payment reversal, rejects double reversal, and keeps reversed payments visible", async () => {
    const { auth, business, client, service } = await createFullTestFixture({ taxLines: [] });
    const finalized = await finalizeFixtureInvoice(auth, business, client, service, "100.00");

    const payment = await recordPaymentForBusiness(auth, business.id, {
      invoiceId: finalized.id,
      amount: "100.00",
      paymentDate: new Date("2025-09-01"),
    });

    await reversePaymentForBusiness(auth, business.id, {
      paymentId: payment.id,
      reason: "Incorrect amount",
    });

    const payments = await listInvoicePayments(auth, business.id, finalized.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]?.reversal).not.toBeNull();
    expect(payments[0]?.amount.toFixed(2)).toBe("100.00");

    await expect(
      reversePaymentForBusiness(auth, business.id, { paymentId: payment.id, reason: "again" }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("allows overpayment and surfaces derived payment status", async () => {
    const { auth, business, client, service } = await createFullTestFixture({ taxLines: [] });
    const finalized = await finalizeFixtureInvoice(auth, business, client, service, "100.00");

    await recordPaymentForBusiness(auth, business.id, {
      invoiceId: finalized.id,
      amount: "150.00",
      paymentDate: new Date("2025-09-01"),
    });

    const summary = await getInvoiceFinancialSummary(auth, business.id, finalized.id);
    expect(summary?.balanceDue).toBe("0.00");
    expect(summary?.overpayment).toBe("50.00");
    expect(summary?.paymentStatus).toBe("Overpaid");
  });

  it("keeps void invoice payments attached and starts replacement invoices with zero payments", async () => {
    const { auth, business, client, service } = await createFullTestFixture({ taxLines: [] });
    const finalized = await finalizeFixtureInvoice(auth, business, client, service, "100.00");

    await recordPaymentForBusiness(auth, business.id, {
      invoiceId: finalized.id,
      amount: "100.00",
      paymentDate: new Date("2025-09-01"),
    });

    await voidInvoiceForBusiness(auth, business.id, finalized.id, "Correction");
    const voidInvoice = await getInvoice(auth, business.id, finalized.id);
    expect(voidInvoice.payments).toHaveLength(1);
    expect(voidInvoice.payments[0]?.reversal).toBeNull();

    const replacementDraft = await createReplacementDraftForBusiness(auth, business.id, finalized.id);
    await saveDraftLineItems(auth, business.id, replacementDraft.id, [
      {
        description: "Corrected work",
        quantity: "1",
        unitPrice: "100.00",
        taxStatus: "TAXABLE",
        serviceId: service.id,
      },
    ]);
    const replacement = await finalizeInvoiceForBusiness(auth, business.id, replacementDraft.id);
    const replacementPayments = await listInvoicePayments(auth, business.id, replacement.id);
    expect(replacementPayments).toHaveLength(0);
  });

  it("enforces business isolation for payments", async () => {
    const fixtureA = await createFullTestFixture();
    const fixtureB = await createFullTestFixture();
    const invoiceB = await finalizeFixtureInvoice(
      fixtureB.auth,
      fixtureB.business,
      fixtureB.client,
      fixtureB.service,
    );

    await expect(
      recordPaymentForBusiness(fixtureA.auth, fixtureA.business.id, {
        invoiceId: invoiceB.id,
        amount: "10.00",
        paymentDate: new Date("2025-09-01"),
      }),
    ).rejects.toThrow();
  });

  it("calculates balance due as invoice total minus non-reversed payments", async () => {
    const { auth, business, client, service } = await createFullTestFixture({ taxLines: [] });
    const finalized = await finalizeFixtureInvoice(auth, business, client, service, "300.00");

    const payment = await recordPaymentForBusiness(auth, business.id, {
      invoiceId: finalized.id,
      amount: "100.00",
      paymentDate: new Date("2025-09-01"),
    });

    const partialBalance = await withTx(auth, (tx) => getInvoiceBalance(tx, auth, finalized.id));
    expect(partialBalance.balanceDue.toFixed(2)).toBe("200.00");

    await reversePaymentForBusiness(auth, business.id, { paymentId: payment.id });
    const restoredBalance = await withTx(auth, (tx) => getInvoiceBalance(tx, auth, finalized.id));
    expect(restoredBalance.balanceDue.toFixed(2)).toBe("300.00");
    expect(restoredBalance.amountPaid.toFixed(2)).toBe("0.00");
  });
});
