"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectCalendarAction, disconnectCalendarAction } from "@/server/actions/calendar";
import { formatDate } from "@/lib/format";

export function CalendarConnectionPanel({
  connection,
  providerMode,
}: {
  connection: {
    id: string;
    googleAccountEmail: string | null;
    status: "ACTIVE" | "DISCONNECTED";
    connectedAt: Date;
  } | null;
  providerMode: "development" | "google";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card stack">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ margin: 0 }}>Calendar connection</h2>
          <p>Connect Google Calendar as assistive work evidence for the selected business.</p>
        </div>
        {connection?.status === "ACTIVE" ? (
          <button
            className="btn btn-secondary"
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await disconnectCalendarAction(connection.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {pending ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : providerMode === "google" ? (
          <a className="btn btn-primary" href="/api/calendar/oauth/start">
            Connect Google Calendar
          </a>
        ) : (
          <button
            className="btn btn-primary"
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await connectCalendarAction();
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {pending ? "Connecting..." : "Connect calendar"}
          </button>
        )}
      </div>

      {connection?.status === "ACTIVE" ? (
        <div className="card" style={{ background: "#fbfcfd" }}>
          <div><strong>Status:</strong> Connected</div>
          <div><strong>Account:</strong> {connection.googleAccountEmail ?? "—"}</div>
          <div><strong>Connected:</strong> {formatDate(connection.connectedAt)}</div>
          <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>
            {providerMode === "google"
              ? "Production Google Calendar integration is enabled. Synchronization retrieves evidence only and never creates invoices automatically."
              : "Development environments use a non-production calendar provider. Events are simulated and not retrieved from Google unless a production provider is configured."}
          </p>
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          No active calendar connection. Connect to discover calendars and import work evidence.
        </p>
      )}

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    </section>
  );
}
