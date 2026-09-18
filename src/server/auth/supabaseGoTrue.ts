import { AuthenticationError } from "@/server/domain/errors";

/**
 * Minimal server-side client for Supabase Auth (GoTrue). Supabase Auth is
 * the production identity provider: credentials are verified by Supabase,
 * never by this application, and no password is stored or logged here.
 */

export interface SupabaseSignInResult {
  accessToken: string;
  expiresInSeconds: number;
}

export class AuthProviderUnavailableError extends Error {
  constructor() {
    super("The authentication service is unavailable.");
    this.name = "AuthProviderUnavailableError";
  }
}

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new AuthProviderUnavailableError();
  }
  return { url, anonKey };
}

export async function signInWithPassword(email: string, password: string): Promise<SupabaseSignInResult> {
  const { url, anonKey } = getSupabaseConfig();

  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    throw new AuthProviderUnavailableError();
  }

  if (response.status === 400 || response.status === 401 || response.status === 422) {
    // Deliberately one message for unknown user and wrong password.
    throw new AuthenticationError("Invalid email or password.");
  }
  if (!response.ok) {
    throw new AuthProviderUnavailableError();
  }

  const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new AuthProviderUnavailableError();
  }
  const expires = typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : 3600;
  return { accessToken: body.access_token, expiresInSeconds: Math.floor(expires) };
}

/** Best-effort server-side revocation of the Supabase session. Never throws. */
export async function signOutSupabaseSession(accessToken: string): Promise<void> {
  try {
    const { url, anonKey } = getSupabaseConfig();
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    // Local cookie removal still ends the application session.
  }
}
