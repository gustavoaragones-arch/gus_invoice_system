import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { GaxiosError } from "gaxios";
import { createGoogleOAuthClient } from "./googleOAuth";
import type {
  CalendarDateRange,
  CalendarProviderCalendar,
  CalendarProviderCredentials,
  CalendarProviderEvent,
} from "./types";
import {
  CalendarProviderAuthError,
  CalendarProviderRateLimitError,
  CalendarProviderUnavailableError,
} from "./calendarProviderErrors";

export interface GoogleTokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
}

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof GaxiosError) {
    return error.response?.status;
  }
  if (typeof error === "object" && error !== null && "response" in error) {
    return (error as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

function mapGoogleError(error: unknown): never {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) {
    throw new CalendarProviderAuthError();
  }
  if (status === 429) {
    throw new CalendarProviderRateLimitError();
  }
  if (status && status >= 500) {
    throw new CalendarProviderUnavailableError();
  }
  throw new CalendarProviderUnavailableError("Google Calendar request failed.");
}

function parseEventDateTime(
  value: calendar_v3.Schema$EventDateTime | null | undefined,
): Date | null {
  if (!value) return null;
  if (value.dateTime) return new Date(value.dateTime);
  if (value.date) return new Date(`${value.date}T00:00:00.000Z`);
  return null;
}

function mapGoogleEvent(item: calendar_v3.Schema$Event): CalendarProviderEvent | null {
  if (!item.id) return null;

  const startAt = parseEventDateTime(item.start);
  const endAt = parseEventDateTime(item.end);
  if (!startAt || !endAt) return null;

  let description = item.description ?? null;
  if (item.status === "cancelled") {
    const cancellationNote = "Google Calendar event status: cancelled";
    description = description ? `${cancellationNote}\n\n${description}` : cancellationNote;
  }

  return {
    sourceEventId: item.id,
    title: item.summary ?? null,
    startAt,
    endAt,
    description,
    lastModifiedAt: item.updated ? new Date(item.updated) : new Date(),
  };
}

function createAuthedClient(credentials: CalendarProviderCredentials) {
  const client = createGoogleOAuthClient();
  client.setCredentials({
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
  });
  return client;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<GoogleTokenRefreshResult> {
  const client = createGoogleOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) {
      throw new CalendarProviderAuthError();
    }
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token ?? undefined,
    };
  } catch (error) {
    mapGoogleError(error);
  }
}

export async function listGoogleCalendars(
  credentials: CalendarProviderCredentials,
): Promise<CalendarProviderCalendar[]> {
  const auth = createAuthedClient(credentials);
  const calendar = google.calendar({ version: "v3", auth });
  const calendars: CalendarProviderCalendar[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const response = await calendar.calendarList.list({
        pageToken,
        minAccessRole: "reader",
      });

      for (const item of response.data.items ?? []) {
        if (!item.id) continue;
        calendars.push({
          googleCalendarId: item.id,
          displayName: item.summary ?? item.id,
        });
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (error) {
    mapGoogleError(error);
  }

  return calendars;
}

export async function listGoogleEvents(
  credentials: CalendarProviderCredentials,
  googleCalendarId: string,
  range: CalendarDateRange,
): Promise<CalendarProviderEvent[]> {
  const auth = createAuthedClient(credentials);
  const calendar = google.calendar({ version: "v3", auth });
  const events: CalendarProviderEvent[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const response = await calendar.events.list({
        calendarId: googleCalendarId,
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        pageToken,
      });

      for (const item of response.data.items ?? []) {
        const mapped = mapGoogleEvent(item);
        if (mapped) events.push(mapped);
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (error) {
    mapGoogleError(error);
  }

  return events;
}
