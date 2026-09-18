import { NextResponse } from "next/server";
import { AuthProviderUnavailableError } from "@/server/auth/supabaseGoTrue";
import { ProductionConfigurationError } from "@/server/config/runtime";
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
  if (error instanceof AuthProviderUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (isMalformedIdentifierError(error)) {
    return NextResponse.json({ error: "Invalid identifier." }, { status: 400 });
  }
  if (error instanceof ProductionConfigurationError) {
    logUnexpectedError(error);
    return NextResponse.json({ error: "Service is not available." }, { status: 503 });
  }
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

  logUnexpectedError(error);

  // Deliberately no error detail here — could be anything, including a
  // driver-level message that might reveal schema/internal structure.
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

/** Prisma P2023: a value (e.g. a non-UUID id) is malformed for its column. */
export function isMalformedIdentifierError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2023"
  );
}

/**
 * Server-side diagnostics for errors that are not safe to show. Production
 * logs only the error class and code — never the message, which for driver
 * errors can contain SQL, identifiers or connection details.
 */
function logUnexpectedError(error: unknown): void {
  const name = error instanceof Error ? error.name : "UnknownError";
  const code = (error as { code?: unknown } | null)?.code;
  if (process.env.NODE_ENV === "production") {
    console.error(`[error] ${name}${typeof code === "string" ? ` (${code})` : ""}`);
  } else {
    console.error("[error]", error);
  }
}
