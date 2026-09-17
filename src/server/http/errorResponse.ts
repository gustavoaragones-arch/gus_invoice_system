import { NextResponse } from "next/server";
import {
  CalendarProviderAuthError,
  CalendarProviderConfigurationError,
  CalendarProviderRateLimitError,
  CalendarProviderUnavailableError,
} from "@/server/calendar/calendarProviderErrors";
import { EmailProviderConfigurationError } from "@/server/delivery/emailConfig";
import {
  AuthenticationError,
  BusinessAuthorizationError,
  InvalidStateError,
  NotFoundError,
  UnresolvedTaxApplicabilityError,
  ValidationError,
} from "@/server/domain/errors";

/**
 * Maps a domain error to an HTTP response. Centralized so every route
 * handler behaves consistently and so error messages never leak internal
 * details or cross-business information (SEC-ERR-001) — only the small,
 * deliberately-generic set of DomainError subclasses gets its message
 * echoed to the client; anything else becomes a flat 500 with no detail.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof BusinessAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (
    error instanceof ValidationError ||
    error instanceof CalendarProviderConfigurationError ||
    error instanceof EmailProviderConfigurationError
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof CalendarProviderAuthError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof CalendarProviderRateLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  if (error instanceof CalendarProviderUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof InvalidStateError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof UnresolvedTaxApplicabilityError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  // Deliberately no error detail here — could be anything, including a
  // driver-level message that might reveal schema/internal structure.
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}
