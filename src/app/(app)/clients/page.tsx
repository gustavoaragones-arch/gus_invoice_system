import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { listClients } from "@/server/application/clients";
import { ClientSearch } from "@/components/clients/ClientSearch";

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string } }) {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);
  const clients = await listClients(auth, business.id, searchParams.q);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Clients</h1>
          <p>Manage bill-to parties for {business.name}</p>
        </div>
        <Link className="btn btn-primary" href="/clients/new">Create client</Link>
      </div>

      <ClientSearch initialQuery={searchParams.q ?? ""} />

      {clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Create a client to start billing."
          action={<Link className="btn btn-primary" href="/clients/new">Create client</Link>}
        />
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Billing address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td><Link href={`/clients/${client.id}`}>{client.name}</Link></td>
                  <td>{client.contactEmail ?? "—"}</td>
                  <td>{client.billingAddress ?? "—"}</td>
                  <td>{client.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
