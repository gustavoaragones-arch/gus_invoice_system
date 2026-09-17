import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { getCalendarProvider } from "@/server/calendar/calendarProvider";
import type { CalendarProviderCredentials } from "@/server/calendar/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { recordAuditEvent } from "./audit";
import { decryptToken, encryptToken } from "./tokenEncryption";
import { NotFoundError, ValidationError } from "./errors";

export async function connectCalendar(tx: Tx, auth: AuthContext, businessId: string) {
  await assertBusinessAccess(tx, auth, businessId);

  const providerResult = await getCalendarProvider().connect();
  const connection = await tx.calendarConnection.create({
    data: {
      businessId,
      provider: "google",
      googleAccountEmail: providerResult.googleAccountEmail,
      accessTokenCiphertext: encryptToken(providerResult.accessToken),
      refreshTokenCiphertext: encryptToken(providerResult.refreshToken),
      status: "ACTIVE",
    },
  });

  await recordAuditEvent(tx, {
    businessId,
    eventType: "CALENDAR_CONNECTION_CHANGED",
    actorUserId: auth.userId,
    entityType: "CalendarConnection",
    entityId: connection.id,
    newValues: { status: "ACTIVE", provider: connection.provider, googleAccountEmail: connection.googleAccountEmail },
    metadata: { action: "connected", providerName: getCalendarProvider().name },
  });

  return connection;
}

export async function disconnectCalendar(tx: Tx, auth: AuthContext, connectionId: string, businessId: string) {
  await assertBusinessAccess(tx, auth, businessId);

  const connection = await tx.calendarConnection.findFirst({
    where: { id: connectionId, businessId },
  });
  if (!connection) throw new NotFoundError("Calendar connection not found.");

  const updated = await tx.calendarConnection.update({
    where: { id: connection.id },
    data: {
      status: "DISCONNECTED",
      disconnectedAt: new Date(),
      accessTokenCiphertext: null,
      refreshTokenCiphertext: null,
    },
  });

  await recordAuditEvent(tx, {
    businessId,
    eventType: "CALENDAR_CONNECTION_CHANGED",
    actorUserId: auth.userId,
    entityType: "CalendarConnection",
    entityId: connection.id,
    priorValues: { status: connection.status },
    newValues: { status: "DISCONNECTED" },
    metadata: { action: "disconnected" },
  });

  return updated;
}

export async function getActiveCalendarConnection(tx: Tx, auth: AuthContext, businessId: string) {
  await assertBusinessAccess(tx, auth, businessId);
  return tx.calendarConnection.findFirst({
    where: { businessId, status: "ACTIVE" },
    include: { selectedCalendars: { orderBy: { displayName: "asc" } } },
    orderBy: { connectedAt: "desc" },
  });
}

export async function getConnectionCredentials(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  connectionId: string,
): Promise<CalendarProviderCredentials> {
  await assertBusinessAccess(tx, auth, businessId);

  const connection = await tx.calendarConnection.findFirst({
    where: { id: connectionId, businessId, status: "ACTIVE" },
  });
  if (!connection) throw new NotFoundError("Active calendar connection not found.");
  if (!connection.accessTokenCiphertext || !connection.refreshTokenCiphertext) {
    throw new ValidationError("Calendar connection credentials are unavailable.");
  }

  return {
    accessToken: decryptToken(connection.accessTokenCiphertext),
    refreshToken: decryptToken(connection.refreshTokenCiphertext),
    googleAccountEmail: connection.googleAccountEmail,
  };
}
