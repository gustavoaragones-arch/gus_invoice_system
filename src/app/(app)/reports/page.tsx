import Link from "next/link";
import { ReportsPeriodControls } from "@/components/reports/ReportsPeriodControls";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { getFinancialReport } from "@/server/application/reporting";
import { formatDate, formatMoney } from "@/lib/format";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { period?: string; start?: string; end?: string };
}) {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);

  const periodKind = searchParams.period === "custom" ? "custom" : "calendar-ytd";
  const report = await getFinancialReport(auth, business.id, {
    periodKind,
    startDate: searchParams.start,
    endDate: searchParams.end,
  });

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Financial reports</h1>
          <p>
            Operational billing revenue, collections, and outstanding balances for {business.name}.
          </p>
        </div>
      </div>

      <ReportsPeriodControls
        periodKind={periodKind}
        startDate={periodKind === "custom" ? report.period.start : undefined}
        endDate={periodKind === "custom" ? report.period.end : undefined}
      />

      <section className="card stack" aria-label="Summary metrics">
        <div>
          <h2 style={{ margin: 0 }}>Summary</h2>
          <p style={{ color: "var(--text-muted)", margin: "0.35rem 0 0" }}>{report.periodLabel}</p>
        </div>
        <div className="summary-grid">
          <div className="summary-card">
            <h3>Revenue</h3>
            <p>{formatMoney(report.summary.revenue)}</p>
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Pre-tax finalized invoices · {report.summary.invoiceCount} invoice
              {report.summary.invoiceCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="summary-card">
            <h3>Amount collected</h3>
            <p>{formatMoney(report.summary.amountCollected)}</p>
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Non-reversed payments · {report.summary.paymentCount} payment
              {report.summary.paymentCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="summary-card">
            <h3>Outstanding</h3>
            <p>{formatMoney(report.summary.outstanding)}</p>
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Current balance due on finalized invoices
            </span>
          </div>
          <div className="summary-card">
            <h3>Sales tax</h3>
            <p>{formatMoney(report.summary.salesTax)}</p>
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Reported separately from revenue
            </span>
          </div>
        </div>
      </section>

      <section className="card stack" aria-label="Monthly activity">
        <h2 style={{ margin: 0 }}>Monthly activity</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Revenue</th>
                <th>Amount collected</th>
              </tr>
            </thead>
            <tbody>
              {report.monthlyActivity.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{formatMoney(row.revenue)}</td>
                  <td>{formatMoney(row.amountCollected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack" aria-label="Revenue detail">
        <h2 style={{ margin: 0 }}>Revenue invoices</h2>
        {report.revenueInvoices.length === 0 ? (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No finalized invoices in this period.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Revenue</th>
                  <th>Sales tax</th>
                  <th>Total</th>
                  <th>Balance due</th>
                </tr>
              </thead>
              <tbody>
                {report.revenueInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber ?? "—"}</Link>
                    </td>
                    <td>{formatDate(invoice.invoiceDate)}</td>
                    <td>{invoice.clientName}</td>
                    <td>{formatMoney(invoice.preTaxSubtotal)}</td>
                    <td>{formatMoney(invoice.salesTaxTotal)}</td>
                    <td>{formatMoney(invoice.invoiceTotal)}</td>
                    <td>{formatMoney(invoice.balanceDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack" aria-label="Collection detail">
        <h2 style={{ margin: 0 }}>Collections</h2>
        {report.collectionPayments.length === 0 ? (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No non-reversed payments in this period.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payment date</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {report.collectionPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td>
                      <Link href={`/invoices/${payment.invoiceId}`}>{payment.invoiceNumber ?? "—"}</Link>
                    </td>
                    <td>{formatMoney(payment.amount)}</td>
                    <td>{payment.method ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack" aria-label="Outstanding detail">
        <h2 style={{ margin: 0 }}>Outstanding balances</h2>
        {report.outstandingInvoices.length === 0 ? (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No invoices with a positive balance due.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Client</th>
                  <th>Total</th>
                  <th>Collected</th>
                  <th>Balance due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.outstandingInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber ?? "—"}</Link>
                    </td>
                    <td>{formatDate(invoice.invoiceDate)}</td>
                    <td>{invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</td>
                    <td>{invoice.clientName}</td>
                    <td>{formatMoney(invoice.invoiceTotal)}</td>
                    <td>{formatMoney(invoice.amountCollected)}</td>
                    <td>{formatMoney(invoice.balanceDue)}</td>
                    <td>
                      {invoice.paymentStatus}
                      {invoice.isOverdue ? " · Overdue" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report.overpaidInvoices.length > 0 ? (
        <section className="card stack" aria-label="Overpayment detail">
          <h2 style={{ margin: 0 }}>Overpayments</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Total</th>
                  <th>Collected</th>
                  <th>Overpayment</th>
                </tr>
              </thead>
              <tbody>
                {report.overpaidInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber ?? "—"}</Link>
                    </td>
                    <td>{formatDate(invoice.invoiceDate)}</td>
                    <td>{invoice.clientName}</td>
                    <td>{formatMoney(invoice.invoiceTotal)}</td>
                    <td>{formatMoney(invoice.amountCollected)}</td>
                    <td>{formatMoney(invoice.overpayment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
