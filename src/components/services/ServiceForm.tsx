"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createServiceAction, updateServiceAction } from "@/server/actions/services";

export function ServiceForm({
  mode,
  serviceId,
  initial,
}: {
  mode: "create" | "edit";
  serviceId?: string;
  initial?: {
    description: string;
    unit: string;
    defaultRate: string;
    taxStatus?: string | null;
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
          ? await createServiceAction(formData)
          : await updateServiceAction(serviceId!, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(mode === "create" ? `/services/${result.data.id}` : `/services/${serviceId}`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="card stack">
      <div className="field">
        <label htmlFor="description">Description *</label>
        <input id="description" name="description" required defaultValue={initial?.description ?? ""} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="unit">Unit *</label>
          <input id="unit" name="unit" required defaultValue={initial?.unit ?? "hour"} />
        </div>
        <div className="field">
          <label htmlFor="defaultRate">Default rate *</label>
          <input id="defaultRate" name="defaultRate" required defaultValue={initial?.defaultRate ?? "0.00"} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="taxStatus">Tax status</label>
          <select id="taxStatus" name="taxStatus" defaultValue={initial?.taxStatus ?? ""}>
            <option value="">Not set</option>
            <option value="TAXABLE">Taxable</option>
            <option value="ZERO_RATED">Zero-rated</option>
            <option value="EXEMPT">Exempt</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={initial?.status ?? "ACTIVE"}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving..." : mode === "create" ? "Create service" : "Save changes"}
      </button>
    </form>
  );
}
