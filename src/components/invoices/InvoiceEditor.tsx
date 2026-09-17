"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInvoiceLinesAction, updateInvoiceAction } from "@/server/actions/invoices";

type Line = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxStatus: "TAXABLE" | "ZERO_RATED" | "EXEMPT";
  serviceId?: string;
};

export function InvoiceEditor({
  invoiceId,
  clients,
  services,
  initialClientId,
  initialInvoiceDate,
  initialNotes,
  initialLines,
  preview,
}: {
  invoiceId: string;
  clients: Array<{ id: string; name: string }>;
  services: Array<{ id: string; description: string; defaultRate: string; unit: string; taxStatus: string | null }>;
  initialClientId: string;
  initialInvoiceDate: string | null;
  initialNotes: string | null;
  initialLines: Line[];
  preview: {
    preTaxSubtotal: string;
    totalTax: string | null;
    invoiceTotal: string | null;
    taxApplicabilityStatus: "resolved" | "unresolved";
    taxApplicabilityMessage?: string;
  };
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initialLines.length > 0 ? initialLines : [{ description: "", quantity: "1", unitPrice: "0.00", taxStatus: "TAXABLE" }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const displaySubtotal = useMemo(
    () =>
      lines
        .reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
        .toFixed(2),
    [lines],
  );

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [...current, { description: "", quantity: "1", unitPrice: "0.00", taxStatus: "TAXABLE" }]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  function applyService(index: number, serviceId: string) {
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;
    updateLine(index, {
      serviceId,
      description: service.description,
      unitPrice: service.defaultRate,
      taxStatus: (service.taxStatus as Line["taxStatus"]) ?? "TAXABLE",
    });
  }

  function saveAll(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const headerResult = await updateInvoiceAction(invoiceId, formData);
      if (!headerResult.ok) {
        setError(headerResult.error);
        return;
      }
      const linesResult = await saveInvoiceLinesAction(invoiceId, lines);
      if (!linesResult.ok) {
        setError(linesResult.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={saveAll} className="stack">
      <div className="card stack">
        <div className="grid-2">
          <div className="field">
            <label htmlFor="clientId">Client *</label>
            <select id="clientId" name="clientId" defaultValue={initialClientId} required>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="invoiceDate">Invoice date</label>
            <input id="invoiceDate" name="invoiceDate" type="date" defaultValue={initialInvoiceDate ?? ""} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={initialNotes ?? ""} />
        </div>
      </div>

      <div className="card stack">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2 style={{ margin: 0 }}>Line items</h2>
          <button type="button" className="btn btn-secondary" onClick={addLine}>Add line</button>
        </div>
        {lines.map((line, index) => (
          <div key={index} className="card" style={{ background: "#fbfcfd" }}>
            <div className="grid-2">
              <div className="field">
                <label>Service reference</label>
                <select value={line.serviceId ?? ""} onChange={(event) => applyService(index, event.target.value)}>
                  <option value="">Manual entry</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.description}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tax status</label>
                <select value={line.taxStatus} onChange={(event) => updateLine(index, { taxStatus: event.target.value as Line["taxStatus"] })}>
                  <option value="TAXABLE">Taxable</option>
                  <option value="ZERO_RATED">Zero-rated</option>
                  <option value="EXEMPT">Exempt</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Description *</label>
              <input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} required />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Quantity *</label>
                <input value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} required />
              </div>
              <div className="field">
                <label>Unit price *</label>
                <input value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} required />
              </div>
            </div>
            {lines.length > 1 ? (
              <button type="button" className="btn btn-secondary" onClick={() => removeLine(index)}>Remove line</button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="card invoice-totals">
        <div><span>Subtotal (preview)</span><span>${displaySubtotal}</span></div>
        {preview.taxApplicabilityStatus === "unresolved" ? (
          <div className="alert alert-warning" role="status">
            {preview.taxApplicabilityMessage}
          </div>
        ) : (
          <>
            <div><span>Tax</span><span>{preview.totalTax ? `$${preview.totalTax}` : "—"}</span></div>
            <div className="total"><span>Total</span><span>{preview.invoiceTotal ? `$${preview.invoiceTotal}` : "—"}</span></div>
          </>
        )}
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
          Authoritative totals are calculated on the server when you save or finalize.
        </p>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save draft"}
        </button>
        <a className="btn btn-secondary" href={`/invoices/${invoiceId}/review`}>Review invoice</a>
      </div>
    </form>
  );
}
