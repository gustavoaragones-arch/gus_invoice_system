"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBusinessAction, updateBusinessAction } from "@/server/actions/business";

export function BusinessForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: {
    name: string;
    legalName: string;
    address: string;
    gstHstRegistrationNumber: string;
    brandingLogoRef: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "create" ? await createBusinessAction(formData) : await updateBusinessAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/business");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="card stack">
      <div className="field">
        <label htmlFor="name">Business name *</label>
        <input id="name" name="name" required defaultValue={initial?.name ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="legalName">Legal name</label>
        <input id="legalName" name="legalName" defaultValue={initial?.legalName ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="address">Address</label>
        <textarea id="address" name="address" rows={3} defaultValue={initial?.address ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="gstHstRegistrationNumber">GST/HST registration number</label>
        <input
          id="gstHstRegistrationNumber"
          name="gstHstRegistrationNumber"
          defaultValue={initial?.gstHstRegistrationNumber ?? ""}
        />
      </div>
      <div className="field">
        <label htmlFor="brandingLogoRef">Branding logo reference</label>
        <input id="brandingLogoRef" name="brandingLogoRef" defaultValue={initial?.brandingLogoRef ?? ""} />
      </div>
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create business" : "Save changes"}
        </button>
      </div>
      {mode === "edit" ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Changes apply to future invoices only. Finalized invoices keep their original billed business snapshot.
        </p>
      ) : null}
    </form>
  );
}
