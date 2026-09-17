import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { listServices } from "@/server/application/services";
import { formatMoney } from "@/lib/format";

export default async function ServicesPage() {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);
  const services = await listServices(auth, business.id);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Services</h1>
          <p>Manage billable services for {business.name}</p>
        </div>
        <Link className="btn btn-primary" href="/services/new">Create service</Link>
      </div>

      {services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Create a service to speed up invoice line entry."
          action={<Link className="btn btn-primary" href="/services/new">Create service</Link>}
        />
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Unit</th>
                <th>Default rate</th>
                <th>Tax status</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td><Link href={`/services/${service.id}`}>{service.description}</Link></td>
                  <td>{service.unit}</td>
                  <td>{formatMoney(service.defaultRate.toString())}</td>
                  <td>{service.taxStatus ?? "—"}</td>
                  <td>{service.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
