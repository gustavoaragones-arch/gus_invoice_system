# Phase 12B — Supabase asymmetric JWT verification (JWKS)

Baseline: `f02f1dc4407c96336c5ba2a0f403f8e052d31f90`. Status: implemented, pending Project Director review. No secret values appear in this document.

## Why
The Phase 11 verifier accepted HS256 tokens signed with `SUPABASE_JWT_SECRET`. The target Supabase project signs with ECC P-256 (ES256), so no real session token would have verified.

## Architecture after remediation
| Concern | Mechanism |
|---|---|
| Production session tokens (`AUTH_PROVIDER=supabase`) | ES256 verified against Supabase's public keys via `jose.createRemoteJWKSet` |
| Development sessions (`AUTH_PROVIDER=development`) | HS256 with `SUPABASE_JWT_SECRET` (development only; unreachable in supabase mode; provider refused in production) |
| Google OAuth `state` | HS256 with the dedicated `GOOGLE_OAUTH_STATE_SECRET` |
| Calendar credential encryption | `TOKEN_ENCRYPTION_KEY` (unchanged) |

One verifier (`verifySupabaseAccessToken`, `src/server/auth/supabaseAuth.ts`) serves middleware, server components/actions, API routes and post-sign-in verification.

## Supabase mode
- **JWKS URL** — built only from `SUPABASE_URL`: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. No other configuration or token header (`jku`, `jwk`) can supply keys or locations. HTTPS required (plain http only for loopback hosts outside production, for test servers); credentials, query, fragment or a path in `SUPABASE_URL` are rejected. Any problem fails closed as "authentication service unavailable".
- **Algorithms** — `["ES256"]` only (`SUPABASE_ACCEPTED_ALGORITHMS`). HS256, RS256, `none` and anything else are rejected on the header before any key is resolved; there is no HS256 or `/user`-endpoint fallback.
- **Claims** — issuer `${SUPABASE_URL}/auth/v1` (mandatory), audience `authenticated`, `exp` and `sub` required, subject must be a UUID; `exp`/`nbf` enforced by jose.
- **Keys/caching/rotation** — jose remote key set, cached 10 min per server instance. A token with an unknown `kid` triggers a refetch, at most once per 10 s, so a newly published key is used without a restart; `kid` matching is strict. Keys are never persisted.

## Failure classification
| Situation | Result |
|---|---|
| Bad signature, wrong/missing issuer or audience, expired, bad subject, unsupported algorithm, unknown `kid` (after refetch), malformed token | `AuthenticationError` → 401 |
| JWKS timeout, network/DNS failure, non-200, malformed JWKS, unusable key, missing/invalid `SUPABASE_URL` | `AuthProviderUnavailableError` → 503 |

Only an explicit allow-list of jose token-rejection codes maps to 401; every other failure is treated as availability. A warm key cache continues to verify through a temporary outage.

## Middleware
On an availability failure: API **and** page requests get 503 (`Retry-After`), the session cookie is **not** touched and there is no redirect to `/login`. Invalid/expired/forged tokens keep the previous behaviour (401 for `/api/*`, redirect and cookie clear for pages). Invalid tokens are still 401 during an outage because they are rejected before key retrieval. Public paths never call the verifier.

## Google OAuth state
`src/server/calendar/googleOAuth.ts` signs/verifies with `GOOGLE_OAUTH_STATE_SECRET` (HS256 pinned, ≥32 characters, otherwise a configuration error). It is not derived from and not falling back to `SUPABASE_JWT_SECRET` or `TOKEN_ENCRYPTION_KEY`, and is never sent to Google or exposed to client code.

## Configuration
- Production startup validation (`assertProductionConfiguration`): `SUPABASE_JWT_SECRET` **no longer required**; `GOOGLE_OAUTH_STATE_SECRET` **required**, ≥32 chars, and must differ from `TOKEN_ENCRYPTION_KEY`/`SUPABASE_JWT_SECRET`. All other required variables unchanged.
- `SUPABASE_ANON_KEY` keeps its name; its value may be the project's **publishable** key. Never put a service-role/secret key there.
- `SUPABASE_JWT_SECRET` is needed only by the development authentication path and can be removed from production environments.

## Operational notes / residual limits
- Sessions that were issued under the previous HS256 key cannot verify (by design); those users sign in again.
- A revoked signing key remains trusted until the per-instance cache refreshes (≤ 10 min).
- A token signed by a key published less than ~10 s ago may be rejected as 401 (refetch cooldown) and retried successfully afterwards.
- Verified only against locally generated ES256 keys and a stub JWKS server; **not yet exercised against the live Supabase project**.

## Tests
- `tests/unit/supabaseJwks.test.ts` (new, 38): valid ES256; wrong signature; tampered payload; wrong/missing issuer; wrong/missing audience; expired; bad subject; HS256 (incl. legacy-secret token) with no fetch; `alg=none`; RS256; unknown/mismatched `kid`; `jwk`/`jku` header injection; malformed tokens; key rotation and retirement; caching; JWKS 500 / malformed / timeout / unreachable → availability error; invalid tokens not 503 during outage; warm-cache resilience; URL construction and HTTPS rules; middleware outage (503, cookie kept, no redirect) vs invalid session (401/redirect/clear); production configuration.
- `tests/unit/googleOAuth.test.ts`: dedicated state secret, independence from other secrets, no fallback, forged state.
- `tests/unit/phase11Security.test.ts`: updated for the new configuration and HS256 rejection in supabase mode.
- All development-mode (HS256) tests and the integration/application suites are unchanged and pass.
