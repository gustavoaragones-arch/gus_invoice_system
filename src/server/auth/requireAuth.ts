import { extractBearerToken, verifySupabaseAccessToken } from "./supabaseAuth";
import type { AuthContext } from "./types";

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
  const token = extractBearerToken(request.headers.get("authorization"));
  return verifySupabaseAccessToken(token);
}
