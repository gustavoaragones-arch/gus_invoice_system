import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";
import { SESSION_COOKIE, createSessionToken, isUuid, safeNextPath } from "@/server/auth/session";
import { verifySupabaseAccessToken } from "@/server/auth/supabaseAuth";
import { signInWithPassword } from "@/server/auth/supabaseGoTrue";
import { getCalendarProviderMode } from "@/server/calendar/googleCalendarConfig";
import {
  ProductionConfigurationError,
  assertProductionConfiguration,
  getAuthProviderMode,
} from "@/server/config/runtime";
import { getEmailProviderMode } from "@/server/delivery/emailConfig";
import { AuthenticationError, ValidationError } from "@/server/domain/errors";
import { toErrorResponse } from "@/server/http/errorResponse";
import nextConfig from "../../next.config";

const SECRET = "phase11-unit-test-jwt-secret-with-enough-length-0123456789";
const USER_ID = "33333333-3333-3333-3333-333333333333";

function sign(claims: Record<string, unknown>, options: { secret?: string; exp?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(options.exp ?? "1h")
    .sign(new TextEncoder().encode(options.secret ?? SECRET));
}

const productionEnv = {
  NODE_ENV: "production",
  AUTH_PROVIDER: "supabase",
  EMAIL_PROVIDER: "smtp",
  CALENDAR_PROVIDER: "google",
  DATABASE_URL: "postgresql://x",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_JWT_SECRET: SECRET,
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  NEXT_PUBLIC_APP_URL: "https://billing.example.test",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret-google-value",
  GOOGLE_OAUTH_REDIRECT_URI: "https://billing.example.test/api/calendar/oauth/callback",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_USER: "user",
  SMTP_PASSWORD: "smtp-password-value",
  EMAIL_FROM: "billing@example.test",
} as unknown as NodeJS.ProcessEnv;

beforeEach(() => {
  vi.stubEnv("SUPABASE_JWT_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("production authentication never falls back to development", () => {
  it("fails closed in production when AUTH_PROVIDER is unset, development, or unknown", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const value of [undefined, "", "development", "custom"]) {
      if (value === undefined) vi.stubEnv("AUTH_PROVIDER", "");
      else vi.stubEnv("AUTH_PROVIDER", value);
      expect(() => getAuthProviderMode()).toThrow(ProductionConfigurationError);
    }
    vi.stubEnv("AUTH_PROVIDER", "supabase");
    expect(getAuthProviderMode()).toBe("supabase");
  });

  it("defaults to development only outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_PROVIDER", "");
    expect(getAuthProviderMode()).toBe("development");
  });

  it("email and calendar providers fail closed in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const value of ["", "development"]) {
      vi.stubEnv("EMAIL_PROVIDER", value);
      vi.stubEnv("CALENDAR_PROVIDER", value);
      expect(() => getEmailProviderMode()).toThrow(/production/);
      expect(() => getCalendarProviderMode()).toThrow(/production/);
    }
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    vi.stubEnv("CALENDAR_PROVIDER", "google");
    expect(getEmailProviderMode()).toBe("smtp");
    expect(getCalendarProviderMode()).toBe("google");
  });

  it("refuses to mint development session tokens when the provider is supabase", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_PROVIDER", "supabase");
    await expect(createSessionToken(USER_ID, "a@example.test")).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("supabase mode rejects locally-minted tokens that lack the Supabase audience/issuer", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_PROVIDER", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");

    const devStyle = await sign({ sub: USER_ID, email: "a@example.test" });
    await expect(verifySupabaseAccessToken(devStyle)).rejects.toBeInstanceOf(AuthenticationError);

    const wrongIssuer = await sign({ sub: USER_ID, aud: "authenticated", iss: "https://evil.example/auth/v1" });
    await expect(verifySupabaseAccessToken(wrongIssuer)).rejects.toBeInstanceOf(AuthenticationError);

    const real = await sign({
      sub: USER_ID,
      email: "a@example.test",
      aud: "authenticated",
      iss: "https://project.supabase.co/auth/v1",
    });
    await expect(verifySupabaseAccessToken(real)).resolves.toEqual({ userId: USER_ID, email: "a@example.test" });
  });

  it("rejects wrong-secret, expired and non-UUID-subject tokens", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_PROVIDER", "");
    await expect(verifySupabaseAccessToken(await sign({ sub: USER_ID }, { secret: "x".repeat(40) }))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    const expired = await new SignJWT({ sub: USER_ID })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifySupabaseAccessToken(expired)).rejects.toBeInstanceOf(AuthenticationError);
    await expect(verifySupabaseAccessToken(await sign({ sub: "not-a-uuid" }))).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe("Supabase Auth password sign-in", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
  });

  it("returns the Supabase access token and never sends credentials anywhere else", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 1800 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await signInWithPassword("a@example.test", "pw");
    expect(result).toEqual({ accessToken: "tok", expiresInSeconds: 1800 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://project.supabase.co/auth/v1/token?grant_type=password");
  });

  it("maps invalid credentials to one generic AuthenticationError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(signInWithPassword("a@example.test", "bad")).rejects.toThrow("Invalid email or password.");
  });

  it("treats provider outages as unavailable, not as bad credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1")));
    await expect(signInWithPassword("a@example.test", "pw")).rejects.toThrow("The authentication service is unavailable.");
  });
});

describe("production configuration validation", () => {
  it("accepts a complete production configuration", () => {
    expect(() => assertProductionConfiguration(productionEnv)).not.toThrow();
  });

  it("fails closed and reports names only — never secret values", () => {
    const broken = {
      ...productionEnv,
      AUTH_PROVIDER: "development",
      EMAIL_PROVIDER: "development",
      SUPABASE_JWT_SECRET: "zq9-tiny-secret",
      SMTP_PASSWORD: "",
      NEXT_PUBLIC_APP_URL: "http://insecure.example",
    } as unknown as NodeJS.ProcessEnv;
    let message = "";
    try {
      assertProductionConfiguration(broken);
    } catch (error) {
      expect(error).toBeInstanceOf(ProductionConfigurationError);
      message = (error as Error).message;
    }
    expect(message).toContain("AUTH_PROVIDER");
    expect(message).toContain("EMAIL_PROVIDER");
    expect(message).toContain("SMTP_PASSWORD");
    expect(message).toContain("NEXT_PUBLIC_APP_URL");
    for (const secret of ["zq9-tiny-secret", "secret-google-value", Buffer.alloc(32, 7).toString("base64")]) {
      expect(message).not.toContain(secret);
    }
  });

  it("requires a valid 32-byte TOKEN_ENCRYPTION_KEY", () => {
    const env = { ...productionEnv, TOKEN_ENCRYPTION_KEY: "AAAA" } as unknown as NodeJS.ProcessEnv;
    expect(() => assertProductionConfiguration(env)).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("does nothing outside production", () => {
    expect(() => assertProductionConfiguration({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv)).not.toThrow();
  });
});

describe("route protection (middleware)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_PROVIDER", "");
  });

  it("redirects unauthenticated page requests to /login", async () => {
    const response = await middleware(new NextRequest("http://localhost/invoices"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Finvoices");
  });

  it("returns 401 JSON for unauthenticated API requests including the PDF route", async () => {
    for (const path of ["/api/invoices/00000000-0000-0000-0000-000000000000/pdf", "/api/businesses", "/api/business/select"]) {
      const response = await middleware(new NextRequest(`http://localhost${path}`));
      expect(response.status).toBe(401);
    }
  });

  it("rejects an invalid or forged session cookie", async () => {
    const forged = await sign({ sub: USER_ID }, { secret: "y".repeat(40) });
    const response = await middleware(
      new NextRequest("http://localhost/api/businesses", { headers: { cookie: `${SESSION_COOKIE}=${forged}` } }),
    );
    expect(response.status).toBe(401);
    const garbage = await middleware(
      new NextRequest("http://localhost/overview", { headers: { cookie: `${SESSION_COOKIE}=garbage` } }),
    );
    expect(garbage.status).toBe(307);
  });

  it("allows a valid session and the public paths", async () => {
    const token = await sign({ sub: USER_ID, email: "a@example.test" });
    const authed = await middleware(
      new NextRequest("http://localhost/overview", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }),
    );
    expect(authed.status).toBe(200);
    for (const path of ["/login", "/api/health", "/api/auth/login"]) {
      expect((await middleware(new NextRequest(`http://localhost${path}`))).status).toBe(200);
    }
  });
});

describe("input and redirect hardening", () => {
  it("only accepts same-origin relative post-login paths", () => {
    expect(safeNextPath("/invoices")).toBe("/invoices");
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "javascript:alert(1)", null, 5]) {
      expect(safeNextPath(bad)).toBe("/overview");
    }
  });

  it("recognises UUIDs strictly", () => {
    expect(isUuid(USER_ID)).toBe(true);
    for (const bad of ["", "abc", `${USER_ID}x`, "../../etc/passwd", "1; DROP TABLE invoice"]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});

describe("production-safe error responses", () => {
  it("does not echo unexpected error details, secrets, SQL or paths", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    const leaky = new Error(
      "connect postgresql://postgres:hunter2@db.internal:5432/app failed at /Users/x/app/node_modules/pg.js; SELECT * FROM invoice; SUPABASE_JWT_SECRET=topsecret",
    );
    const response = toErrorResponse(leaky);
    const text = JSON.stringify(await response.json());
    expect(response.status).toBe(500);
    expect(text).toBe('{"error":"Internal server error."}');
    for (const fragment of ["hunter2", "postgresql://", "/Users/", "SELECT", "topsecret"]) {
      expect(text).not.toContain(fragment);
    }
    // production logging records the class only, not the message
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("hunter2");
    vi.restoreAllMocks();
  });

  it("maps malformed identifiers and configuration failures to controlled responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const malformed = toErrorResponse(Object.assign(new Error("Inconsistent column data: Error creating UUID"), { code: "P2023" }));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "Invalid identifier." });

    const config = toErrorResponse(new ProductionConfigurationError("SMTP_PASSWORD is required"));
    expect(config.status).toBe(503);
    expect(JSON.stringify(await config.json())).not.toContain("SMTP_PASSWORD");

    expect(toErrorResponse(new ValidationError("Bad input.")).status).toBe(400);
    vi.restoreAllMocks();
  });
});

describe("security headers", () => {
  it("sets framing, sniffing, referrer, permissions and CSP protections", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.filter((r) => r.source === "/:path*").flatMap((r) => r.headers);
    const byKey = new Map(all.map((h) => [h.key, h.value]));
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    expect(byKey.get("Referrer-Policy")).toBeTruthy();
    expect(byKey.get("Permissions-Policy")).toContain("camera=()");

    const csp = rules.find((r) => r.headers.some((h) => h.key === "Content-Security-Policy"));
    const value = csp!.headers[0]!.value;
    expect(value).toContain("frame-ancestors 'none'");
    expect(value).toContain("object-src 'none'");
    expect(value).toContain("default-src 'self'");
    // CSP is not applied to API responses such as the invoice PDF.
    expect(csp!.source).toContain("api/");
  });
});
