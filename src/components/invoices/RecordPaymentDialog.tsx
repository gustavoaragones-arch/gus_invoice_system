"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPaymentAction } from "@/server/actions/payments";
import { formatMoney } from "@/lib/format";

export function RecordPaymentDialog({
  invoiceId,
  invoiceTotal,
  balanceDue,
}: {
  invoiceId: string;
  invoiceTotal: string;
  balanceDue: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(balanceDue);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        Record payment
      </button>
      {open ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="payment-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="payment-title">Record payment</h2>
            <p>Payment amount and date are immutable once recorded. Corrections require reversal and a new payment.</p>
            <div className="field">
              <label htmlFor="payment-amount">Amount *</label>
              <input id="payment-amount" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="payment-date">Payment date *</label>
              <input id="payment-date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="payment-method">Payment method</label>
              <input id="payment-method" value={method} onChange={(event) => setMethod(event.target.value)} placeholder="e.g. E-transfer, cheque" />
            </div>
            <div className="field">
              <label htmlFor="payment-notes">Notes</label>
              <textarea id="payment-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="card" style={{ background: "#fbfcfd" }}>
              <div><strong>Invoice total:</strong> {formatMoney(invoiceTotal)}</div>
              <div><strong>Current balance due:</strong> {formatMoney(balanceDue)}</div>
            </div>
            {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await recordPaymentAction(invoiceId, {
                      amount,
                      paymentDate,
                      method: method || undefined,
                      notes: notes || undefined,
                    });
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  });
                }}
              >
                {pending ? "Recording..." : "Confirm payment"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
