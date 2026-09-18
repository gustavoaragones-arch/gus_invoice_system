import { isProduction } from "@/server/config/runtime";
import { CalendarProviderConfigurationError } from "./calendarProviderErrors";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getCalendarProviderMode(): "development" | "google" {
  const configured = process.env.CALENDAR_PROVIDER?.trim().toLowerCase();
  if (isProduction() && configured !== "google") {
    throw new CalendarProviderConfigurationError(
      'CALENDAR_PROVIDER must be explicitly set to "google" in production. The development calendar provider is not permitted.',
    );
  }
  if (!configured || configured === "development") {
    return "development";
  }
  if (configured === "google") {
    return "google";
  }
  throw new CalendarProviderConfigurationError(
    `Unsupported CALENDAR_PROVIDER value "${configured}". Use "development" or "google".`,
  );
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new CalendarProviderConfigurationError(
      "Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function assertGoogleCalendarConfigured(): void {
  if (getCalendarProviderMode() !== "google") {
    throw new CalendarProviderConfigurationError(
      "Google Calendar provider is not enabled. Set CALENDAR_PROVIDER=google.",
    );
  }
  getGoogleOAuthConfig();
}
