import type { CalendarProvider } from "./types";
import { DevelopmentCalendarProvider } from "./developmentCalendarProvider";

let provider: CalendarProvider | null = null;

export function getCalendarProvider(): CalendarProvider {
  if (provider) return provider;

  const configured = process.env.CALENDAR_PROVIDER?.trim().toLowerCase();
  if (configured && configured !== "development") {
    throw new Error(
      "Production Google Calendar integration is not configured in this environment. Set CALENDAR_PROVIDER=development for local/test use.",
    );
  }

  provider = new DevelopmentCalendarProvider();
  return provider;
}
