import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { getAuthProviderMode, isProduction } from "@/server/config/runtime";
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Cookie attributes for every authentication/context cookie: HttpOnly (never
 * readable by client script), SameSite=Lax, and Secure in production.
 */
export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction(),
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Only same-origin relative paths are valid post-login destinations. */
export function safeNextPath(value: unknown, fallback = "/overview"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

/**
 * Development-only: mints a local session token for the email-only
 * development sign-in. Refuses to run in any configuration where the
 * authentication provider is Supabase (which includes all of production).
 */
export async function createSessionToken(userId: string, email: string): Promise<string> {
  if (getAuthProviderMode() !== "development") {
    throw new AuthenticationError("Development sessions are not available with this authentication provider.");
  }
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
  const value = cookieStore.get(BUSINESS_COOKIE)?.value;
  // A malformed value is treated as "no selection"; a well-formed value is
  // always verified against the authenticated user by the caller.
  return value && isUuid(value) ? value : null;
}
