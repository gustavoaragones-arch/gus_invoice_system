import { AuthProviderUnavailableError } from "@/server/auth/supabaseGoTrue";
import { isMalformedIdentifierError } from "@/server/http/errorResponse";
import {
  AuthenticationError,
  BusinessAuthorizationError,
  DomainError,
  InvalidStateError,
  NotFoundError,
  UnresolvedTaxApplicabilityError,
  ValidationError,
} from "@/server/domain/errors";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function toActionError(error: unknown): string {
  if (isMalformedIdentifierError(error)) {
    return "Invalid identifier.";
  }
  if (error instanceof UnresolvedTaxApplicabilityError) {
    return error.message;
  }
  if (
    error instanceof ValidationError ||
    error instanceof InvalidStateError ||
    error instanceof NotFoundError ||
    error instanceof AuthenticationError ||
    error instanceof BusinessAuthorizationError ||
    error instanceof DomainError
  ) {
    return error.message;
  }
  if (error instanceof AuthProviderUnavailableError) {
    return error.message;
  }
  return "An unexpected error occurred. Please try again.";
}

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFailure(error: unknown): ActionResult<never> {
  return { ok: false, error: toActionError(error) };
}
