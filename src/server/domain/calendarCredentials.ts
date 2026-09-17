import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import type { CalendarProviderCredentials } from "@/server/calendar/types";
import { getCalendarProviderMode } from "@/server/calendar/googleCalendarConfig";
import { refreshGoogleAccessToken } from "@/server/calendar/googleCalendarApi";
import { CalendarProviderAuthError } from "@/server/calendar/calendarProviderErrors";
import { assertBusinessAccess } from "./businessAuthorization";
import { decryptToken, encryptToken } from "./tokenEncryption";
import { NotFoundError, ValidationError } from "./errors";

export async function loadConnectionCredentials(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  connectionId: string,
): Promise<{ connectionId: string; credentials: CalendarProviderCredentials }> {
  await assertBusinessAccess(tx, auth, businessId);

  const connection = await tx.calendarConnection.findFirst({
    where: { id: connectionId, businessId, status: "ACTIVE" },
  });
  if (!connection) throw new NotFoundError("Active calendar connection not found.");
  if (!connection.accessTokenCiphertext || !connection.refreshTokenCiphertext) {
    throw new ValidationError("Calendar connection credentials are unavailable.");
  }

  return {
    connectionId: connection.id,
    credentials: {
      accessToken: decryptToken(connection.accessTokenCiphertext),
      refreshToken: decryptToken(connection.refreshTokenCiphertext),
      googleAccountEmail: connection.googleAccountEmail,
    },
  };
}

export async function withRefreshedCalendarCredentials<T>(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  connectionId: string,
  work: (credentials: CalendarProviderCredentials) => Promise<T>,
): Promise<T> {
  const loaded = await loadConnectionCredentials(tx, auth, businessId, connectionId);

  try {
    return await work(loaded.credentials);
  } catch (error) {
    if (!(error instanceof CalendarProviderAuthError) || getCalendarProviderMode() !== "google") {
      throw error;
    }

    const refreshed = await refreshGoogleAccessToken(loaded.credentials.refreshToken);
    const nextCredentials: CalendarProviderCredentials = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? loaded.credentials.refreshToken,
      googleAccountEmail: loaded.credentials.googleAccountEmail,
    };

    await tx.calendarConnection.update({
      where: { id: loaded.connectionId },
      data: {
        accessTokenCiphertext: encryptToken(nextCredentials.accessToken),
        refreshTokenCiphertext: encryptToken(nextCredentials.refreshToken),
      },
    });

    return work(nextCredentials);
  }
}
