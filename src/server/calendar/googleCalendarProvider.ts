import type {
  CalendarDateRange,
  CalendarProvider,
  CalendarProviderCalendar,
  CalendarProviderConnectionResult,
  CalendarProviderCredentials,
  CalendarProviderEvent,
} from "./types";
import { listGoogleCalendars, listGoogleEvents } from "./googleCalendarApi";

/**
 * Production Google Calendar provider. Google-specific API access is confined
 * to googleCalendarApi.ts and googleOAuth.ts.
 */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "google";

  async connect(): Promise<CalendarProviderConnectionResult> {
    throw new Error("Google Calendar connections must be established through the OAuth flow.");
  }

  async listCalendars(credentials: CalendarProviderCredentials): Promise<CalendarProviderCalendar[]> {
    return listGoogleCalendars(credentials);
  }

  async listEvents(
    credentials: CalendarProviderCredentials,
    googleCalendarId: string,
    range: CalendarDateRange,
  ): Promise<CalendarProviderEvent[]> {
    return listGoogleEvents(credentials, googleCalendarId, range);
  }
}
