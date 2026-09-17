"use client";

import { useState, useTransition } from "react";
import { finalizeInvoiceAction } from "@/server/actions/invoices";

export function FinalizeDialog({
  invoiceId,
  invoiceDate,
  canFinalize,
  blockedMessage,
}: {
  invoiceId: string;
  invoiceDate: string | null;
  canFinalize: boolean;
  blockedMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canFinalize) {
    return (
      <div className="alert alert-warning" role="status">
        {blockedMessage ??
          "This invoice cannot be finalized until tax applicability can be determined from the current configuration."}
      </div>
    );
  }

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        Finalize invoice
      </button>
      {open ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="finalize-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="finalize-title">Finalize invoice</h2>
            <p>
              Finalization makes this invoice financially binding. After finalization, invoice values are locked,
              an invoice number is assigned, and corrections require the approved Void + Replacement process.
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
                    const result = await finalizeInvoiceAction(invoiceId, invoiceDate ?? undefined);
                    if (result && !result.ok) setError(result.error);
                  });
                }}
              >
                {pending ? "Finalizing..." : "Confirm finalization"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
