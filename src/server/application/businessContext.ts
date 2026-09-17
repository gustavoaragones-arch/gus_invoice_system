import type { AuthContext } from "@/server/auth/types";
import { getSelectedBusinessId } from "@/server/auth/session";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { NotFoundError } from "@/server/domain/errors";

export async function listBusinesses(auth: AuthContext) {
  return withAuthorizedTransaction(auth, (tx) =>
    tx.business.findMany({ orderBy: { name: "asc" } }),
  );
}

export async function requireSelectedBusiness(auth: AuthContext) {
  let businessId = await getSelectedBusinessId();
  if (!businessId) {
    const businesses = await listBusinesses(auth);
    businessId = businesses[0]?.id ?? null;
  }
  if (!businessId) {
    throw new NotFoundError("No business selected.");
  }

  const business = await withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    return tx.business.findUniqueOrThrow({ where: { id: businessId } });
  });

  return business;
}
