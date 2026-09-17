"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidInvoiceAction } from "@/server/actions/invoices";

export function VoidDialog({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className="btn btn-danger" type="button" onClick={() => setOpen(true)}>
        Void invoice
      </button>
      {open ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="void-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="void-title">Void invoice</h2>
            <p>
              Voiding is irreversible. The original invoice is preserved, payments remain on the void invoice,
              and a replacement draft can be created separately if needed.
            </p>
            <div className="field">
              <label htmlFor="void-reason">Reason</label>
              <textarea id="void-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
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
                    const result = await voidInvoiceAction(invoiceId, reason);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  });
                }}
              >
                {pending ? "Voiding..." : "Confirm void"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
