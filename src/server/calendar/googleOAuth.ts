import { SignJWT, jwtVerify } from "jose";
import { google } from "googleapis";
import { GOOGLE_CALENDAR_SCOPES, getGoogleOAuthConfig } from "./googleCalendarConfig";
import { CalendarProviderConfigurationError } from "./calendarProviderErrors";
import type { CalendarProviderConnectionResult } from "./types";

const OAUTH_STATE_MAX_AGE = "10m";

function getStateSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new CalendarProviderConfigurationError("SUPABASE_JWT_SECRET is not configured.");
  }
  return new TextEncoder().encode(secret);
}

export function createGoogleOAuthClient() {
  const config = getGoogleOAuthConfig();
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

export async function createGoogleOAuthState(input: { userId: string; businessId: string }): Promise<string> {
  return new SignJWT({
    businessId: input.businessId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(OAUTH_STATE_MAX_AGE)
    .sign(getStateSecret());
}

export async function verifyGoogleOAuthState(state: string): Promise<{ userId: string; businessId: string }> {
  const { payload } = await jwtVerify(state, getStateSecret());
  const userId = payload.sub;
  const businessId = payload.businessId;

  if (!userId || typeof businessId !== "string") {
    throw new CalendarProviderConfigurationError("Invalid OAuth state.");
  }

  return { userId, businessId };
}

export function buildGoogleAuthorizationUrl(state: string): string {
  const client = createGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [...GOOGLE_CALENDAR_SCOPES],
    state,
  });
}

export async function exchangeGoogleAuthorizationCode(code: string): Promise<CalendarProviderConnectionResult> {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new CalendarProviderConfigurationError(
      "Google did not return the required OAuth tokens. Reconnect and grant offline access.",
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = await oauth2.userinfo.get();
  const googleAccountEmail = profile.data.email;

  if (!googleAccountEmail) {
    throw new CalendarProviderConfigurationError("Google did not return an account email address.");
  }

  return {
    googleAccountEmail,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}
