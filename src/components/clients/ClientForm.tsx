"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientAction, updateClientAction } from "@/server/actions/clients";

export function ClientForm({
  mode,
  clientId,
  initial,
}: {
  mode: "create" | "edit";
  clientId?: string;
  initial?: {
    name: string;
    billingAddress: string;
    contactEmail: string;
    status?: "ACTIVE" | "INACTIVE";
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClientAction(formData)
          : await updateClientAction(clientId!, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(mode === "create" ? `/clients/${result.data.id}` : `/clients/${clientId}`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="card stack">
      <div className="field">
        <label htmlFor="name">Client name *</label>
        <input id="name" name="name" required defaultValue={initial?.name ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="billingAddress">Billing address</label>
        <textarea id="billingAddress" name="billingAddress" rows={3} defaultValue={initial?.billingAddress ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="contactEmail">Contact email</label>
        <input id="contactEmail" name="contactEmail" type="email" defaultValue={initial?.contactEmail ?? ""} />
      </div>
      {mode === "edit" ? (
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={initial?.status ?? "ACTIVE"}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      ) : null}
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create client" : "Save changes"}
        </button>
      </div>
      {mode === "edit" ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Changes apply to future invoices only. Finalized invoices keep their original billed client snapshot.
        </p>
      ) : null}
    </form>
  );
}
