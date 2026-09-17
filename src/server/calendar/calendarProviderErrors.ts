import { DomainError } from "@/server/domain/errors";

export class CalendarProviderAuthError extends DomainError {
  constructor(message = "Google Calendar authorization is no longer valid. Reconnect the calendar.") {
    super(message);
  }
}

export class CalendarProviderRateLimitError extends DomainError {
  constructor(message = "Google Calendar is temporarily rate limited. Try again later.") {
    super(message);
  }
}

export class CalendarProviderUnavailableError extends DomainError {
  constructor(message = "Google Calendar is temporarily unavailable. Try again later.") {
    super(message);
  }
}

export class CalendarProviderConfigurationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
