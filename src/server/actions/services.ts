"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { createService, updateService } from "@/server/application/services";
import { actionFailure, actionSuccess } from "./errors";

export async function createServiceAction(formData: FormData) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const service = await createService(auth, business.id, {
      description: String(formData.get("description") ?? ""),
      unit: String(formData.get("unit") ?? ""),
      defaultRate: String(formData.get("defaultRate") ?? "0"),
      taxStatus: (String(formData.get("taxStatus") ?? "") || null) as "TAXABLE" | "ZERO_RATED" | "EXEMPT" | null,
      status: String(formData.get("status") ?? "ACTIVE") as "ACTIVE" | "INACTIVE",
    });
    revalidatePath("/services");
    return actionSuccess(service);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateServiceAction(serviceId: string, formData: FormData) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const service = await updateService(auth, business.id, serviceId, {
      description: String(formData.get("description") ?? ""),
      unit: String(formData.get("unit") ?? ""),
      defaultRate: String(formData.get("defaultRate") ?? "0"),
      taxStatus: (String(formData.get("taxStatus") ?? "") || null) as "TAXABLE" | "ZERO_RATED" | "EXEMPT" | null,
      status: String(formData.get("status") ?? "ACTIVE") as "ACTIVE" | "INACTIVE",
    });
    revalidatePath("/services");
    revalidatePath(`/services/${serviceId}`);
    return actionSuccess(service);
  } catch (error) {
    return actionFailure(error);
  }
}
