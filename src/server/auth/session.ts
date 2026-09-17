import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { AuthenticationError } from "@/server/domain/errors";
import { verifySupabaseAccessToken } from "./supabaseAuth";
import type { AuthContext } from "./types";

export const SESSION_COOKIE = "session_token";
export const BUSINESS_COOKIE = "selected_business_id";

function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not configured.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function getServerAuthContext(): Promise<AuthContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    throw new AuthenticationError("Not authenticated.");
  }
  return verifySupabaseAccessToken(token);
}

export async function getSelectedBusinessId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(BUSINESS_COOKIE)?.value ?? null;
}
