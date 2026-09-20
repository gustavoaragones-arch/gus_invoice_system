import { afterEach, describe, expect, it } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { GOOGLE_CALENDAR_SCOPES, getCalendarProviderMode } from "@/server/calendar/googleCalendarConfig";
import { buildGoogleAuthorizationUrl, createGoogleOAuthState, verifyGoogleOAuthState } from "@/server/calendar/googleOAuth";

const STATE_SECRET = "dedicated-google-oauth-state-secret-0123456789";
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("google OAuth", () => {
  it("requests only the approved minimum calendar scopes", () => {
    expect(GOOGLE_CALENDAR_SCOPES).toEqual([
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ]);
  });

  it("creates and verifies OAuth state bound to user and business", async () => {
    process.env.GOOGLE_OAUTH_STATE_SECRET = STATE_SECRET;
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://localhost:3000/api/calendar/oauth/callback";

    const state = await createGoogleOAuthState({
      userId: "user-1",
      businessId: "business-1",
    });

    const verified = await verifyGoogleOAuthState(state);
    expect(verified.userId).toBe("user-1");
    expect(verified.businessId).toBe("business-1");
  });

  it("rejects invalid OAuth state", async () => {
    process.env.GOOGLE_OAUTH_STATE_SECRET = STATE_SECRET;
    await expect(verifyGoogleOAuthState("not-a-valid-state")).rejects.toThrow();
  });

  it("rejects expired OAuth state", async () => {
    process.env.GOOGLE_OAUTH_STATE_SECRET = STATE_SECRET;
    const expired = await new SignJWT({ businessId: "business-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(new TextEncoder().encode(STATE_SECRET));

    await expect(verifyGoogleOAuthState(expired)).rejects.toThrow();
  });

  it("builds an authorization URL without exposing secrets", () => {
    process.env.CALENDAR_PROVIDER = "google";
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://localhost:3000/api/calendar/oauth/callback";

    const url = buildGoogleAuthorizationUrl("signed-state");
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("client-id");
    expect(url).not.toContain("client-secret");
    expect(url).toContain("signed-state");
    expect(getCalendarProviderMode()).toBe("google");
  });

  it("signs state with GOOGLE_OAUTH_STATE_SECRET only, independent of SUPABASE_JWT_SECRET and TOKEN_ENCRYPTION_KEY", async () => {
    process.env.GOOGLE_OAUTH_STATE_SECRET = STATE_SECRET;
    process.env.SUPABASE_JWT_SECRET = "a-different-supabase-secret-0123456789abcdef";
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");

    const state = await createGoogleOAuthState({ userId: "user-1", businessId: "business-1" });
    // verifies with the dedicated secret alone
    await jwtVerify(state, new TextEncoder().encode(STATE_SECRET), { algorithms: ["HS256"] });
    // does not verify with the Supabase secret or the encryption key
    await expect(jwtVerify(state, new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET))).rejects.toThrow();
    await expect(jwtVerify(state, new TextEncoder().encode(process.env.TOKEN_ENCRYPTION_KEY))).rejects.toThrow();

    // removing SUPABASE_JWT_SECRET changes nothing
    delete process.env.SUPABASE_JWT_SECRET;
    await expect(verifyGoogleOAuthState(state)).resolves.toEqual({ userId: "user-1", businessId: "business-1" });
  });

  it("refuses to sign or verify state when the dedicated secret is missing or too short — SUPABASE_JWT_SECRET is not a fallback", async () => {
    process.env.SUPABASE_JWT_SECRET = "a-different-supabase-secret-0123456789abcdef";
    delete process.env.GOOGLE_OAUTH_STATE_SECRET;
    await expect(createGoogleOAuthState({ userId: "u", businessId: "b" })).rejects.toThrow(/GOOGLE_OAUTH_STATE_SECRET/);
    process.env.GOOGLE_OAUTH_STATE_SECRET = "too-short";
    await expect(createGoogleOAuthState({ userId: "u", businessId: "b" })).rejects.toThrow(/at least 32/);
    await expect(verifyGoogleOAuthState("x.y.z")).rejects.toThrow();
  });

  it("rejects state signed with the Supabase secret", async () => {
    process.env.GOOGLE_OAUTH_STATE_SECRET = STATE_SECRET;
    const forged = await new SignJWT({ businessId: "business-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode("a-different-supabase-secret-0123456789abcdef"));
    await expect(verifyGoogleOAuthState(forged)).rejects.toThrow();
  });
});
