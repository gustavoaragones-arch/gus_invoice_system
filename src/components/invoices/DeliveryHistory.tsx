import { formatDate } from "@/lib/format";

export function DeliveryHistory({
  attempts,
}: {
  attempts: Array<{ id: string; attemptedAt: Date; status: "SUCCESS" | "FAILURE"; errorMessage: string | null }>;
}) {
  if (attempts.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>No delivery attempts yet.</p>;
  }

  const latest = attempts[0];
  const previous = attempts.slice(1);
  if (!latest) {
    return <p style={{ color: "var(--text-muted)" }}>No delivery attempts yet.</p>;
  }

  return (
    <div className="stack">
      <div>
        <strong>Last attempt</strong>
        <div>
          {formatDate(latest.attemptedAt)} — {latest.status === "SUCCESS" ? "Successful" : "Failed"}
          {latest.errorMessage ? ` (${latest.errorMessage})` : ""}
        </div>
      </div>
      {previous.length > 0 ? (
        <div>
          <strong>Previous attempts</strong>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
            {previous.map((attempt) => (
              <li key={attempt.id}>
                {formatDate(attempt.attemptedAt)} — {attempt.status === "SUCCESS" ? "Successful" : "Failed"}
                {attempt.errorMessage ? ` (${attempt.errorMessage})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
