import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import { NotFoundError, ValidationError } from "@/server/domain/errors";
import { Decimal } from "@/server/domain/money";

export async function listServices(auth: AuthContext, businessId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    return tx.service.findMany({ where: { businessId }, orderBy: { description: "asc" } });
  });
}

export async function getService(auth: AuthContext, businessId: string, serviceId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const service = await tx.service.findFirst({ where: { id: serviceId, businessId } });
    if (!service) throw new NotFoundError("Service not found.");
    return service;
  });
}

export interface ServiceInput {
  description: string;
  unit: string;
  defaultRate: string;
  taxStatus?: "TAXABLE" | "ZERO_RATED" | "EXEMPT" | null;
  status?: "ACTIVE" | "INACTIVE";
}

export async function createService(auth: AuthContext, businessId: string, input: ServiceInput) {
  if (!input.description.trim()) throw new ValidationError("Service description is required.");
  if (!input.unit.trim()) throw new ValidationError("Service unit is required.");
  const rate = new Decimal(input.defaultRate);
  if (rate.isNegative()) throw new ValidationError("Default rate cannot be negative.");

  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    return tx.service.create({
      data: {
        businessId,
        description: input.description.trim(),
        unit: input.unit.trim(),
        defaultRate: rate.toFixed(2),
        taxStatus: input.taxStatus ?? null,
        status: input.status ?? "ACTIVE",
      },
    });
  });
}

export async function updateService(
  auth: AuthContext,
  businessId: string,
  serviceId: string,
  input: ServiceInput,
) {
  if (!input.description.trim()) throw new ValidationError("Service description is required.");
  if (!input.unit.trim()) throw new ValidationError("Service unit is required.");
  const rate = new Decimal(input.defaultRate);
  if (rate.isNegative()) throw new ValidationError("Default rate cannot be negative.");

  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    const existing = await tx.service.findFirst({ where: { id: serviceId, businessId } });
    if (!existing) throw new NotFoundError("Service not found.");
    return tx.service.update({
      where: { id: serviceId },
      data: {
        description: input.description.trim(),
        unit: input.unit.trim(),
        defaultRate: rate.toFixed(2),
        taxStatus: input.taxStatus ?? null,
        status: input.status ?? existing.status,
      },
    });
  });
}
