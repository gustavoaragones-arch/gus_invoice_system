"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  canExecuteInvoiceSend,
  shouldBlockSendWithoutDestinationConfirmation,
} from "@/lib/invoiceSendConfirmation";
import { sendInvoiceAction } from "@/server/actions/delivery";
import { formatMoney } from "@/lib/format";

export function SendInvoiceDialog({
  invoiceId,
  invoiceNumber,
  clientName,
  destinationEmail,
  balanceDue,
  dueDate,
}: {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  destinationEmail: string;
  balanceDue: string;
  dueDate?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(destinationEmail);
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSend = canExecuteInvoiceSend(email, destinationConfirmed);

  function closeDialog() {
    setOpen(false);
    setDestinationConfirmed(false);
    setError(null);
  }

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        Send invoice
      </button>
      {open ? (
        <div className="dialog-backdrop" role="presentation" onClick={closeDialog}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="send-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="send-title">Send invoice</h2>
            <p>Review the destination email, confirm it explicitly, then send the finalized invoice PDF.</p>
            <div className="field">
              <label htmlFor="destination-email">Destination email</label>
              <input
                id="destination-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setDestinationConfirmed(false);
                }}
                required
              />
            </div>
            <div className="card" style={{ background: "#fbfcfd" }}>
              <div><strong>Client:</strong> {clientName}</div>
              <div><strong>Invoice:</strong> {invoiceNumber}</div>
              <div><strong>Balance due:</strong> {formatMoney(balanceDue)}</div>
              {dueDate ? <div><strong>Due date:</strong> {dueDate}</div> : null}
            </div>
            <label className="field" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={destinationConfirmed}
                onChange={(event) => setDestinationConfirmed(event.target.checked)}
              />
              <span>I confirm the destination email above is correct.</span>
            </label>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              The email uses the approved application wording and attaches the finalized invoice PDF. Development environments use a non-production email provider unless SMTP is configured.
            </p>
            {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={pending || !canSend}
                onClick={() => {
                  setError(null);
                  if (shouldBlockSendWithoutDestinationConfirmation(destinationConfirmed)) {
                    setError("Confirm the destination email before sending.");
                    return;
                  }
                  if (!canExecuteInvoiceSend(email, destinationConfirmed)) {
                    setError("Enter a valid destination email and confirm it before sending.");
                    return;
                  }
                  startTransition(async () => {
                    const result = await sendInvoiceAction(invoiceId, email);
                    if (!result.ok) {
                      setError(result.error);
                      router.refresh();
                      return;
                    }
                    closeDialog();
                    router.refresh();
                  });
                }}
              >
                {pending ? "Sending..." : "Confirm send"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={closeDialog}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
