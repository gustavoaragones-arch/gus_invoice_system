/**
 * Domain error taxonomy. API route handlers map these to HTTP responses;
 * error messages here must never leak internal details or cross-business
 * data (SEC-ERR-001).
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** No authenticated user, or the provided credential is invalid/expired. */
export class AuthenticationError extends DomainError {}

/**
 * The authenticated user is not authorized for the requested Business.
 * Deliberately generic — never reveals whether the businessId exists at
 * all, to avoid leaking cross-business information (SEC-ERR-001).
 */
export class BusinessAuthorizationError extends DomainError {
  constructor() {
    super("Not authorized for the requested business.");
  }
}

export class NotFoundError extends DomainError {}

/** An operation was attempted from a state that does not permit it
 * (e.g., finalizing an already-Finalized invoice) — INV-LIFE-003/004. */
export class InvalidStateError extends DomainError {}

export class ValidationError extends DomainError {}

/** No effective TaxConfigurationVersion exists for the business as of the
 * relevant date — finalization must not proceed by silently assuming a
 * tax treatment (Phase 0 §04; Section 16 of the Phase 3 brief). */
export class NoTaxConfigurationError extends DomainError {
  constructor(businessId: string) {
    super(
      `No effective tax configuration exists for business ${businessId}. ` +
        "Tax treatment must be explicitly configured before an invoice can be finalized.",
    );
  }
}

/** The business tax configuration defines more than one tax group, but the
 * approved Phase 1/2 data model does not specify which tax groups apply
 * to which invoice lines. Finalization must not proceed by silently
 * choosing a tax-applicability interpretation. */
export class UnresolvedTaxApplicabilityError extends DomainError {
  constructor() {
    super(
      "Cannot calculate tax: the business tax configuration defines multiple tax groups, " +
        "but the approved data model does not specify which tax groups apply to which invoice lines. " +
        "Project Director / professional tax review is required before mixed tax-group applicability can be determined.",
    );
  }
}
