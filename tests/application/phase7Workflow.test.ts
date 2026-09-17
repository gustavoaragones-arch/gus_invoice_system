import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectCalendarFromOAuthForBusiness,
  saveCalendarSelectionsForBusiness,
  syncCalendarsForBusiness,
} from "@/server/application/calendar";
import { resetCalendarProvidersForTests } from "@/server/calendar/calendarProvider";
import { CalendarProviderAuthError } from "@/server/calendar/calendarProviderErrors";
import { createFullTestFixture, withTx } from "../support/factories";

const listGoogleCalendarsMock = vi.fn();
const listGoogleEventsMock = vi.fn();
const refreshGoogleAccessTokenMock = vi.fn();

vi.mock("@/server/calendar/googleCalendarApi", () => ({
  listGoogleCalendars: (...args: unknown[]) => listGoogleCalendarsMock(...args),
  listGoogleEvents: (...args: unknown[]) => listGoogleEventsMock(...args),
  refreshGoogleAccessToken: (...args: unknown[]) => refreshGoogleAccessTokenMock(...args),
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = {
    ...originalEnv,
    CALENDAR_PROVIDER: "google",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:3000/api/calendar/oauth/callback",
  };
  resetCalendarProvidersForTests();
  listGoogleCalendarsMock.mockReset();
  listGoogleEventsMock.mockReset();
  refreshGoogleAccessTokenMock.mockReset();
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetCalendarProvidersForTests();
});

describe("Phase 7 production calendar workflow", () => {
  it("persists encrypted production OAuth connection for the business", async () => {
    const { auth, business } = await createFullTestFixture();
    const connection = await connectCalendarFromOAuthForBusiness(auth, business.id, {
      googleAccountEmail: "user@example.test",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    expect(connection.businessId).toBe(business.id);
    expect(connection.googleAccountEmail).toBe("user@example.test");
    expect(connection.accessTokenCiphertext).toBeTruthy();
    expect(connection.refreshTokenCiphertext).toBeTruthy();
    expect(connection.accessTokenCiphertext).not.toContain("access-token");
    expect(connection.refreshTokenCiphertext).not.toContain("refresh-token");
  });

  it("reconnects by updating the existing active connection", async () => {
    const { auth, business } = await createFullTestFixture();
    const first = await connectCalendarFromOAuthForBusiness(auth, business.id, {
      googleAccountEmail: "first@example.test",
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    const second = await connectCalendarFromOAuthForBusiness(auth, business.id, {
      googleAccountEmail: "second@example.test",
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });

    expect(second.id).toBe(first.id);
    expect(second.googleAccountEmail).toBe("second@example.test");
  });

  it("synchronizes Google events for selected calendars only with idempotency", async () => {
    const { auth, business } = await createFullTestFixture();
    const connection = await connectCalendarFromOAuthForBusiness(auth, business.id, {
      googleAccountEmail: "user@example.test",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    listGoogleCalendarsMock.mockResolvedValue([
      { googleCalendarId: "primary", displayName: "Primary" },
      { googleCalendarId: "work", displayName: "Work" },
    ]);
    listGoogleEventsMock.mockResolvedValue([
      {
        sourceEventId: "google-event-1",
        title: "Consulting",
        startAt: new Date("2025-01-10T10:00:00Z"),
        endAt: new Date("2025-01-10T11:00:00Z"),
        description: "Evidence only",
        lastModifiedAt: new Date("2025-01-01T12:00:00Z"),
      },
    ]);

    await saveCalendarSelectionsForBusiness(auth, business.id, connection.id, [
      { googleCalendarId: "primary", displayName: "Primary", selected: true },
      { googleCalendarId: "work", displayName: "Work", selected: false },
    ]);

    const first = await syncCalendarsForBusiness(auth, business.id, connection.id, {
      start: new Date("2025-01-01"),
      end: new Date("2025-01-31"),
    });
    expect(first.eventsUpserted).toBe(1);
    expect(first.candidatesCreated).toBe(1);
    expect(listGoogleEventsMock).toHaveBeenCalledTimes(1);

    const second = await syncCalendarsForBusiness(auth, business.id, connection.id, {
      start: new Date("2025-01-01"),
      end: new Date("2025-01-31"),
    });
    expect(second.eventsUpserted).toBe(1);
    expect(second.candidatesCreated).toBe(0);
  });

  it("refreshes expired access tokens and persists encrypted replacements", async () => {
    const { auth, business } = await createFullTestFixture();
    const connection = await connectCalendarFromOAuthForBusiness(auth, business.id, {
      googleAccountEmail: "user@example.test",
      accessToken: "expired-access",
      refreshToken: "refresh-token",
    });

    await saveCalendarSelectionsForBusiness(auth, business.id, connection.id, [
      { googleCalendarId: "primary", displayName: "Primary", selected: true },
    ]);

    listGoogleEventsMock
      .mockRejectedValueOnce(new CalendarProviderAuthError())
      .mockResolvedValueOnce([
        {
          sourceEventId: "google-event-1",
          title: "Consulting",
          startAt: new Date("2025-01-10T10:00:00Z"),
          endAt: new Date("2025-01-10T11:00:00Z"),
          description: "Evidence only",
          lastModifiedAt: new Date("2025-01-01T12:00:00Z"),
        },
      ]);

    refreshGoogleAccessTokenMock.mockResolvedValue({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });

    await syncCalendarsForBusiness(auth, business.id, connection.id, {
      start: new Date("2025-01-01"),
      end: new Date("2025-01-31"),
    });

    const reloaded = await withTx(auth, (tx) =>
      tx.calendarConnection.findUniqueOrThrow({ where: { id: connection.id } }),
    );
    expect(reloaded.accessTokenCiphertext).not.toContain("new-access-token");
    expect(reloaded.refreshTokenCiphertext).not.toContain("new-refresh-token");
    expect(refreshGoogleAccessTokenMock).toHaveBeenCalledTimes(1);
  });

  it("does not create payments, finalized invoices, or accounting changes during sync", async () => {
    const { auth, business } = await createFullTestFixture();
    const connection = await connectCalendarFromOAuthForBusiness(auth, business.id, {
      googleAccountEmail: "user@example.test",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    await saveCalendarSelectionsForBusiness(auth, business.id, connection.id, [
      { googleCalendarId: "primary", displayName: "Primary", selected: true },
    ]);

    listGoogleEventsMock.mockResolvedValue([
      {
        sourceEventId: "google-event-1",
        title: "Consulting",
        startAt: new Date("2025-01-10T10:00:00Z"),
        endAt: new Date("2025-01-10T11:00:00Z"),
        description: "Evidence only",
        lastModifiedAt: new Date("2025-01-01T12:00:00Z"),
      },
    ]);

    await syncCalendarsForBusiness(auth, business.id, connection.id, {
      start: new Date("2025-01-01"),
      end: new Date("2025-01-31"),
    });

    const counts = await withTx(auth, async (tx) => {
      const [invoices, payments, finalized] = await Promise.all([
        tx.invoice.count({ where: { businessId: business.id } }),
        tx.payment.count(),
        tx.invoice.count({ where: { businessId: business.id, status: "FINALIZED" } }),
      ]);
      return { invoices, payments, finalized };
    });

    expect(counts.invoices).toBe(0);
    expect(counts.payments).toBe(0);
    expect(counts.finalized).toBe(0);
  });
});
