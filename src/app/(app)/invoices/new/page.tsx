import Link from "next/link";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { listClients } from "@/server/application/clients";
import { createInvoiceAction } from "@/server/actions/invoices";

export default async function NewInvoicePage() {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);
  const clients = await listClients(auth, business.id);

  if (clients.length === 0) {
    return (
      <div className="stack">
        <div className="page-header">
          <div>
            <h1>Create invoice</h1>
            <p>A client is required before you can create an invoice.</p>
          </div>
        </div>
        <div className="card">
          <p>Create a client first, then return to invoice creation.</p>
          <Link className="btn btn-primary" href="/clients/new">Create client</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Create invoice</h1>
          <p>Start a new draft invoice.</p>
        </div>
      </div>
      <form action={async (formData) => { await createInvoiceAction(formData); }} className="card stack">
        <div className="field">
          <label htmlFor="clientId">Client *</label>
          <select id="clientId" name="clientId" required>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="invoiceDate">Invoice date</label>
          <input id="invoiceDate" name="invoiceDate" type="date" />
        </div>
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} />
        </div>
        <button className="btn btn-primary" type="submit">Create draft</button>
      </form>
    </div>
  );
}
