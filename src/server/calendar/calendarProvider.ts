import type { CalendarProvider } from "./types";
import { DevelopmentCalendarProvider } from "./developmentCalendarProvider";
import { GoogleCalendarProvider } from "./googleCalendarProvider";
import { getCalendarProviderMode } from "./googleCalendarConfig";
import { CalendarProviderConfigurationError } from "./calendarProviderErrors";

let developmentProvider: CalendarProvider | null = null;
let googleProvider: CalendarProvider | null = null;

export function getCalendarProvider(): CalendarProvider {
  const mode = getCalendarProviderMode();
  if (mode === "development") {
    if (!developmentProvider) {
      developmentProvider = new DevelopmentCalendarProvider();
    }
    return developmentProvider;
  }

  if (!googleProvider) {
    googleProvider = new GoogleCalendarProvider();
  }
  return googleProvider;
}

export function resetCalendarProvidersForTests(): void {
  developmentProvider = null;
  googleProvider = null;
}

export function requireDevelopmentCalendarProvider(): CalendarProvider {
  if (getCalendarProviderMode() !== "development") {
    throw new CalendarProviderConfigurationError(
      "Direct development calendar connection is only available when CALENDAR_PROVIDER=development.",
    );
  }
  return getCalendarProvider();
}
