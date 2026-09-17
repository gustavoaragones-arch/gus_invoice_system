import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { getOverviewData } from "@/server/application/overview";
import { formatDate, formatMoney } from "@/lib/format";

export default async function OverviewPage() {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);
  const overview = await getOverviewData(auth, business.id);

  const isEmpty =
    overview.counts.clients === 0 &&
    overview.counts.services === 0 &&
    overview.counts.drafts + overview.counts.finalized + overview.counts.voided === 0;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Overview</h1>
          <p>Operational summary for {business.name}</p>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          title="No billing activity yet"
          description="Create your first client and service, then start a draft invoice."
          action={<Link className="btn btn-primary" href="/clients/new">Create client</Link>}
        />
      ) : (
        <>
          <div className="summary-grid">
            <div className="card summary-card"><h3>Draft invoices</h3><p>{overview.counts.drafts}</p></div>
            <div className="card summary-card"><h3>Finalized invoices</h3><p>{overview.counts.finalized}</p></div>
            <div className="card summary-card"><h3>Clients</h3><p>{overview.counts.clients}</p></div>
          </div>

          <div className="grid-2">
            <section className="card stack">
              <h2 style={{ margin: 0 }}>Drafts needing review</h2>
              {overview.draftsNeedingReview.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No draft invoices.</p>
              ) : (
                overview.draftsNeedingReview.map((draft) => (
                  <div key={draft.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                    <div>
                      <strong>{draft.clientName}</strong>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                        {draft.lineItemCount} line item{draft.lineItemCount === 1 ? "" : "s"} · Updated {formatDate(draft.updatedAt)}
                      </div>
                    </div>
                    <Link href={`/invoices/${draft.id}/review`}>Review</Link>
                  </div>
                ))
              )}
            </section>

            <section className="card stack">
              <h2 style={{ margin: 0 }}>Recent invoices</h2>
              {overview.recentInvoices.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No invoices yet.</p>
              ) : (
                overview.recentInvoices.map((invoice) => (
                  <div key={invoice.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                    <div>
                      <Link href={`/invoices/${invoice.id}`}>
                        <strong>{invoice.invoiceNumber ?? "Draft"}</strong> · {invoice.clientName}
                      </Link>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                        {formatDate(invoice.updatedAt)} · {formatMoney(invoice.invoiceTotal)}
                      </div>
                    </div>
                    <Badge status={invoice.status} />
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
