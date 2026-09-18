# Phase 11 — Production Authentication, Security & Operational Hardening

Status: Implemented, pending Project Director review
Baseline: Phase 10 commit `cf4a54cf582d88725dea9bc4c5823fe062e9cb83`

Phase 11 changes authentication, authorization hardening, configuration and HTTP security only. No accounting rule, calculation, lifecycle, reporting definition, Calendar boundary, Prisma schema or migration was changed.

## 1. Objective

Make the application safe to run in production: real identity via Supabase Auth, no development authentication reachable in production, verified sessions, explicit provider selection, fail-closed configuration, and preserved application + database (RLS) business isolation.

## 2. Existing authentication architecture (audit result)

- Session = an HS256 JWT in the `session_token` cookie (HttpOnly, SameSite=Lax, Secure in production), verified with `SUPABASE_JWT_SECRET` (`src/server/auth/supabaseAuth.ts`, `session.ts`). API routes also accepted a Bearer header.
- **Sign-in was email-only with no password** (`loginAction`, `/api/auth/login`): any email address obtained a 7-day session and auto-created a user. The session token was minted locally, not by Supabase. This was the development-only behaviour and was active regardless of environment.
- The middleware only checked that a cookie *existed*; it did not verify it.
- Logout deleted cookies only.
- Post-login redirect accepted `//host` style values (open redirect).
- No production/development provider separation: `EMAIL_PROVIDER` / `CALENDAR_PROVIDER` silently defaulted to `development` when unset.
- No startup validation; `NEXT_PUBLIC_APP_URL` fell back to `http://localhost:3000`.

## 3. Existing authorization architecture (audit result)

- `assertBusinessAccess` (owner check) and `withAuthorizedTransaction` (sets `app.user_id` for RLS) from Phase 3, used by all domain functions.
- The selected business is a cookie (`selected_business_id`), verified on every request by `requireSelectedBusiness` → `assertBusinessAccess`. `businessId` is never taken from a form/body as authority; server actions and routes derive it from the cookie and verify it.
- Audit found application-layer wrappers (`saveDraftLineItems`, `finalizeInvoiceForBusiness`, `voidInvoiceForBusiness`, `createReplacementDraftForBusiness`, `sendInvoiceForBusiness`, `recordPaymentForBusiness`, Work-candidate edit/reject/create-draft) that scoped queries by `businessId` and relied on RLS plus the downstream domain check, without an explicit business check of their own. No cross-business path was found (every path was still blocked by RLS and the domain-level owner check), but the explicit check was added for defence in depth.

## 4. Existing business-isolation architecture

Unchanged: RLS on every business-owned table, FORCE RLS, non-superuser `app_runtime` role, `app.user_id` set per transaction, default-deny. Phase 11 adds tests proving it (section 10).

## 5. Existing production limitations (before Phase 11)

Email-only sign-in; unverified cookie in middleware; dev tokens valid anywhere the secret is shared; silent development-provider fallbacks; no config validation; no security headers; malformed identifiers surfaced as generic 500s; open redirect after login.

## 6. Phase 11 implementation scope

- **Production authentication** — Supabase Auth (email + password) via `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` (`src/server/auth/supabaseGoTrue.ts`, `src/server/application/authentication.ts`). The Supabase access token itself becomes the session cookie; no password is stored, logged or forwarded anywhere except Supabase. No OAuth provider, no custom password system, no second session system.
- **Explicit provider selection** — `AUTH_PROVIDER` (`supabase` | `development`), `EMAIL_PROVIDER`, `CALENDAR_PROVIDER`. In production each must be explicitly `supabase` / `smtp` / `google`; missing or `development` fails closed (`src/server/config/runtime.ts`, `emailConfig.ts`, `googleCalendarConfig.ts`).
- **Strict token verification in supabase mode** — audience `authenticated`, issuer `{SUPABASE_URL}/auth/v1`, UUID subject. Locally-minted development tokens are rejected in that mode even though they share the signing secret; `createSessionToken` refuses to run outside development mode.
- **Middleware** cryptographically verifies the session (cookie or Bearer). Unauthenticated pages → redirect `/login`; unauthenticated `/api/*` → 401 JSON. Invalid cookies are cleared. Handlers/actions still authenticate independently.
- **Logout** deletes the session and business cookies and, in supabase mode, revokes the Supabase session server-side (best-effort).
- **Startup validation** (`src/instrumentation.ts` → `assertProductionConfiguration`): production refuses to start on missing/invalid configuration; the error names variables, never values.
- **Explicit business checks** added to the wrappers listed in section 3.
- **Input hardening** — UUID validation on the PDF route id and on the selected-business cookie (malformed value ignored); Prisma `P2023` (malformed id) → controlled 400; login body validated (zod); `safeNextPath` blocks open redirects.
- **Error handling** — unexpected errors return a flat generic body; production logs record only error class/code, not messages (driver messages can contain SQL/identifiers); configuration errors return 503 with no variable names.
- **Security headers** (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS (production), `X-Powered-By` removed, and a CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action 'self'`, same-origin `connect-src`). Compatibility: Supabase Auth and SMTP are called server-side only; Google OAuth is a top-level redirect; PDFs open in a new tab. The CSP is deliberately not applied to `/api/*` so the PDF viewer keeps working; those responses still get all other headers.

## 7. Explicitly out of scope

MFA, social/OAuth login, self-registration (users are created in Supabase), password reset UI, refresh-token rotation, external rate-limit service, session store, any accounting/schema change, Calendar/email feature changes.

## 8. Security decisions

1. Supabase Auth is the only production identity provider; the development provider cannot be selected in production (fail closed, tested).
2. The session cookie holds the Supabase access token; **no refresh token is stored**. Session length = Supabase JWT expiry (configure in the Supabase project); users sign in again afterwards. Chosen to avoid persisting long-lived credentials.
3. Bearer-header authentication is retained for API clients, subject to the same verification.
4. Authentication events (sign-in/out) are **not** written to `AuditEvent`: that model requires a `businessId` and records business-scoped financial/approval actions. Supabase Auth keeps its own auth logs. Business-scoped security-relevant actions (finalize, void, delivery attempt, payment record/reverse, tax configuration change, business settings change, Calendar connection change, WorkCandidate review) already use the existing AuditEvent model and are unchanged.
5. No rate limiter was built: a provider-independent one is not robust on serverless without shared state, and adding shared infrastructure is out of scope. Mitigations: password sign-in is rate-limited by Supabase Auth; invoice sending requires authentication, business authorization and a Finalized invoice, and every attempt is recorded (`InvoiceSendAttempt` + audit event).
6. No schema change was necessary.

## 9. Environment / configuration

See `.env.example` (production-required vs development/test-only sections). Required in production: `AUTH_PROVIDER=supabase`, `EMAIL_PROVIDER=smtp`, `CALENDAR_PROVIDER=google`, `DATABASE_URL` (non-superuser `app_runtime` role), `SUPABASE_URL` (https), `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `TOKEN_ENCRYPTION_KEY` (32 bytes base64), `NEXT_PUBLIC_APP_URL` (https), `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM`. Only `NEXT_PUBLIC_APP_URL` is client-visible (a public URL); everything else is server-only. `SUPABASE_ANON_KEY` is added by this phase (server-only name). `DIRECT_URL` is only for `prisma migrate` and is not needed at runtime. `.env` is git-ignored; no real credentials exist in the repository.

## 10. Test strategy

- `tests/unit/phase11Security.test.ts` (22): provider fail-closed rules, strict token verification, Supabase sign-in client (mocked fetch), config validation (names only, no values), middleware, redirect/UUID hardening, error-response leak checks, security headers.
- `tests/application/phase11Security.test.ts` (16, real Postgres with RLS): application-layer cross-business attempts (clients, services, business profile, invoices, PDF, send, void, payments record/reverse, tax configuration, Calendar workspace/WorkCandidates/sync, reports, tampered business cookie) with side-effect verification; RLS-only tests with application checks bypassed (unfiltered reads across 12 tables, cross-business writes rejected, deny-by-default without a user); real route handlers (PDF, businesses, business select, login) for authentication, ID swapping, forced business selection, malformed ids, no-leak bodies, and no development fallback in production; audit coverage.
- Runtime check (manual, recorded in the implementation report): production start with no configuration fails; with valid configuration headers, 401/redirect behaviour and forged-dev-token rejection were confirmed with `next start`.

## 11. Known limitations remaining

- Not exercised against a live Supabase project (none provisioned here); the sign-in client is unit-tested against the documented GoTrue contract only. First live integration must confirm `SUPABASE_JWT_SECRET` (HS256) and the issuer value for that project.
- Access tokens are stateless: logout revokes the Supabase session but an already-issued token stays valid until expiry.
- No rate limiting / lockout beyond Supabase Auth's own; no CAPTCHA; no MFA.
- CSP allows `'unsafe-inline'` scripts/styles (Next.js inline bootstrap); a nonce-based CSP needs dynamic rendering of all pages and is a later architecture change.
- Failed startup validation is reported by Next.js as an instrumentation error; the process may keep answering 500 rather than exiting, so deployment health checks should treat that as unhealthy.
- A local `app_user` row with the same email but a different id than the Supabase user would violate the email unique constraint on first sign-in (relevant only if development users existed in the production database).
- The Google OAuth `state` is still signed with `SUPABASE_JWT_SECRET` (pre-existing).
- Production `DATABASE_URL` role privileges cannot be verified by the application; deployment must use the `app_runtime`-style role.

## 12. Acceptance criteria mapping

Provider explicit/fail-closed, no dev fallback, protected routes, mandatory server-side authorization, app + RLS isolation, PDF/delivery/payments/Calendar/reports isolation, safe errors, fail-safe configuration, security headers, no accounting or schema change, all Phase 0–10 tests still passing — see the implementation report for the recorded results.
