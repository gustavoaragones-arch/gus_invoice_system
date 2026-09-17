import { cookies } from "next/headers";
import { extractBearerToken, verifySupabaseAccessToken } from "./supabaseAuth";
import { SESSION_COOKIE } from "./session";
import type { AuthContext } from "./types";
import { AuthenticationError } from "@/server/domain/errors";

/**
 * Standard entry point for every authenticated API route
 * (Section 24 of the Phase 3 brief: "Every server-side domain operation
 * must establish authenticated user + authorized business before
 * accessing business data"). This establishes the *authenticated user*
 * half; business authorization is a separate, per-business check made by
 * `assertBusinessAccess` inside the domain layer — a route handler must
 * never treat "has a valid token" as "may access business X."
 */
export async function requireAuthContext(request: Request): Promise<AuthContext> {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const token = extractBearerToken(authorization);
    return verifySupabaseAccessToken(token);
  }

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (cookieToken) {
    return verifySupabaseAccessToken(cookieToken);
  }

  throw new AuthenticationError("Missing or malformed Authorization header.");
}
