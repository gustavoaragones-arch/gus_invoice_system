"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import {
  createTaxConfigurationForBusiness,
  parseTaxConfigurationForm,
} from "@/server/application/taxConfiguration";
import type { TaxConfigurationLineInput } from "@/server/domain/taxConfigurationVersion";
import { actionFailure, actionSuccess } from "./errors";

function parseTaxLines(formData: FormData): TaxConfigurationLineInput[] {
  const raw = String(formData.get("taxLinesJson") ?? "[]");
  const parsed = JSON.parse(raw) as TaxConfigurationLineInput[];
  if (!Array.isArray(parsed)) {
    throw new Error("Tax lines must be an array.");
  }
  return parsed;
}

export async function createTaxConfigurationAction(formData: FormData) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const parsed = parseTaxConfigurationForm({
      effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
      isGstHstRegistered: formData.get("isGstHstRegistered") === "on",
      taxLines: parseTaxLines(formData),
    });

    const version = await createTaxConfigurationForBusiness(auth, business.id, parsed);
    revalidatePath("/business/tax");
    return actionSuccess(version);
  } catch (error) {
    return actionFailure(error);
  }
}
