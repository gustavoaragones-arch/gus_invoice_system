"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCalendarSelectionsAction } from "@/server/actions/calendar";

export function CalendarSelectionPanel({
  connectionId,
  availableCalendars,
  selectedCalendars,
}: {
  connectionId: string;
  availableCalendars: Array<{ googleCalendarId: string; displayName: string }>;
  selectedCalendars: Array<{ googleCalendarId: string; displayName: string | null; selected: boolean }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const initialSelections = useMemo(() => {
    const selectedMap = new Map(selectedCalendars.map((calendar) => [calendar.googleCalendarId, calendar.selected]));
    return availableCalendars.map((calendar) => ({
      googleCalendarId: calendar.googleCalendarId,
      displayName: calendar.displayName,
      selected: selectedMap.get(calendar.googleCalendarId) ?? false,
    }));
  }, [availableCalendars, selectedCalendars]);

  const [selections, setSelections] = useState(initialSelections);

  return (
    <section className="card stack">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ margin: 0 }}>Selected calendars</h2>
          <p>Only selected calendars are eligible for work-evidence ingestion.</p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await saveCalendarSelectionsAction(connectionId, selections);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending ? "Saving..." : "Save selection"}
        </button>
      </div>

      <div className="stack">
        {selections.map((calendar) => (
          <label key={calendar.googleCalendarId} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={calendar.selected}
              onChange={(event) => {
                setSelections((current) =>
                  current.map((item) =>
                    item.googleCalendarId === calendar.googleCalendarId
                      ? { ...item, selected: event.target.checked }
                      : item,
                  ),
                );
              }}
            />
            <span>{calendar.displayName}</span>
          </label>
        ))}
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    </section>
  );
}
