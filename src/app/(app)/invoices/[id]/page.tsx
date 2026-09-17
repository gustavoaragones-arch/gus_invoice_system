import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { InvoiceEditor } from "@/components/invoices/InvoiceEditor";
import { VoidDialog } from "@/components/invoices/VoidDialog";
import { CreateReplacementButton } from "@/components/invoices/CreateReplacementButton";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import {
  getBilledBusinessSnapshot,
  getBilledClientSnapshot,
  getDraftInvoicePreview,
  getInvoice,
} from "@/server/application/invoices";
import { listClients } from "@/server/application/clients";
import { listServices } from "@/server/application/services";
import { formatDate, formatMoney } from "@/lib/format";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);

  let invoice;
  try {
    invoice = await getInvoice(auth, business.id, params.id);
  } catch {
    notFound();
  }

  const billedClient = getBilledClientSnapshot(invoice);
  const billedBusiness = getBilledBusinessSnapshot(invoice);

  if (invoice.status === "DRAFT") {
    const [clients, services, preview] = await Promise.all([
      listClients(auth, business.id),
      listServices(auth, business.id),
      getDraftInvoicePreview(auth, business.id, invoice.id, invoice.invoiceDate ?? undefined),
    ]);

    return (
      <div className="stack">
        <div className="page-header">
          <div>
            <h1>Draft invoice</h1>
            <p>Edit invoice details before review and finalization.</p>
          </div>
          <Badge status={invoice.status} />
        </div>
        <InvoiceEditor
          invoiceId={invoice.id}
          clients={clients}
          services={services.map((service) => ({
            id: service.id,
            description: service.description,
            defaultRate: service.defaultRate.toString(),
            unit: service.unit,
            taxStatus: service.taxStatus,
          }))}
          initialClientId={invoice.clientId}
          initialInvoiceDate={invoice.invoiceDate ? invoice.invoiceDate.toISOString().slice(0, 10) : null}
          initialNotes={invoice.notes}
          initialLines={invoice.lineItems.map((line) => ({
            description: line.description,
            quantity: line.quantity.toString(),
            unitPrice: line.unitPrice.toString(),
            taxStatus: line.taxStatus,
            serviceId: line.serviceId ?? undefined,
          }))}
          preview={preview}
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Invoice {invoice.invoiceNumber ?? "—"}</h1>
          <p>Read-only finalized invoice record.</p>
        </div>
        <Badge status={invoice.status} />
      </div>

      <div className="grid-2">
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Billed client</h2>
          <p><strong>{billedClient.name}</strong></p>
          <p>{billedClient.contactEmail ?? "—"}</p>
          <p>{billedClient.billingAddress ?? "—"}</p>
        </section>
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Billed business</h2>
          <p><strong>{billedBusiness?.legalName ?? business.name}</strong></p>
          <p>{billedBusiness?.address ?? "—"}</p>
          <p>{billedBusiness?.gstHstRegistrationNumber ?? "—"}</p>
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

      <div className="card invoice-totals">
        <div><span>Subtotal</span><span>{formatMoney(invoice.preTaxSubtotal?.toString() ?? null)}</span></div>
        <div><span>Tax</span><span>{formatMoney(invoice.totalTax?.toString() ?? null)}</span></div>
        <div className="total"><span>Total</span><span>{formatMoney(invoice.invoiceTotal?.toString() ?? null)}</span></div>
        {invoice.status === "FINALIZED" ? (
          <div><span>Balance due</span><span>{formatMoney(invoice.balanceDue)}</span></div>
        ) : null}
      </div>

      <div className="card stack">
        <div><strong>Invoice date:</strong> {formatDate(invoice.invoiceDate)}</div>
        <div><strong>Finalized:</strong> {formatDate(invoice.finalizedAt)}</div>
        {invoice.replaces ? (
          <div>
            <strong>Replaces:</strong>{" "}
            <Link href={`/invoices/${invoice.replaces.id}`}>
              {invoice.replaces.invoiceNumber ?? invoice.replaces.id}
            </Link>
          </div>
        ) : null}
        {invoice.replacedBy ? (
          <div>
            <strong>Replaced by:</strong>{" "}
            <Link href={`/invoices/${invoice.replacedBy.id}`}>
              {invoice.replacedBy.invoiceNumber ?? invoice.replacedBy.id}
            </Link>
          </div>
        ) : null}
      </div>

      {invoice.status === "FINALIZED" ? <VoidDialog invoiceId={invoice.id} /> : null}
      {invoice.status === "VOID" && !invoice.replacedBy ? <CreateReplacementButton invoiceId={invoice.id} /> : null}
    </div>
  );
}
