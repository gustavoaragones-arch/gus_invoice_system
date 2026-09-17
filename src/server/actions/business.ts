"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { BUSINESS_COOKIE, getServerAuthContext } from "@/server/auth/session";
import { requireSelectedBusiness } from "@/server/application/businessContext";
import { createBusinessForUser, updateBusinessProfile } from "@/server/application/business";
import { actionFailure, actionSuccess } from "./errors";

function parseBusinessForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    legalName: String(formData.get("legalName") ?? ""),
    address: String(formData.get("address") ?? ""),
    gstHstRegistrationNumber: String(formData.get("gstHstRegistrationNumber") ?? ""),
    brandingLogoRef: String(formData.get("brandingLogoRef") ?? ""),
  };
}

export async function createBusinessAction(formData: FormData) {
  try {
    const auth = await getServerAuthContext();
    const business = await createBusinessForUser(auth, parseBusinessForm(formData));

    const cookieStore = await cookies();
    cookieStore.set(BUSINESS_COOKIE, business.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    revalidatePath("/business");
    return actionSuccess(business);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateBusinessAction(formData: FormData) {
  try {
    const auth = await getServerAuthContext();
    const business = await requireSelectedBusiness(auth);
    const updated = await updateBusinessProfile(auth, business.id, parseBusinessForm(formData));
    revalidatePath("/business");
    revalidatePath("/invoices");
    return actionSuccess(updated);
  } catch (error) {
    return actionFailure(error);
  }
}
