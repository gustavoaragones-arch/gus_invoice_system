import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { recordAuditEvent } from "./audit";
import { NotFoundError, ValidationError } from "./errors";
import { ensureUserProvisioned } from "./userProvisioning";

export interface BusinessProfileInput {
  name: string;
  legalName?: string | null;
  address?: string | null;
  gstHstRegistrationNumber?: string | null;
  brandingLogoRef?: string | null;
}

function normalizeOptional(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createBusiness(tx: Tx, auth: AuthContext, input: BusinessProfileInput) {
  await ensureUserProvisioned(tx, auth);

  const name = input.name.trim();
  if (!name) {
    throw new ValidationError("Business name is required.");
  }

  return tx.business.create({
    data: {
      ownerUserId: auth.userId,
      name,
      legalName: normalizeOptional(input.legalName),
      address: normalizeOptional(input.address),
      gstHstRegistrationNumber: normalizeOptional(input.gstHstRegistrationNumber),
      brandingLogoRef: normalizeOptional(input.brandingLogoRef),
    },
  });
}

export async function updateBusiness(
  tx: Tx,
  auth: AuthContext,
  businessId: string,
  input: BusinessProfileInput,
) {
  await assertBusinessAccess(tx, auth, businessId);

  const existing = await tx.business.findFirst({ where: { id: businessId } });
  if (!existing) throw new NotFoundError("Business not found.");

  const name = input.name.trim();
  if (!name) {
    throw new ValidationError("Business name is required.");
  }

  const updated = await tx.business.update({
    where: { id: businessId },
    data: {
      name,
      legalName: normalizeOptional(input.legalName),
      address: normalizeOptional(input.address),
      gstHstRegistrationNumber: normalizeOptional(input.gstHstRegistrationNumber),
      brandingLogoRef: normalizeOptional(input.brandingLogoRef),
    },
  });

  await recordAuditEvent(tx, {
    businessId,
    eventType: "BUSINESS_SETTINGS_CHANGED",
    actorUserId: auth.userId,
    entityType: "Business",
    entityId: businessId,
    priorValues: {
      name: existing.name,
      legalName: existing.legalName,
      address: existing.address,
      gstHstRegistrationNumber: existing.gstHstRegistrationNumber,
      brandingLogoRef: existing.brandingLogoRef,
    },
    newValues: {
      name: updated.name,
      legalName: updated.legalName,
      address: updated.address,
      gstHstRegistrationNumber: updated.gstHstRegistrationNumber,
      brandingLogoRef: updated.brandingLogoRef,
    },
  });

  return updated;
}
