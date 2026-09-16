import { jwtVerify } from "jose";
import { AuthenticationError } from "@/server/domain/errors";
import type { AuthContext } from "./types";

/**
 * Verifies a Supabase Auth session JWT server-side and extracts the
 * minimum identity needed to establish an AuthContext (Phase 0 SEC-AUTH-002;
 * Phase 2 §14 Section 1). Supabase issues HS256 JWTs signed with the
 * project's JWT secret; verifying locally avoids a network round-trip on
 * every request while remaining cryptographically equivalent to asking
 * Supabase "is this token valid".
 *
 * This module is real, load-bearing authentication logic — not a stub —
 * but it has not been exercised against a live Supabase project in this
 * environment (no Supabase project is provisioned here; see
 * docs/phase-3/README.md "What Was Not Connected"). It is unit-tested
 * against tokens signed with the same HS256 scheme Supabase uses.
 */

function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "SUPABASE_JWT_SECRET is not configured. Authentication cannot proceed without it.",
    );
  }
  return new TextEncoder().encode(secret);
}

interface SupabaseAccessTokenClaims {
  sub: string;
  email?: string;
  [key: string]: unknown;
}

export async function verifySupabaseAccessToken(token: string): Promise<AuthContext> {
  try {
    const { payload } = await jwtVerify<SupabaseAccessTokenClaims>(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });

    if (!payload.sub) {
      throw new AuthenticationError("Token is missing a subject (user id) claim.");
    }

    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
    };
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError("Invalid or expired session token.");
  }
}

/** Extracts a Bearer token from a standard Authorization header value. */
export function extractBearerToken(authorizationHeader: string | null): string {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new AuthenticationError("Missing or malformed Authorization header.");
  }
  return authorizationHeader.slice("Bearer ".length).trim();
}
