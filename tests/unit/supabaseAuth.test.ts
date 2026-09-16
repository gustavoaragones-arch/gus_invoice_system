import { SignJWT } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { extractBearerToken, verifySupabaseAccessToken } from "@/server/auth/supabaseAuth";
import { AuthenticationError } from "@/server/domain/errors";

const TEST_SECRET = "unit-test-only-jwt-secret-not-used-anywhere-real";

async function signToken(claims: Record<string, unknown>, secret = TEST_SECRET) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

describe("Supabase Auth JWT verification (SEC-AUTH-002)", () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  });

  it("verifies a validly-signed token and extracts userId/email", async () => {
    const token = await signToken({ sub: "11111111-1111-1111-1111-111111111111", email: "owner@example.test" });
    const context = await verifySupabaseAccessToken(token);
    expect(context.userId).toBe("11111111-1111-1111-1111-111111111111");
    expect(context.email).toBe("owner@example.test");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = await signToken({ sub: "abc", email: "x@example.test" }, "wrong-secret");
    await expect(verifySupabaseAccessToken(token)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ sub: "abc", email: "x@example.test" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(TEST_SECRET));
    await expect(verifySupabaseAccessToken(expired)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("rejects a token with no subject claim", async () => {
    const token = await signToken({ email: "x@example.test" });
    await expect(verifySupabaseAccessToken(token)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("extracts a Bearer token from an Authorization header", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("rejects a missing or malformed Authorization header", () => {
    expect(() => extractBearerToken(null)).toThrow(AuthenticationError);
    expect(() => extractBearerToken("Basic abc")).toThrow(AuthenticationError);
  });
});
