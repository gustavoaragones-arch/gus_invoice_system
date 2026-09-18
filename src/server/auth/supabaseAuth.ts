import { jwtVerify } from "jose";
import { getAuthProviderMode } from "@/server/config/runtime";
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SupabaseAccessTokenClaims {
  sub: string;
  email?: string;
  [key: string]: unknown;
}

export async function verifySupabaseAccessToken(token: string): Promise<AuthContext> {
  try {
    // In "supabase" mode (mandatory in production) a token must be a real
    // Supabase Auth access token: audience "authenticated" and, when
    // SUPABASE_URL is configured, the matching issuer. Locally-minted
    // development tokens carry neither, so they are rejected there even
    // though they share the signing secret.
    const strict = getAuthProviderMode() === "supabase";
    const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");

    const { payload } = await jwtVerify<SupabaseAccessTokenClaims>(token, getJwtSecret(), {
      algorithms: ["HS256"],
      ...(strict ? { audience: "authenticated" } : {}),
      ...(strict && supabaseUrl ? { issuer: `${supabaseUrl}/auth/v1` } : {}),
    });

    if (!payload.sub) {
      throw new AuthenticationError("Token is missing a subject (user id) claim.");
    }
    if (!UUID_PATTERN.test(payload.sub)) {
      throw new AuthenticationError("Token subject is not a valid user id.");
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
