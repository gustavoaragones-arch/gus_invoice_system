import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CalendarProviderAuthError,
  CalendarProviderRateLimitError,
} from "@/server/calendar/calendarProviderErrors";
import { listGoogleCalendars, listGoogleEvents, refreshGoogleAccessToken } from "@/server/calendar/googleCalendarApi";

const calendarListMock = vi.fn();
const eventsListMock = vi.fn();
const refreshAccessTokenMock = vi.fn();
const setCredentialsMock = vi.fn();

vi.mock("googleapis", () => {
  class OAuth2 {
    setCredentials = setCredentialsMock;
    refreshAccessToken = refreshAccessTokenMock;
  }

  return {
    google: {
      auth: { OAuth2 },
      calendar: vi.fn(() => ({
        calendarList: { list: calendarListMock },
        events: { list: eventsListMock },
      })),
    },
  };
});

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...originalEnv,
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:3000/api/calendar/oauth/callback",
  };
  calendarListMock.mockReset();
  eventsListMock.mockReset();
  refreshAccessTokenMock.mockReset();
  setCredentialsMock.mockReset();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("google calendar api", () => {
  const credentials = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    googleAccountEmail: "user@example.test",
  };

  it("lists calendars with pagination", async () => {
    calendarListMock
      .mockResolvedValueOnce({
        data: {
          items: [{ id: "primary", summary: "Primary" }],
          nextPageToken: "page-2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: "work", summary: "Work" }],
        },
      });

    const calendars = await listGoogleCalendars(credentials);
    expect(calendars).toEqual([
      { googleCalendarId: "primary", displayName: "Primary" },
      { googleCalendarId: "work", displayName: "Work" },
    ]);
    expect(calendarListMock).toHaveBeenCalledTimes(2);
  });

  it("lists events with pagination and cancelled-event containment", async () => {
    eventsListMock
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "event-1",
              summary: "Consulting",
              start: { dateTime: "2025-01-10T10:00:00Z" },
              end: { dateTime: "2025-01-10T11:00:00Z" },
              updated: "2025-01-01T12:00:00Z",
            },
            {
              id: "event-2",
              summary: "Cancelled meeting",
              status: "cancelled",
              start: { dateTime: "2025-01-11T10:00:00Z" },
              end: { dateTime: "2025-01-11T11:00:00Z" },
              updated: "2025-01-02T12:00:00Z",
            },
          ],
          nextPageToken: "page-2",
        },
      })
      .mockResolvedValueOnce({ data: { items: [] } });

    const events = await listGoogleEvents(credentials, "primary", {
      start: new Date("2025-01-01"),
      end: new Date("2025-01-31"),
    });

    expect(events).toHaveLength(2);
    expect(events[1]?.description).toContain("Google Calendar event status: cancelled");
    expect(eventsListMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes access tokens without returning plaintext persistence details", async () => {
    refreshAccessTokenMock.mockResolvedValue({
      credentials: {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
      },
    });

    const refreshed = await refreshGoogleAccessToken("refresh-token");
    expect(refreshed.accessToken).toBe("new-access-token");
    expect(refreshed.refreshToken).toBe("new-refresh-token");
  });

  it("maps auth failures to CalendarProviderAuthError", async () => {
    calendarListMock.mockRejectedValue({
      response: { status: 401 },
      name: "GaxiosError",
    });

    await expect(listGoogleCalendars(credentials)).rejects.toBeInstanceOf(CalendarProviderAuthError);
  });

  it("maps rate limiting to CalendarProviderRateLimitError", async () => {
    eventsListMock.mockRejectedValue({
      response: { status: 429 },
      name: "GaxiosError",
    });

    await expect(
      listGoogleEvents(credentials, "primary", {
        start: new Date("2025-01-01"),
        end: new Date("2025-01-31"),
      }),
    ).rejects.toBeInstanceOf(CalendarProviderRateLimitError);
  });
});
