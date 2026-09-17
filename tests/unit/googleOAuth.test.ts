import { afterEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { GOOGLE_CALENDAR_SCOPES, getCalendarProviderMode } from "@/server/calendar/googleCalendarConfig";
import { buildGoogleAuthorizationUrl, createGoogleOAuthState, verifyGoogleOAuthState } from "@/server/calendar/googleOAuth";

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
    process.env.SUPABASE_JWT_SECRET = "test-secret-for-oauth-state";
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
    process.env.SUPABASE_JWT_SECRET = "test-secret-for-oauth-state";
    await expect(verifyGoogleOAuthState("not-a-valid-state")).rejects.toThrow();
  });

  it("rejects expired OAuth state", async () => {
    process.env.SUPABASE_JWT_SECRET = "test-secret-for-oauth-state";
    const expired = await new SignJWT({ businessId: "business-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));

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
});
