"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvoiceAction } from "@/server/actions/delivery";
import { formatMoney } from "@/lib/format";

export function SendInvoiceDialog({
  invoiceId,
  invoiceNumber,
  clientName,
  destinationEmail,
  balanceDue,
}: {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  destinationEmail: string;
  balanceDue: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(destinationEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        Send invoice
      </button>
      {open ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="send-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="send-title">Send invoice</h2>
            <p>Confirm delivery details. Each send creates a separate delivery attempt record.</p>
            <div className="field">
              <label htmlFor="destination-email">Destination email</label>
              <input
                id="destination-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="card" style={{ background: "#fbfcfd" }}>
              <div><strong>Client:</strong> {clientName}</div>
              <div><strong>Invoice:</strong> {invoiceNumber}</div>
              <div><strong>Balance due:</strong> {formatMoney(balanceDue)}</div>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Development environments use a non-production email provider. Delivery is recorded, but email is not sent to a real mailbox unless a production provider is configured.
            </p>
            {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await sendInvoiceAction(invoiceId, email);
                    if (!result.ok) {
                      setError(result.error);
                      router.refresh();
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  });
                }}
              >
                {pending ? "Sending..." : "Confirm send"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
