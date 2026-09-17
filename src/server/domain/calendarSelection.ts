import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { getCalendarProvider } from "@/server/calendar/calendarProvider";
import { assertBusinessAccess } from "./businessAuthorization";
import { getConnectionCredentials } from "./calendarConnection";
import { NotFoundError } from "./errors";

export async function discoverProviderCalendars(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  connectionId: string,
) {
  const credentials = await getConnectionCredentials(tx, auth, businessId, connectionId);
  return getCalendarProvider().listCalendars(credentials);
}

export interface CalendarSelectionInput {
  googleCalendarId: string;
  displayName: string;
  selected: boolean;
}

export async function saveCalendarSelections(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  connectionId: string,
  selections: CalendarSelectionInput[],
) {
  await assertBusinessAccess(tx, auth, businessId);

  const connection = await tx.calendarConnection.findFirst({
    where: { id: connectionId, businessId, status: "ACTIVE" },
  });
  if (!connection) throw new NotFoundError("Active calendar connection not found.");

  for (const selection of selections) {
    await tx.selectedCalendar.upsert({
      where: {
        calendarConnectionId_googleCalendarId: {
          calendarConnectionId: connection.id,
          googleCalendarId: selection.googleCalendarId,
        },
      },
      create: {
        calendarConnectionId: connection.id,
        googleCalendarId: selection.googleCalendarId,
        displayName: selection.displayName,
        selected: selection.selected,
      },
      update: {
        displayName: selection.displayName,
        selected: selection.selected,
      },
    });
  }

  return tx.selectedCalendar.findMany({
    where: { calendarConnectionId: connection.id },
    orderBy: { displayName: "asc" },
  });
}
