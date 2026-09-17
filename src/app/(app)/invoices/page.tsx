import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { listInvoices } from "@/server/application/invoices";
import { formatDate, formatMoney } from "@/lib/format";

export default async function InvoicesPage() {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);
  const invoices = await listInvoices(auth, business.id);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Manage draft, finalized, and void invoices for {business.name}</p>
        </div>
        <Link className="btn btn-primary" href="/invoices/new">Create invoice</Link>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Create a draft invoice to begin billing."
          action={<Link className="btn btn-primary" href="/invoices/new">Create invoice</Link>}
        />
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total</th>
                <th>Balance due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td><Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber ?? "Draft"}</Link></td>
                  <td>{invoice.client.name}</td>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td><Badge status={invoice.status} /></td>
                  <td>{formatMoney(invoice.invoiceTotal?.toString() ?? null)}</td>
                  <td>{invoice.balanceDue ? formatMoney(invoice.balanceDue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
