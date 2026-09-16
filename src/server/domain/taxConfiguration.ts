import type { Tx } from "@/server/db/authorizedTransaction";
import { Decimal } from "./money";
import type { ConfiguredTaxLine } from "./taxCalculation";
import { NoTaxConfigurationError } from "./errors";

/**
 * Resolves the TaxConfigurationVersion effective for a Business as of a
 * given date (Phase 2 §08 Section 4: "Invoices finalized during a
 * version's effective period use that version"). Never defaults to a
 * hard-coded rate or registration status when no configuration exists
 * (Section 16 of the Phase 3 brief) — an absent configuration is a hard
 * error, not silently treated as "no tax."
 */

interface StoredTaxLine {
  taxAuthority: string;
  taxType: string;
  rate: string;
  appliesTo?: string;
}

export interface EffectiveTaxConfiguration {
  taxConfigurationVersionId: string;
  isGstHstRegistered: boolean;
  taxLines: ConfiguredTaxLine[];
}

export async function resolveEffectiveTaxConfiguration(
  tx: Tx,
  businessId: string,
  asOfDate: Date,
): Promise<EffectiveTaxConfiguration> {
  const version = await tx.taxConfigurationVersion.findFirst({
    where: {
      businessId,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!version) {
    throw new NoTaxConfigurationError(businessId);
  }

  const storedLines = version.taxLines as unknown as StoredTaxLine[];

  return {
    taxConfigurationVersionId: version.id,
    isGstHstRegistered: version.isGstHstRegistered,
    taxLines: storedLines.map((line) => ({
      taxAuthority: line.taxAuthority,
      taxType: line.taxType,
      rate: new Decimal(line.rate),
    })),
  };
}
