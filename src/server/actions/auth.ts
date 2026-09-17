"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BUSINESS_COOKIE, SESSION_COOKIE, createSessionToken } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { ensureUserProvisioned } from "@/server/domain/userProvisioning";
import { ValidationError } from "@/server/domain/errors";
import { actionFailure } from "./errors";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return actionFailure(new ValidationError("Email is required."));

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    const auth = { userId: user.id, email: user.email };
    await withAuthorizedTransaction(auth, (tx) => ensureUserProvisioned(tx, auth));

    const token = await createSessionToken(auth.userId, auth.email);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    const next = String(formData.get("next") ?? "/overview");
    redirect(next.startsWith("/") ? next : "/overview");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(BUSINESS_COOKIE);
  redirect("/login");
}
