import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import {
  createBusiness,
  updateBusiness,
  type BusinessProfileInput,
} from "@/server/domain/businessSettings";
import { NotFoundError } from "@/server/domain/errors";

export async function getBusinessProfile(auth: AuthContext, businessId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const business = await tx.business.findFirst({ where: { id: businessId } });
    if (!business) throw new NotFoundError("Business not found.");
    return business;
  });
}

export async function createBusinessForUser(auth: AuthContext, input: BusinessProfileInput) {
  return withAuthorizedTransaction(auth, (tx) => createBusiness(tx, auth, input));
}

export async function updateBusinessProfile(
  auth: AuthContext,
  businessId: string,
  input: BusinessProfileInput,
) {
  return withAuthorizedTransaction(auth, (tx) => updateBusiness(tx, auth, businessId, input));
}
