"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  BUSINESS_COOKIE,
  SESSION_COOKIE,
  cookieOptions,
  safeNextPath,
} from "@/server/auth/session";
import { signOutSupabaseSession } from "@/server/auth/supabaseGoTrue";
import { getAuthProviderMode } from "@/server/config/runtime";
import { loginWithCredentials } from "@/server/application/authentication";
import { actionFailure } from "./errors";

export async function loginAction(formData: FormData) {
  let destination: string;
  try {
    const result = await loginWithCredentials({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, result.sessionToken, cookieOptions(result.maxAgeSeconds));
    cookieStore.delete(BUSINESS_COOKIE);
    destination = safeNextPath(formData.get("next"));
  } catch (error) {
    return actionFailure(error);
  }
  redirect(destination);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token && getAuthProviderMode() === "supabase") {
    await signOutSupabaseSession(token);
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(BUSINESS_COOKIE);
  redirect("/login");
}
