"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reversePaymentAction } from "@/server/actions/payments";
import { formatMoney } from "@/lib/format";

export function ReversePaymentButton({
  invoiceId,
  paymentId,
  amount,
  paymentDate,
}: {
  invoiceId: string;
  paymentId: string;
  amount: string;
  paymentDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className="btn btn-secondary" type="button" onClick={() => setOpen(true)}>
        Reverse
      </button>
      {open ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="reverse-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="reverse-title">Reverse payment</h2>
            <p>
              Reversal creates a separate correction record. The original payment of {formatMoney(amount)} dated {paymentDate} remains visible and unchanged.
            </p>
            <div className="field">
              <label htmlFor="reverse-reason">Reason</label>
              <textarea id="reverse-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                className="btn btn-danger"
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await reversePaymentAction(invoiceId, paymentId, reason);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  });
                }}
              >
                {pending ? "Reversing..." : "Confirm reversal"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
