import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { getCalendarProvider } from "@/server/calendar/calendarProvider";
import type { CalendarDateRange } from "@/server/calendar/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { withRefreshedCalendarCredentials } from "./calendarCredentials";
import { NotFoundError, ValidationError } from "./errors";

export interface CalendarSyncResult {
  eventsUpserted: number;
  candidatesCreated: number;
  selectedCalendarsProcessed: number;
}

/**
 * Ingests provider events for selected calendars only. CalendarEvent upsert
 * is idempotent by (selectedCalendarId, sourceEventId). WorkCandidate
 * creation is limited to one candidate per CalendarEvent as a technical
 * containment measure — the approved duplicate algorithm remains unresolved.
 */
export async function syncSelectedCalendars(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  connectionId: string,
  range: CalendarDateRange,
): Promise<CalendarSyncResult> {
  await assertBusinessAccess(tx, auth, businessId);

  if (range.end <= range.start) {
    throw new ValidationError("Sync end date must be after the start date.");
  }

  const connection = await tx.calendarConnection.findFirst({
    where: { id: connectionId, businessId, status: "ACTIVE" },
  });
  if (!connection) throw new NotFoundError("Active calendar connection not found.");

  const selectedCalendars = await tx.selectedCalendar.findMany({
    where: { calendarConnectionId: connection.id, selected: true },
  });
  if (selectedCalendars.length === 0) {
    throw new ValidationError("Select at least one calendar before synchronizing.");
  }

  const provider = getCalendarProvider();

  return withRefreshedCalendarCredentials(tx, auth, businessId, connection.id, async (credentials) => {
    let eventsUpserted = 0;
    let candidatesCreated = 0;

    for (const selectedCalendar of selectedCalendars) {
      const providerEvents = await provider.listEvents(credentials, selectedCalendar.googleCalendarId, range);

      for (const providerEvent of providerEvents) {
        const calendarEvent = await tx.calendarEvent.upsert({
          where: {
            selectedCalendarId_sourceEventId: {
              selectedCalendarId: selectedCalendar.id,
              sourceEventId: providerEvent.sourceEventId,
            },
          },
          create: {
            selectedCalendarId: selectedCalendar.id,
            sourceEventId: providerEvent.sourceEventId,
            title: providerEvent.title,
            startAt: providerEvent.startAt,
            endAt: providerEvent.endAt,
            description: providerEvent.description,
            lastModifiedAt: providerEvent.lastModifiedAt,
          },
          update: {
            title: providerEvent.title,
            startAt: providerEvent.startAt,
            endAt: providerEvent.endAt,
            description: providerEvent.description,
            retrievedAt: new Date(),
            lastModifiedAt: providerEvent.lastModifiedAt,
          },
        });
        eventsUpserted += 1;

        const existingCandidate = await tx.workCandidate.findFirst({
          where: { calendarEventId: calendarEvent.id },
        });
        if (!existingCandidate) {
          await tx.workCandidate.create({
            data: {
              businessId,
              calendarEventId: calendarEvent.id,
              reviewState: "PENDING",
              matchConfidence: "UNMATCHED",
            },
          });
          candidatesCreated += 1;
        }
      }
    }

    return {
      eventsUpserted,
      candidatesCreated,
      selectedCalendarsProcessed: selectedCalendars.length,
    };
  });
}
