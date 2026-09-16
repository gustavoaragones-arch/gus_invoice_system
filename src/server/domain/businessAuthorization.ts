import type { AuthContext } from "@/server/auth/types";
import type { Tx } from "@/server/db/authorizedTransaction";
import { BusinessAuthorizationError } from "./errors";

/**
 * Primary (application-layer) business-authorization check
 * (Phase 2 §13 Section 3; SEC-API-002; INV-ISO-002). Every domain
 * operation that touches a specific Business's data must call this before
 * doing anything else — it must never trust a client-supplied businessId
 * by itself (Section 6 of the Phase 3 brief).
 *
 * This check is deliberately redundant with the RLS policies enforced by
 * withAuthorizedTransaction (defense-in-depth, SEC-ISO-004): even if this
 * function were accidentally skipped somewhere, RLS still blocks
 * cross-business access; even if RLS were somehow disabled, this function
 * still blocks it. Neither is allowed to be the sole safeguard.
 */
export async function assertBusinessAccess(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
): Promise<void> {
  const business = await tx.business.findFirst({
    where: { id: businessId, ownerUserId: auth.userId },
    select: { id: true },
  });

  if (!business) {
    // Deliberately identical error/message whether the business does not
    // exist or belongs to someone else — do not leak which.
    throw new BusinessAuthorizationError();
  }
}
