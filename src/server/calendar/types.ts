export interface CalendarProviderCredentials {
  accessToken: string;
  refreshToken: string;
  googleAccountEmail: string | null;
}

export interface CalendarProviderCalendar {
  googleCalendarId: string;
  displayName: string;
}

export interface CalendarProviderEvent {
  sourceEventId: string;
  title: string | null;
  startAt: Date;
  endAt: Date;
  description: string | null;
  lastModifiedAt: Date;
}

export interface CalendarDateRange {
  start: Date;
  end: Date;
}

export interface CalendarProviderConnectionResult {
  googleAccountEmail: string;
  accessToken: string;
  refreshToken: string;
}

export interface CalendarProvider {
  readonly name: string;
  connect(): Promise<CalendarProviderConnectionResult>;
  listCalendars(credentials: CalendarProviderCredentials): Promise<CalendarProviderCalendar[]>;
  listEvents(
    credentials: CalendarProviderCredentials,
    googleCalendarId: string,
    range: CalendarDateRange,
  ): Promise<CalendarProviderEvent[]>;
}
