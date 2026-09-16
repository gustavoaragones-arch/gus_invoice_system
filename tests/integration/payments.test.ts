import { describe, expect, it } from "vitest";
import { createFullTestFixture, withTx } from "../support/factories";
import { createDraftInvoice, finalizeInvoice, setDraftLineItems } from "@/server/domain/invoiceLifecycle";
import { getInvoiceBalance, recordPayment, reversePayment } from "@/server/domain/payments";
import { InvalidStateError } from "@/server/domain/errors";

async function finalizeSimpleInvoice(auth: Awaited<ReturnType<typeof createFullTestFixture>>["auth"], business: { id: string }, client: { id: string }, service: { id: string }, amount = "1000.00") {
  return withTx(auth, async (tx) => {
    const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
    await setDraftLineItems(tx, auth, draft.id, [
      { description: "Work", quantity: "1", unitPrice: amount, taxStatus: "TAXABLE", serviceId: service.id },
    ]);
    return finalizeInvoice(tx, auth, { invoiceId: draft.id });
  });
}

describe("payments (DEC-PAY-*; INV-PAY-*; INV-PREV-*)", () => {
  it("a payment requires a Finalized, non-Void invoice", async () => {
    const { auth, business, client } = await createFullTestFixture();

    await withTx(auth, async (tx) => {
      const draft = await createDraftInvoice(tx, auth, { businessId: business.id, clientId: client.id });
      await expect(
        recordPayment(tx, auth, { invoiceId: draft.id, amount: "100.00", paymentDate: new Date() }),
      ).rejects.toBeInstanceOf(InvalidStateError);
    });
  });

  it("payment amount and date are immutable; correction requires reversal + a new payment", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const invoice = await finalizeSimpleInvoice(auth, business, client, service);

    const payment = await withTx(auth, (tx) =>
      recordPayment(tx, auth, { invoiceId: invoice.id, amount: "500.00", paymentDate: new Date("2025-02-01") }),
    );

    // No domain function exists to change amount/date directly — the only
    // sanctioned correction path is reversal + a new payment.
    await withTx(auth, (tx) => reversePayment(tx, auth, { paymentId: payment.id, reason: "wrong amount" }));
    const corrected = await withTx(auth, (tx) =>
      recordPayment(tx, auth, { invoiceId: invoice.id, amount: "550.00", paymentDate: new Date("2025-02-02") }),
    );

    const reloadedOriginal = await withTx(auth, (tx) => tx.payment.findUniqueOrThrow({ where: { id: payment.id } }));
    expect(reloadedOriginal.amount.toFixed(2)).toBe("500.00"); // unchanged, preserved permanently
    expect(corrected.amount.toFixed(2)).toBe("550.00");
  });

  it("a reversed payment is excluded from Amount Paid / Balance Due", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const invoice = await finalizeSimpleInvoice(auth, business, client, service, "1050.00"); // total incl. tax = 1102.50 at 5%

    const payment = await withTx(auth, (tx) =>
      recordPayment(tx, auth, { invoiceId: invoice.id, amount: "1102.50", paymentDate: new Date() }),
    );

    const balanceBeforeReversal = await withTx(auth, (tx) => getInvoiceBalance(tx, auth, invoice.id));
    expect(balanceBeforeReversal.balanceDue.toFixed(2)).toBe("0.00");

    await withTx(auth, (tx) => reversePayment(tx, auth, { paymentId: payment.id }));

    const balanceAfterReversal = await withTx(auth, (tx) => getInvoiceBalance(tx, auth, invoice.id));
    expect(balanceAfterReversal.amountPaid.toFixed(2)).toBe("0.00");
    expect(balanceAfterReversal.balanceDue.toFixed(2)).toBe("1102.50");
  });

  it("a payment cannot be reversed twice", async () => {
    const { auth, business, client, service } = await createFullTestFixture();
    const invoice = await finalizeSimpleInvoice(auth, business, client, service);
    const payment = await withTx(auth, (tx) =>
      recordPayment(tx, auth, { invoiceId: invoice.id, amount: "100.00", paymentDate: new Date() }),
    );

    await withTx(auth, (tx) => reversePayment(tx, auth, { paymentId: payment.id }));
    await expect(
      withTx(auth, (tx) => reversePayment(tx, auth, { paymentId: payment.id })),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("overpayment is accepted and surfaced, not blocked or silently absorbed", async () => {
    const { auth, business, client, service } = await createFullTestFixture({ taxLines: [] });
    const invoice = await finalizeSimpleInvoice(auth, business, client, service, "100.00");

    await withTx(auth, (tx) => recordPayment(tx, auth, { invoiceId: invoice.id, amount: "150.00", paymentDate: new Date() }));

    const balance = await withTx(auth, (tx) => getInvoiceBalance(tx, auth, invoice.id));
    expect(balance.balanceDue.toFixed(2)).toBe("0.00");
    expect(balance.overpayment.toFixed(2)).toBe("50.00");
  });

  it("multiple partial payments sum correctly toward Amount Paid", async () => {
    const { auth, business, client, service } = await createFullTestFixture({ taxLines: [] });
    const invoice = await finalizeSimpleInvoice(auth, business, client, service, "300.00");

    await withTx(auth, (tx) => recordPayment(tx, auth, { invoiceId: invoice.id, amount: "100.00", paymentDate: new Date() }));
    await withTx(auth, (tx) => recordPayment(tx, auth, { invoiceId: invoice.id, amount: "100.00", paymentDate: new Date() }));

    const balance = await withTx(auth, (tx) => getInvoiceBalance(tx, auth, invoice.id));
    expect(balance.amountPaid.toFixed(2)).toBe("200.00");
    expect(balance.balanceDue.toFixed(2)).toBe("100.00");
  });
});
