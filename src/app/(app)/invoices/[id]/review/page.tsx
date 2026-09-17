import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { FinalizeDialog } from "@/components/invoices/FinalizeDialog";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { getDraftInvoicePreview, getInvoice } from "@/server/application/invoices";
import { formatDate, formatMoney } from "@/lib/format";

export default async function InvoiceReviewPage({ params }: { params: { id: string } }) {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);

  let invoice;
  try {
    invoice = await getInvoice(auth, business.id, params.id);
  } catch {
    notFound();
  }

  if (invoice.status !== "DRAFT") {
    redirect(`/invoices/${invoice.id}`);
  }

  const preview = await getDraftInvoicePreview(auth, business.id, invoice.id, invoice.invoiceDate ?? undefined);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Review invoice</h1>
          <p>Confirm billing identity, line items, and totals before finalization.</p>
        </div>
        <Badge status={invoice.status} />
      </div>

      <div className="grid-2">
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Billing identity</h2>
          <div><strong>Client:</strong> {invoice.client.name}</div>
          <div><strong>Business:</strong> {business.name}</div>
          <div><strong>Invoice date:</strong> {formatDate(invoice.invoiceDate ?? new Date())}</div>
        </section>
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Financial summary</h2>
          <div><strong>Subtotal:</strong> {formatMoney(preview.preTaxSubtotal)}</div>
          <div><strong>Tax:</strong> {preview.totalTax ? formatMoney(preview.totalTax) : "Cannot be determined"}</div>
          <div><strong>Total:</strong> {preview.invoiceTotal ? formatMoney(preview.invoiceTotal) : "Cannot be determined"}</div>
        </section>
      </div>

      <div className="card table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Tax status</th>
              <th>Line subtotal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td>{line.quantity.toString()}</td>
                <td>{formatMoney(line.unitPrice.toString())}</td>
                <td>{line.taxStatus}</td>
                <td>{formatMoney(line.lineSubtotal.toString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.taxApplicabilityStatus === "unresolved" ? (
        <div className="alert alert-warning" role="status">
          {preview.taxApplicabilityMessage}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <FinalizeDialog
          invoiceId={invoice.id}
          invoiceDate={invoice.invoiceDate ? invoice.invoiceDate.toISOString().slice(0, 10) : null}
          canFinalize={preview.canFinalize}
          blockedMessage={preview.taxApplicabilityMessage}
        />
        <Link className="btn btn-secondary" href={`/invoices/${invoice.id}`}>Back to edit</Link>
      </div>
    </div>
  );
}
