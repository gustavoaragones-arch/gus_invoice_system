import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarConnectionPanel } from "@/components/calendar/CalendarConnectionPanel";
import { CalendarSelectionPanel } from "@/components/calendar/CalendarSelectionPanel";
import { SyncCalendarPanel } from "@/components/calendar/SyncCalendarPanel";
import { WorkCandidateReview } from "@/components/calendar/WorkCandidateReview";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import {
  discoverCalendarsForBusiness,
  getCalendarWorkspace,
} from "@/server/application/calendar";
import { listClients } from "@/server/application/clients";
import { listServices } from "@/server/application/services";
import { formatDate } from "@/lib/format";

export default async function CalendarPage() {
  const auth = await getServerAuthContext();
  const business = await requireSelectedBusiness(auth);
  const workspace = await getCalendarWorkspace(auth, business.id);
  const [clients, services] = await Promise.all([
    listClients(auth, business.id),
    listServices(auth, business.id),
  ]);

  const availableCalendars = workspace.connection
    ? await discoverCalendarsForBusiness(auth, business.id, workspace.connection.id)
    : [];

  const selectedCount = workspace.connection?.selectedCalendars.filter((calendar) => calendar.selected).length ?? 0;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Calendar evidence</h1>
          <p>Import Google Calendar events as assistive work evidence for {business.name}.</p>
        </div>
      </div>

      <CalendarConnectionPanel connection={workspace.connection} />

      {workspace.connection?.status === "ACTIVE" ? (
        <>
          <CalendarSelectionPanel
            connectionId={workspace.connection.id}
            availableCalendars={availableCalendars}
            selectedCalendars={workspace.connection.selectedCalendars}
          />

          {selectedCount > 0 ? <SyncCalendarPanel connectionId={workspace.connection.id} /> : null}

          <section className="card stack">
            <h2 style={{ margin: 0 }}>Imported events</h2>
            {workspace.events.length === 0 ? (
              <p style={{ color: "var(--text-muted)", margin: 0 }}>No imported events yet. Synchronize selected calendars to import evidence.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Calendar</th>
                      <th>Start</th>
                      <th>Work candidates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.events.map((event) => (
                      <tr key={event.id}>
                        <td>{event.title ?? "Untitled event"}</td>
                        <td>{event.selectedCalendar.displayName ?? "—"}</td>
                        <td>{formatDate(event.startAt)}</td>
                        <td>{event.workCandidates.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="stack">
            <div>
              <h2 style={{ margin: 0 }}>Work candidates</h2>
              <p>Review imported evidence before creating an invoice draft. Calendar evidence never creates invoices automatically.</p>
            </div>
            {workspace.workCandidates.length === 0 ? (
              <EmptyState
                title="No work candidates yet"
                description="Synchronize selected calendars to create reviewable work candidates."
              />
            ) : (
              workspace.workCandidates.map((candidate) => (
                <WorkCandidateReview
                  key={candidate.id}
                  candidate={candidate}
                  clients={clients}
                  services={services}
                />
              ))
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
