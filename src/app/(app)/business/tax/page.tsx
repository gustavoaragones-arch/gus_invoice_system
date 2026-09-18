import Link from "next/link";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { listTaxConfigurations } from "@/server/application/taxConfiguration";
import { formatDate } from "@/lib/format";

export default async function BusinessTaxConfigurationPage() {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);
  const versions = await listTaxConfigurations(auth, business.id);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Tax configuration</h1>
          <p>Versioned tax settings for {business.name}. Changes apply to future finalizations only.</p>
        </div>
        <Link className="btn btn-primary" href="/business/tax/new">New version</Link>
      </div>

      <section className="card stack">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href="/business">Back to business profile</Link>
          <Link className="btn btn-secondary" href="/reports">Reporting (calendar YTD)</Link>
        </div>
      </section>

      {versions.length === 0 ? (
        <section className="card stack">
          <p style={{ margin: 0 }}>No tax configuration versions exist for this business yet.</p>
          <Link className="btn btn-primary" href="/business/tax/new">Create first version</Link>
        </section>
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Effective from</th>
                <th>Effective to</th>
                <th>GST/HST registered</th>
                <th>Tax lines</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td>{formatDate(version.effectiveFrom)}</td>
                  <td>{version.effectiveTo ? formatDate(version.effectiveTo) : "Current"}</td>
                  <td>{version.isGstHstRegistered ? "Yes" : "No"}</td>
                  <td>
                    {version.taxLines
                      .map((line) => `${line.taxType} (${line.taxAuthority}) @ ${line.rate}`)
                      .join("; ")}
                  </td>
                  <td>{version.isCurrent ? "Current" : "Historical"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
