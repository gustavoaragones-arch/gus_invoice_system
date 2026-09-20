import http from "node:http";
import type { AddressInfo } from "node:net";
import { SignJWT, exportJWK, generateKeyPair, type JWK, type KeyLike } from "jose";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";
import { SESSION_COOKIE } from "@/server/auth/session";
import {
  SUPABASE_ACCEPTED_ALGORITHMS,
  configureSupabaseKeySetForTests,
  getSupabaseTrustedEndpoints,
  verifySupabaseAccessToken,
} from "@/server/auth/supabaseAuth";
import { AuthProviderUnavailableError } from "@/server/auth/supabaseGoTrue";
import { ProductionConfigurationError, assertProductionConfiguration } from "@/server/config/runtime";
import { AuthenticationError } from "@/server/domain/errors";
import { toErrorResponse } from "@/server/http/errorResponse";

const USER_ID = "44444444-4444-4444-4444-444444444444";
const LEGACY_SHARED_SECRET = "legacy-hs256-shared-secret-that-must-never-verify-0123456789";

interface StubState {
  mode: "ok" | "status500" | "malformed" | "hang";
  keys: JWK[];
  hits: number;
}

const state: StubState = { mode: "ok", keys: [], hits: 0 };
let server: http.Server;
let baseUrl: string;

function startServer(): Promise<http.Server> {
  const instance = http.createServer((req, res) => {
    if (req.url !== "/auth/v1/.well-known/jwks.json") {
      res.statusCode = 404;
      res.end();
      return;
    }
    state.hits += 1;
    if (state.mode === "hang") return; // never answers → client timeout
    if (state.mode === "status500") {
      res.statusCode = 500;
      res.end("boom");
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(state.mode === "malformed" ? '{"keys":"not-an-array"}' : JSON.stringify({ keys: state.keys }));
  });
  return new Promise((resolve) => instance.listen(0, "127.0.0.1", () => resolve(instance)));
}

interface TestKey {
  privateKey: KeyLike;
  jwk: JWK;
  kid: string;
}

async function makeKey(kid: string): Promise<TestKey> {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "ES256", use: "sig" };
  return { privateKey, jwk, kid };
}

async function signEs256(
  key: TestKey,
  options: {
    kid?: string;
    sub?: string | null;
    iss?: string | null;
    aud?: string | null;
    exp?: string | number;
    extraHeader?: Record<string, unknown>;
  } = {},
) {
  const jwt = new SignJWT({ email: "user@example.test" })
    .setProtectedHeader({ alg: "ES256", kid: options.kid ?? key.kid, ...(options.extraHeader ?? {}) })
    .setIssuedAt()
    .setExpirationTime(options.exp ?? "1h");
  if (options.sub !== null) jwt.setSubject(options.sub ?? USER_ID);
  if (options.iss !== null) jwt.setIssuer(options.iss ?? `${baseUrl}/auth/v1`);
  if (options.aud !== null) jwt.setAudience(options.aud ?? "authenticated");
  return jwt.sign(key.privateKey);
}

let keyA: TestKey;
let keyB: TestKey;

beforeAll(async () => {
  server = await startServer();
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  keyA = await makeKey("key-a");
  keyB = await makeKey("key-b");
});

afterAll(() => {
  server.closeAllConnections?.();
  server.close();
});

beforeEach(() => {
  state.mode = "ok";
  state.keys = [keyA.jwk];
  state.hits = 0;
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_PROVIDER", "supabase");
  vi.stubEnv("SUPABASE_URL", baseUrl);
  vi.stubEnv("SUPABASE_JWT_SECRET", ""); // production does not need it; prove supabase mode never reads it
  configureSupabaseKeySetForTests({ cooldownDuration: 0, timeoutDuration: 400 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function expectAuthFailure(token: string) {
  await expect(verifySupabaseAccessToken(token)).rejects.toBeInstanceOf(AuthenticationError);
}

describe("Supabase ES256 verification via JWKS", () => {
  it("accepts only ES256 by configuration", () => {
    expect(SUPABASE_ACCEPTED_ALGORITHMS).toEqual(["ES256"]);
  });

  it("A. accepts a valid ES256 token and returns the identity", async () => {
    const token = await signEs256(keyA);
    await expect(verifySupabaseAccessToken(token)).resolves.toEqual({ userId: USER_ID, email: "user@example.test" });
  });

  it("B. rejects a token with a wrong signature (attacker key, same kid)", async () => {
    const attacker = await makeKey("key-a");
    await expectAuthFailure(await signEs256(attacker));
  });

  it("B2. rejects a tampered payload", async () => {
    const token = await signEs256(keyA);
    const [h, , s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "55555555-5555-5555-5555-555555555555", aud: "authenticated", iss: `${baseUrl}/auth/v1`, exp: 9999999999 })).toString("base64url");
    await expectAuthFailure(`${h}.${forgedPayload}.${s}`);
  });

  it("C. rejects a wrong issuer and a missing issuer (issuer is mandatory)", async () => {
    await expectAuthFailure(await signEs256(keyA, { iss: "https://evil.example/auth/v1" }));
    await expectAuthFailure(await signEs256(keyA, { iss: null }));
  });

  it("D. rejects a wrong or missing audience", async () => {
    await expectAuthFailure(await signEs256(keyA, { aud: "anon" }));
    await expectAuthFailure(await signEs256(keyA, { aud: null }));
  });

  it("E. rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expectAuthFailure(await signEs256(keyA, { exp: now - 60 }));
  });

  it("F. rejects a missing or non-UUID subject", async () => {
    await expectAuthFailure(await signEs256(keyA, { sub: null }));
    await expectAuthFailure(await signEs256(keyA, { sub: "not-a-uuid" }));
  });

  it("G. rejects HS256 — including a token signed with the old shared secret — with no fallback", async () => {
    const legacy = await new SignJWT({ email: "user@example.test" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setIssuer(`${baseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(LEGACY_SHARED_SECRET));
    // even when the legacy secret is present in the environment
    vi.stubEnv("SUPABASE_JWT_SECRET", LEGACY_SHARED_SECRET);
    await expectAuthFailure(legacy);
    // rejected on algorithm before any key is resolved: no JWKS fetch at all
    expect(state.hits).toBe(0);
  });

  it("H. rejects alg=none (unsigned) tokens", async () => {
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const unsigned = `${enc({ alg: "none", typ: "JWT" })}.${enc({
      sub: USER_ID,
      aud: "authenticated",
      iss: `${baseUrl}/auth/v1`,
      exp: 9999999999,
    })}.`;
    await expectAuthFailure(unsigned);
    expect(state.hits).toBe(0);
  });

  it("H2. rejects other algorithms (RS256) not on the pinned list", async () => {
    const { privateKey } = await generateKeyPair("RS256");
    const rs = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "key-a" })
      .setSubject(USER_ID)
      .setIssuer(`${baseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(privateKey);
    await expectAuthFailure(rs);
    expect(state.hits).toBe(0);
  });

  it("I. rejects an unknown kid (401, not 503)", async () => {
    await expectAuthFailure(await signEs256(keyA, { kid: "no-such-key" }));
  });

  it("I2. never trusts key material or locations supplied inside the token (jwk / jku headers)", async () => {
    const attacker = await makeKey("key-a");
    await expectAuthFailure(
      await signEs256(attacker, { extraHeader: { jwk: attacker.jwk, jku: "http://evil.example/jwks.json" } }),
    );
  });

  it("rejects malformed tokens", async () => {
    for (const bad of ["", "garbage", "a.b", "a.b.c", "....", "Bearer x"]) {
      await expectAuthFailure(bad);
    }
  });

  it("J. follows key rotation: a newly published key verifies without restart", async () => {
    const tokenA = await signEs256(keyA);
    await expect(verifySupabaseAccessToken(tokenA)).resolves.toMatchObject({ userId: USER_ID });

    state.keys = [keyA.jwk, keyB.jwk]; // Supabase publishes key B
    const tokenB = await signEs256(keyB);
    await expect(verifySupabaseAccessToken(tokenB)).resolves.toMatchObject({ userId: USER_ID });
    // key A tokens still verify while A remains published
    await expect(verifySupabaseAccessToken(tokenA)).resolves.toMatchObject({ userId: USER_ID });

    // a retired key stops verifying once it leaves the set and the cache refreshes
    state.keys = [keyB.jwk];
    configureSupabaseKeySetForTests({ cooldownDuration: 0, timeoutDuration: 400 });
    await expectAuthFailure(tokenA);
    await expect(verifySupabaseAccessToken(tokenB)).resolves.toMatchObject({ userId: USER_ID });
  });

  it("does not accept a token whose kid resolves to a different key (no kid loosening)", async () => {
    state.keys = [keyA.jwk, keyB.jwk];
    await expectAuthFailure(await signEs256(keyB, { kid: "key-a" })); // signed by B, claims A's kid
  });

  it("caches keys: repeated verification does not refetch the JWKS", async () => {
    const token = await signEs256(keyA);
    await verifySupabaseAccessToken(token);
    await verifySupabaseAccessToken(token);
    await verifySupabaseAccessToken(token);
    expect(state.hits).toBe(1);
  });
});

describe("JWKS infrastructure failures are availability errors, never authentication failures", () => {
  it("K. JWKS returns 500 → AuthProviderUnavailableError", async () => {
    state.mode = "status500";
    await expect(verifySupabaseAccessToken(await signEs256(keyA))).rejects.toBeInstanceOf(AuthProviderUnavailableError);
  });

  it("K. malformed JWKS → AuthProviderUnavailableError", async () => {
    state.mode = "malformed";
    await expect(verifySupabaseAccessToken(await signEs256(keyA))).rejects.toBeInstanceOf(AuthProviderUnavailableError);
  });

  it("K. JWKS timeout → AuthProviderUnavailableError", async () => {
    state.mode = "hang";
    await expect(verifySupabaseAccessToken(await signEs256(keyA))).rejects.toBeInstanceOf(AuthProviderUnavailableError);
  });

  it("K. JWKS host unreachable → AuthProviderUnavailableError", async () => {
    const dead = await startServer();
    const port = (dead.address() as AddressInfo).port;
    dead.closeAllConnections?.();
    await new Promise((resolve) => dead.close(resolve));
    vi.stubEnv("SUPABASE_URL", `http://127.0.0.1:${port}`);
    configureSupabaseKeySetForTests({ cooldownDuration: 0, timeoutDuration: 400 });
    const token = await signEs256(keyA, { iss: `http://127.0.0.1:${port}/auth/v1` });
    await expect(verifySupabaseAccessToken(token)).rejects.toBeInstanceOf(AuthProviderUnavailableError);
  });

  it("missing or unusable SUPABASE_URL fails closed as unavailable", async () => {
    const token = await signEs256(keyA);
    for (const value of ["", "not a url", "ftp://x.example", "https://user:pw@x.example", "https://x.example/some/path"]) {
      vi.stubEnv("SUPABASE_URL", value);
      await expect(verifySupabaseAccessToken(token)).rejects.toBeInstanceOf(AuthProviderUnavailableError);
    }
  });

  it("invalid tokens stay 401-class even while the JWKS provider is down", async () => {
    state.mode = "status500";
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const hs = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(USER_ID).setExpirationTime("1h").sign(new TextEncoder().encode(LEGACY_SHARED_SECRET));
    for (const bad of ["garbage", "a.b.c", hs, `${enc({ alg: "none" })}.${enc({ sub: USER_ID })}.`]) {
      await expectAuthFailure(bad);
    }
  });

  it("a warm key cache keeps verifying through a temporary JWKS outage", async () => {
    const token = await signEs256(keyA);
    await verifySupabaseAccessToken(token);
    state.mode = "status500";
    await expect(verifySupabaseAccessToken(token)).resolves.toMatchObject({ userId: USER_ID });
  });

  it("an unavailable provider maps to HTTP 503 with a generic body", async () => {
    const response = toErrorResponse(new AuthProviderUnavailableError());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "The authentication service is unavailable." });
  });
});

describe("JWKS URL construction", () => {
  it("derives issuer and JWKS URL exclusively from SUPABASE_URL", () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co/");
    const { issuer, jwksUrl } = getSupabaseTrustedEndpoints();
    expect(issuer).toBe("https://project.supabase.co/auth/v1");
    expect(jwksUrl.href).toBe("https://project.supabase.co/auth/v1/.well-known/jwks.json");
  });

  it("requires HTTPS (plain http only for loopback outside production)", () => {
    vi.stubEnv("SUPABASE_URL", "http://project.supabase.co");
    expect(() => getSupabaseTrustedEndpoints()).toThrow(AuthProviderUnavailableError);
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:9999");
    expect(getSupabaseTrustedEndpoints().jwksUrl.href).toBe("http://127.0.0.1:9999/auth/v1/.well-known/jwks.json");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSupabaseTrustedEndpoints()).toThrow(AuthProviderUnavailableError);
  });

  it("has no configuration input for a JWKS URL other than SUPABASE_URL", () => {
    vi.stubEnv("SUPABASE_JWKS_URL", "https://evil.example/jwks.json");
    vi.stubEnv("JWKS_URL", "https://evil.example/jwks.json");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    expect(getSupabaseTrustedEndpoints().jwksUrl.origin).toBe("https://project.supabase.co");
  });

  it("test-only key-set configuration is refused in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => configureSupabaseKeySetForTests()).toThrow();
  });
});

describe("middleware: JWKS outage vs invalid session", () => {
  const cookieHeader = (token: string) => ({ headers: { cookie: `${SESSION_COOKIE}=${token}` } });
  const clearsSessionCookie = (response: Response) =>
    (response.headers.get("set-cookie") ?? "").includes(`${SESSION_COOKIE}=;`) ||
    (response.headers.get("set-cookie") ?? "").toLowerCase().includes("max-age=0");

  it("valid token passes through", async () => {
    const token = await signEs256(keyA);
    const response = await middleware(new NextRequest("http://localhost/overview", cookieHeader(token)));
    expect(response.status).toBe(200);
  });

  it("L. during a JWKS outage API requests get 503 and the session cookie is not deleted", async () => {
    const token = await signEs256(keyA);
    state.mode = "status500";
    const response = await middleware(new NextRequest("http://localhost/api/businesses", cookieHeader(token)));
    expect(response.status).toBe(503);
    expect(clearsSessionCookie(response)).toBe(false);
    expect(await response.json()).toEqual({ error: "The authentication service is unavailable." });
  });

  it("L. during a JWKS outage browser requests are not redirected to /login and the cookie is kept", async () => {
    const token = await signEs256(keyA);
    state.mode = "status500";
    const response = await middleware(new NextRequest("http://localhost/invoices", cookieHeader(token)));
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(clearsSessionCookie(response)).toBe(false);
  });

  it("M. an expired, forged or malformed token keeps the existing 401 / redirect+clear behaviour", async () => {
    const expired = await signEs256(keyA, { exp: Math.floor(Date.now() / 1000) - 60 });
    const forged = await signEs256(await makeKey("key-a"));
    for (const bad of [expired, forged, "garbage"]) {
      const api = await middleware(new NextRequest("http://localhost/api/businesses", cookieHeader(bad)));
      expect(api.status).toBe(401);
      const page = await middleware(new NextRequest("http://localhost/invoices", cookieHeader(bad)));
      expect(page.status).toBe(307);
      expect(page.headers.get("location")).toContain("/login");
      expect(clearsSessionCookie(page)).toBe(true);
    }
  });

  it("M. invalid tokens are still 401/redirect (not 503) while the JWKS provider is down", async () => {
    state.mode = "status500";
    const hs = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(USER_ID).setExpirationTime("1h").sign(new TextEncoder().encode(LEGACY_SHARED_SECRET));
    for (const bad of ["garbage", hs]) {
      expect((await middleware(new NextRequest("http://localhost/api/businesses", cookieHeader(bad)))).status).toBe(401);
      expect((await middleware(new NextRequest("http://localhost/invoices", cookieHeader(bad)))).status).toBe(307);
    }
  });

  it("public paths never depend on the JWKS provider", async () => {
    state.mode = "status500";
    for (const path of ["/login", "/api/health", "/api/auth/login"]) {
      expect((await middleware(new NextRequest(`http://localhost${path}`))).status).toBe(200);
    }
  });
});

describe("production configuration (P)", () => {
  const base = {
    NODE_ENV: "production",
    AUTH_PROVIDER: "supabase",
    EMAIL_PROVIDER: "smtp",
    CALENDAR_PROVIDER: "google",
    DATABASE_URL: "postgresql://x",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "publishable",
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    GOOGLE_OAUTH_STATE_SECRET: "dedicated-oauth-state-secret-0123456789abcdef",
    NEXT_PUBLIC_APP_URL: "https://billing.example.test",
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
    GOOGLE_OAUTH_REDIRECT_URI: "https://billing.example.test/api/calendar/oauth/callback",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "587",
    SMTP_USER: "user",
    SMTP_PASSWORD: "password",
    EMAIL_FROM: "billing@example.test",
  } as unknown as NodeJS.ProcessEnv;
  const without = (name: string, extra: Record<string, string> = {}) => {
    const copy = { ...base, ...extra } as Record<string, string | undefined>;
    delete copy[name];
    return copy as NodeJS.ProcessEnv;
  };

  it("SUPABASE_JWT_SECRET is no longer required", () => {
    expect(base.SUPABASE_JWT_SECRET).toBeUndefined();
    expect(() => assertProductionConfiguration(base)).not.toThrow();
  });

  it("GOOGLE_OAUTH_STATE_SECRET is required, ≥32 chars, and dedicated", () => {
    expect(() => assertProductionConfiguration(without("GOOGLE_OAUTH_STATE_SECRET"))).toThrow(/GOOGLE_OAUTH_STATE_SECRET is required/);
    expect(() => assertProductionConfiguration({ ...base, GOOGLE_OAUTH_STATE_SECRET: "short" } as NodeJS.ProcessEnv)).toThrow(/at least 32/);
    expect(() =>
      assertProductionConfiguration({ ...base, GOOGLE_OAUTH_STATE_SECRET: base.TOKEN_ENCRYPTION_KEY } as NodeJS.ProcessEnv),
    ).toThrow(/dedicated/);
    expect(() =>
      assertProductionConfiguration({ ...base, SUPABASE_JWT_SECRET: base.GOOGLE_OAUTH_STATE_SECRET } as NodeJS.ProcessEnv),
    ).toThrow(/dedicated/);
  });

  it("every other required production variable remains required", () => {
    for (const name of [
      "DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "TOKEN_ENCRYPTION_KEY", "NEXT_PUBLIC_APP_URL",
      "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_REDIRECT_URI",
      "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM",
    ]) {
      expect(() => assertProductionConfiguration(without(name)), name).toThrow(ProductionConfigurationError);
    }
    expect(() => assertProductionConfiguration({ ...base, AUTH_PROVIDER: "development" } as NodeJS.ProcessEnv)).toThrow(/AUTH_PROVIDER/);
    expect(() => assertProductionConfiguration({ ...base, SUPABASE_URL: "http://project.supabase.co" } as NodeJS.ProcessEnv)).toThrow(/https/);
  });
});
