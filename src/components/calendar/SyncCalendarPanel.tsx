"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncCalendarsAction } from "@/server/actions/calendar";

export function SyncCalendarPanel({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const [startDate, setStartDate] = useState(defaultStart.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card stack">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ margin: 0 }}>Synchronize events</h2>
          <p>Import calendar events from selected calendars as evidence. Synchronization does not create invoices or payments.</p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await syncCalendarsAction(connectionId, startDate, endDate);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMessage(
                `Synchronized ${result.data.eventsUpserted} event(s), created ${result.data.candidatesCreated} new work candidate(s).`,
              );
              router.refresh();
            });
          }}
        >
          {pending ? "Synchronizing..." : "Synchronize"}
        </button>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="sync-start">Start date</label>
          <input id="sync-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sync-end">End date</label>
          <input id="sync-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>
      </div>

      {message ? <div className="alert" role="status">{message}</div> : null}
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    </section>
  );
}
