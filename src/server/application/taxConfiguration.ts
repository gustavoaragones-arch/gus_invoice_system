import type { AuthContext } from "@/server/auth/types";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { assertBusinessAccess } from "@/server/domain/businessAuthorization";
import {
  createTaxConfigurationVersion,
  listTaxConfigurationVersions,
  type CreateTaxConfigurationVersionInput,
  type TaxConfigurationLineInput,
} from "@/server/domain/taxConfigurationVersion";
import { ValidationError } from "@/server/domain/errors";

function parseDateOnly(value: string, fieldName: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new ValidationError(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError(`${fieldName} is not a valid calendar date.`);
  }

  return date;
}

export async function listTaxConfigurations(auth: AuthContext, businessId: string) {
  return withAuthorizedTransaction(auth, async (tx) => {
    const versions = await listTaxConfigurationVersions(tx, auth, businessId);
    return versions.map((version) => ({
      id: version.id,
      effectiveFrom: version.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: version.effectiveTo ? version.effectiveTo.toISOString().slice(0, 10) : null,
      isGstHstRegistered: version.isGstHstRegistered,
      taxLines: version.taxLines as unknown as TaxConfigurationLineInput[],
      isCurrent: version.effectiveTo === null,
      createdAt: version.createdAt,
    }));
  });
}

export async function createTaxConfigurationForBusiness(
  auth: AuthContext,
  businessId: string,
  input: Omit<CreateTaxConfigurationVersionInput, "businessId">,
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    await assertBusinessAccess(tx, auth, businessId);
    return createTaxConfigurationVersion(tx, auth, {
      businessId,
      effectiveFrom: input.effectiveFrom,
      isGstHstRegistered: input.isGstHstRegistered,
      taxLines: input.taxLines,
    });
  });
}

export function parseTaxConfigurationForm(input: {
  effectiveFrom: string;
  isGstHstRegistered: boolean;
  taxLines: TaxConfigurationLineInput[];
}) {
  return {
    effectiveFrom: parseDateOnly(input.effectiveFrom, "Effective date"),
    isGstHstRegistered: input.isGstHstRegistered,
    taxLines: input.taxLines,
  };
}
