import type {
  CalendarDateRange,
  CalendarProvider,
  CalendarProviderCalendar,
  CalendarProviderConnectionResult,
  CalendarProviderCredentials,
  CalendarProviderEvent,
} from "./types";

/**
 * Deterministic development/test calendar provider. Does not call Google and
 * must not be described as production calendar synchronization.
 */
export class DevelopmentCalendarProvider implements CalendarProvider {
  readonly name = "development";

  async connect(): Promise<CalendarProviderConnectionResult> {
    return {
      googleAccountEmail: "dev-calendar@example.test",
      accessToken: "development-access-token",
      refreshToken: "development-refresh-token",
    };
  }

  async listCalendars(_credentials: CalendarProviderCredentials): Promise<CalendarProviderCalendar[]> {
    return [
      { googleCalendarId: "dev-primary", displayName: "Development Primary Calendar" },
      { googleCalendarId: "dev-work", displayName: "Development Work Calendar" },
    ];
  }

  async listEvents(
    _credentials: CalendarProviderCredentials,
    googleCalendarId: string,
    range: CalendarDateRange,
  ): Promise<CalendarProviderEvent[]> {
    const start = new Date(range.start);
    start.setHours(10, 0, 0, 0);

    return [
      {
        sourceEventId: `${googleCalendarId}-event-1`,
        title: `Consulting session (${googleCalendarId})`,
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60 * 1000),
        description: "Development calendar evidence event.",
        lastModifiedAt: new Date("2025-01-01T12:00:00.000Z"),
      },
      {
        sourceEventId: `${googleCalendarId}-event-2`,
        title: `Follow-up meeting (${googleCalendarId})`,
        startAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        endAt: new Date(start.getTime() + 3 * 60 * 60 * 1000),
        description: "Second development calendar evidence event.",
        lastModifiedAt: new Date("2025-01-02T12:00:00.000Z"),
      },
    ];
  }
}
