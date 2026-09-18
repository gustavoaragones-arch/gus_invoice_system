import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";
import { assertBusinessAccess } from "./businessAuthorization";
import { recordAuditEvent } from "./audit";
import { ValidationError } from "./errors";
import { Decimal, hasAtMostDecimalPlaces, isNonNegative } from "./money";

export interface TaxConfigurationLineInput {
  taxAuthority: string;
  taxType: string;
  rate: string;
  appliesTo?: string | null;
}

export interface CreateTaxConfigurationVersionInput {
  businessId: string;
  effectiveFrom: Date;
  isGstHstRegistered: boolean;
  taxLines: TaxConfigurationLineInput[];
}

function parseDateOnlyUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function dayBeforeUtc(date: Date): Date {
  const normalized = parseDateOnlyUtc(date);
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), normalized.getUTCDate() - 1));
}

function normalizeTaxLines(lines: TaxConfigurationLineInput[]) {
  const normalized = lines
    .map((line) => ({
      taxAuthority: line.taxAuthority.trim(),
      taxType: line.taxType.trim(),
      rate: line.rate.trim(),
      appliesTo: line.appliesTo?.trim() || undefined,
    }))
    .filter((line) => line.taxAuthority || line.taxType || line.rate);

  if (normalized.length === 0) {
    throw new ValidationError("At least one tax line is required.");
  }

  for (const line of normalized) {
    if (!line.taxAuthority || !line.taxType || !line.rate) {
      throw new ValidationError("Each tax line requires tax authority, tax type, and rate.");
    }
    const rate = new Decimal(line.rate);
    if (!isNonNegative(rate)) {
      throw new ValidationError("Tax rates must be zero or greater.");
    }
    if (!hasAtMostDecimalPlaces(rate, 5)) {
      throw new ValidationError("Tax rates may have at most 5 decimal places.");
    }
  }

  return normalized;
}

export async function listTaxConfigurationVersions(tx: Tx, auth: AuthContext, businessId: string) {
  await assertBusinessAccess(tx, auth, businessId);
  return tx.taxConfigurationVersion.findMany({
    where: { businessId },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
}

export async function createTaxConfigurationVersion(
  tx: Tx,
  auth: AuthContext,
  input: CreateTaxConfigurationVersionInput,
) {
  await assertBusinessAccess(tx, auth, input.businessId);

  const effectiveFrom = parseDateOnlyUtc(input.effectiveFrom);
  const taxLines = normalizeTaxLines(input.taxLines);

  const currentVersion = await tx.taxConfigurationVersion.findFirst({
    where: { businessId: input.businessId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });

  if (currentVersion) {
    const currentFrom = parseDateOnlyUtc(currentVersion.effectiveFrom);
    if (effectiveFrom <= currentFrom) {
      throw new ValidationError("A new tax configuration version must start after the current version's effective date.");
    }

    const closingEffectiveTo = dayBeforeUtc(effectiveFrom);
    if (closingEffectiveTo < currentFrom) {
      throw new ValidationError("The new effective date leaves no valid period for the prior tax configuration version.");
    }

    await tx.taxConfigurationVersion.update({
      where: { id: currentVersion.id },
      data: { effectiveTo: closingEffectiveTo },
    });
  }

  const created = await tx.taxConfigurationVersion.create({
    data: {
      businessId: input.businessId,
      effectiveFrom,
      effectiveTo: null,
      isGstHstRegistered: input.isGstHstRegistered,
      taxLines: taxLines as unknown as object,
    },
  });

  await recordAuditEvent(tx, {
    businessId: input.businessId,
    eventType: "TAX_CONFIGURATION_CHANGED",
    actorUserId: auth.userId,
    entityType: "TaxConfigurationVersion",
    entityId: created.id,
    priorValues: currentVersion
      ? {
          taxConfigurationVersionId: currentVersion.id,
          effectiveFrom: currentVersion.effectiveFrom,
          effectiveTo: currentVersion.effectiveTo,
          isGstHstRegistered: currentVersion.isGstHstRegistered,
          taxLines: currentVersion.taxLines,
        }
      : undefined,
    newValues: {
      taxConfigurationVersionId: created.id,
      effectiveFrom: created.effectiveFrom,
      effectiveTo: created.effectiveTo,
      isGstHstRegistered: created.isGstHstRegistered,
      taxLines: created.taxLines,
    },
  });

  return created;
}
