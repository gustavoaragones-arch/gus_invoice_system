import { ReversePaymentButton } from "./ReversePaymentButton";
import { formatDate, formatMoney } from "@/lib/format";

export function PaymentHistory({
  invoiceId,
  payments,
  canRecordPayments,
}: {
  invoiceId: string;
  canRecordPayments: boolean;
  payments: Array<{
    id: string;
    amount: { toString(): string };
    paymentDate: Date;
    method: string | null;
    notes: string | null;
    reversal: { id: string; reversedAt: Date; reason: string | null } | null;
  }>;
}) {
  if (payments.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>No payments recorded.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Notes</th>
            {canRecordPayments ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{formatDate(payment.paymentDate)}</td>
              <td>{formatMoney(payment.amount.toString())}</td>
              <td>{payment.method ?? "—"}</td>
              <td>{payment.reversal ? `Reversed ${formatDate(payment.reversal.reversedAt)}` : "Active"}</td>
              <td>{payment.notes ?? "—"}</td>
              {canRecordPayments ? (
                <td>
                  {payment.reversal ? "—" : (
                    <ReversePaymentButton
                      invoiceId={invoiceId}
                      paymentId={payment.id}
                      amount={payment.amount.toString()}
                      paymentDate={formatDate(payment.paymentDate)}
                    />
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
