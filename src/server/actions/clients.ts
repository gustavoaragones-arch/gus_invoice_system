"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { createClient, updateClient } from "@/server/application/clients";
import { actionFailure, actionSuccess } from "./errors";

export async function createClientAction(formData: FormData) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const client = await createClient(auth, business.id, {
      name: String(formData.get("name") ?? ""),
      billingAddress: String(formData.get("billingAddress") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
    });
    revalidatePath("/clients");
    return actionSuccess(client);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateClientAction(clientId: string, formData: FormData) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const client = await updateClient(auth, business.id, clientId, {
      name: String(formData.get("name") ?? ""),
      billingAddress: String(formData.get("billingAddress") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      status: String(formData.get("status") ?? "ACTIVE") as "ACTIVE" | "INACTIVE",
    });
    revalidatePath("/clients");
    revalidatePath(`/clients/${clientId}`);
    return actionSuccess(client);
  } catch (error) {
    return actionFailure(error);
  }
}
