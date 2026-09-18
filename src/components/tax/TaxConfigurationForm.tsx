"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaxConfigurationAction } from "@/server/actions/taxConfiguration";

interface TaxLineDraft {
  taxAuthority: string;
  taxType: string;
  rate: string;
  appliesTo: string;
}

const EMPTY_LINE: TaxLineDraft = {
  taxAuthority: "",
  taxType: "",
  rate: "",
  appliesTo: "",
};

export function TaxConfigurationForm({
  suggestedEffectiveFrom,
}: {
  suggestedEffectiveFrom: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<TaxLineDraft[]>([{ ...EMPTY_LINE }]);

  function updateLine(index: number, field: keyof TaxLineDraft, value: string) {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line)),
    );
  }

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set(
      "taxLinesJson",
      JSON.stringify(
        lines.map((line) => ({
          taxAuthority: line.taxAuthority,
          taxType: line.taxType,
          rate: line.rate,
          appliesTo: line.appliesTo || null,
        })),
      ),
    );

    startTransition(async () => {
      const result = await createTaxConfigurationAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/business/tax");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="card stack">
      <div className="field">
        <label htmlFor="effectiveFrom">Effective from *</label>
        <input
          id="effectiveFrom"
          name="effectiveFrom"
          type="date"
          required
          defaultValue={suggestedEffectiveFrom}
        />
      </div>
      <label className="field" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input id="isGstHstRegistered" name="isGstHstRegistered" type="checkbox" defaultChecked />
        <span>GST/HST registered</span>
      </label>

      <div className="stack">
        <h3 style={{ margin: 0 }}>Tax lines</h3>
        {lines.map((line, index) => (
          <div key={index} className="card stack" style={{ background: "#fbfcfd" }}>
            <div className="grid-2">
              <div className="field">
                <label htmlFor={`taxAuthority-${index}`}>Tax authority *</label>
                <input
                  id={`taxAuthority-${index}`}
                  value={line.taxAuthority}
                  onChange={(event) => updateLine(index, "taxAuthority", event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`taxType-${index}`}>Tax type *</label>
                <input
                  id={`taxType-${index}`}
                  value={line.taxType}
                  onChange={(event) => updateLine(index, "taxType", event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor={`taxRate-${index}`}>Rate *</label>
                <input
                  id={`taxRate-${index}`}
                  value={line.rate}
                  onChange={(event) => updateLine(index, "rate", event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`appliesTo-${index}`}>Applies to</label>
                <input
                  id={`appliesTo-${index}`}
                  value={line.appliesTo}
                  onChange={(event) => updateLine(index, "appliesTo", event.target.value)}
                />
              </div>
            </div>
            {lines.length > 1 ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}
              >
                Remove line
              </button>
            ) : null}
          </div>
        ))}
        <button className="btn btn-secondary" type="button" onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}>
          Add tax line
        </button>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving..." : "Create tax configuration version"}
      </button>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
        Creating a new version closes the current version the day before the new effective date. Finalized invoices keep the tax values captured at finalization.
      </p>
    </form>
  );
}
