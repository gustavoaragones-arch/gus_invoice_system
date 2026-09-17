import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { NotFoundError, ValidationError } from "@/server/domain/errors";

export async function listClients(auth: AuthContext, businessId: string, search?: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    return tx.client.findMany({
      where: {
        businessId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { contactEmail: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
  });
}

export async function getClient(auth: AuthContext, businessId: string, clientId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const client = await tx.client.findFirst({ where: { id: clientId, businessId } });
    if (!client) throw new NotFoundError("Client not found.");
    return client;
  });
}

export interface ClientInput {
  name: string;
  billingAddress?: string;
  contactEmail?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export async function createClient(auth: AuthContext, businessId: string, input: ClientInput) {
  if (!input.name.trim()) throw new ValidationError("Client name is required.");
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    return tx.client.create({
      data: {
        businessId,
        name: input.name.trim(),
        billingAddress: input.billingAddress?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        status: input.status ?? "ACTIVE",
      },
    });
  });
}

export async function updateClient(
  auth: AuthContext,
  businessId: string,
  clientId: string,
  input: ClientInput,
) {
  if (!input.name.trim()) throw new ValidationError("Client name is required.");
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const existing = await tx.client.findFirst({ where: { id: clientId, businessId } });
    if (!existing) throw new NotFoundError("Client not found.");
    return tx.client.update({
      where: { id: clientId },
      data: {
        name: input.name.trim(),
        billingAddress: input.billingAddress?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        status: input.status ?? existing.status,
      },
    });
  });
}
