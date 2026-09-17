"use client";

import { useState, useTransition } from "react";
import { createReplacementAction } from "@/server/actions/invoices";

export function CreateReplacementButton({ invoiceId }: { invoiceId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        className="btn btn-primary"
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createReplacementAction(invoiceId);
            if (result && !result.ok) setError(result.error);
          });
        }}
      >
        {pending ? "Creating..." : "Create replacement draft"}
      </button>
      {error ? <div className="alert alert-error" role="alert" style={{ marginTop: "0.75rem" }}>{error}</div> : null}
    </div>
  );
}
