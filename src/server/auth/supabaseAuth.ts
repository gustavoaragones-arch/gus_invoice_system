import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from "jose";
import { getAuthProviderMode, isProduction, ProductionConfigurationError } from "@/server/config/runtime";
import { AuthenticationError } from "@/server/domain/errors";
import { AuthProviderUnavailableError } from "./supabaseGoTrue";
import type { AuthContext } from "./types";

/**
 * Session token verification — the single authority used by middleware,
 * server components/actions and API routes.
 *
 * AUTH_PROVIDER=supabase (mandatory in production):
 *   Supabase Auth access tokens are verified locally against the project's
 *   public signing keys, fetched from
 *   `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (jose remote JWKS: cached,
 *   refreshed on an unknown `kid`, so key rotation is followed
 *   automatically). Only ES256 is accepted; HS256, `none` and every other
 *   algorithm are rejected before any key is resolved. There is deliberately
 *   no shared-secret fallback. Issuer, audience, subject and expiry are all
 *   mandatory.
 *
 * AUTH_PROVIDER=development (never available in production):
 *   HS256 tokens minted locally by the development sign-in and signed with
 *   SUPABASE_JWT_SECRET. Unreachable from supabase mode.
 *
 * Failure classes are kept distinct (security-critical):
 *   - AuthenticationError            → the token is not acceptable (401)
 *   - AuthProviderUnavailableError   → the trusted key source/configuration
 *                                      is unavailable (503); the caller's
 *                                      session must NOT be treated as invalid.
 */

/** Accepted algorithms in supabase mode. Currently ES256 (ECC P-256) only. */
export const SUPABASE_ACCEPTED_ALGORITHMS = ["ES256"];

const SUPABASE_AUDIENCE = "authenticated";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID_TOKEN_MESSAGE = "Invalid or expired session token.";

/** jose codes that mean "this token is unacceptable", as opposed to "we could not obtain keys". */
const TOKEN_REJECTION_CODES = new Set<string>([
  errors.JWTExpired.code,
  errors.JWTClaimValidationFailed.code,
  errors.JWTInvalid.code,
  errors.JWSInvalid.code,
  errors.JWSSignatureVerificationFailed.code,
  errors.JOSEAlgNotAllowed.code,
  errors.JOSENotSupported.code,
  errors.JWKSNoMatchingKey.code,
  errors.JWKSMultipleMatchingKeys.code,
]);

interface KeySetOptions {
  cooldownDuration?: number;
  timeoutDuration?: number;
  cacheMaxAge?: number;
}

/**
 * jose remote key set behaviour: keys are cached for 10 minutes; a token whose
 * `kid` is not in the cache triggers a refetch, at most once per 10 seconds
 * (bounds refetch abuse while letting a newly published signing key be picked
 * up quickly); JWKS requests time out after 5 seconds.
 */
const DEFAULT_KEY_SET_OPTIONS: KeySetOptions = {
  cooldownDuration: 10_000,
  timeoutDuration: 5_000,
  cacheMaxAge: 600_000,
};

let keySetOptions: KeySetOptions = DEFAULT_KEY_SET_OPTIONS;
let keySetCache: { jwksUrl: string; keySet: ReturnType<typeof createRemoteJWKSet> } | null = null;

/**
 * Test-only: tune jose's JWKS refetch cooldown/timeout and drop the cached key
 * set. Refuses to run in production.
 */
export function configureSupabaseKeySetForTests(options: KeySetOptions = {}): void {
  if (isProduction()) {
    throw new Error("configureSupabaseKeySetForTests is not available in production.");
  }
  keySetOptions = { ...DEFAULT_KEY_SET_OPTIONS, ...options };
  keySetCache = null;
}

/**
 * Derives the trusted issuer and JWKS URL exclusively from SUPABASE_URL.
 * HTTPS is required; plain http is tolerated only for loopback hosts outside
 * production (local test servers). Any problem fails closed as "unavailable".
 */
export function getSupabaseTrustedEndpoints(): { issuer: string; jwksUrl: URL } {
  const configured = process.env.SUPABASE_URL?.trim();
  if (!configured) throw new AuthProviderUnavailableError();

  let base: URL;
  try {
    base = new URL(configured);
  } catch {
    throw new AuthProviderUnavailableError();
  }

  const loopback = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  const httpsOk = base.protocol === "https:";
  const loopbackHttpOk = base.protocol === "http:" && loopback && !isProduction();
  if (!httpsOk && !loopbackHttpOk) throw new AuthProviderUnavailableError();
  if (base.username || base.password || base.search || base.hash || base.pathname.replace(/\/+$/, "") !== "") {
    throw new AuthProviderUnavailableError();
  }

  return {
    issuer: `${base.origin}/auth/v1`,
    jwksUrl: new URL(`${base.origin}/auth/v1/.well-known/jwks.json`),
  };
}

function getSupabaseKeySet(jwksUrl: URL) {
  if (!keySetCache || keySetCache.jwksUrl !== jwksUrl.href) {
    keySetCache = { jwksUrl: jwksUrl.href, keySet: createRemoteJWKSet(jwksUrl, keySetOptions) };
  }
  return keySetCache.keySet;
}

async function verifyWithSupabaseJwks(token: string): Promise<JWTPayload> {
  const { issuer, jwksUrl } = getSupabaseTrustedEndpoints();
  try {
    const { payload } = await jwtVerify(token, getSupabaseKeySet(jwksUrl), {
      algorithms: [...SUPABASE_ACCEPTED_ALGORITHMS],
      issuer,
      audience: SUPABASE_AUDIENCE,
      requiredClaims: ["exp", "sub"],
    });
    return payload;
  } catch (error) {
    if (error instanceof errors.JOSEError && TOKEN_REJECTION_CODES.has(error.code)) {
      throw new AuthenticationError(INVALID_TOKEN_MESSAGE);
    }
    // Key retrieval/JWKS problems (timeout, network, non-200, malformed JWKS,
    // unusable key) — the token was not judged, so this is not a 401.
    throw new AuthProviderUnavailableError();
  }
}

function getDevelopmentSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not configured (development authentication only).");
  }
  return new TextEncoder().encode(secret);
}

async function verifyDevelopmentToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, getDevelopmentSecret(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    throw new AuthenticationError(INVALID_TOKEN_MESSAGE);
  }
}

export async function verifySupabaseAccessToken(token: string): Promise<AuthContext> {
  let mode: ReturnType<typeof getAuthProviderMode>;
  try {
    mode = getAuthProviderMode();
  } catch (error) {
    if (error instanceof ProductionConfigurationError) throw new AuthenticationError(INVALID_TOKEN_MESSAGE);
    throw error;
  }

  const payload = mode === "supabase" ? await verifyWithSupabaseJwks(token) : await verifyDevelopmentToken(token);

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
}

/** Extracts a Bearer token from a standard Authorization header value. */
export function extractBearerToken(authorizationHeader: string | null): string {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new AuthenticationError("Missing or malformed Authorization header.");
  }
  return authorizationHeader.slice("Bearer ".length).trim();
}
