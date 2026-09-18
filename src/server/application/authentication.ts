import { z } from "zod";
import type { AuthContext } from "@/server/auth/types";
import { createSessionToken } from "@/server/auth/session";
import { verifySupabaseAccessToken } from "@/server/auth/supabaseAuth";
import { signInWithPassword } from "@/server/auth/supabaseGoTrue";
import { getAuthProviderMode } from "@/server/config/runtime";
import { prisma } from "@/server/db/client";
import { withAuthorizedTransaction } from "@/server/db/authorizedTransaction";
import { ValidationError } from "@/server/domain/errors";
import { ensureUserProvisioned } from "@/server/domain/userProvisioning";

const DEVELOPMENT_SESSION_SECONDS = 60 * 60 * 24 * 7;

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().max(1024).optional(),
});

export interface LoginResult {
  auth: AuthContext;
  sessionToken: string;
  maxAgeSeconds: number;
}

/**
 * Establishes an authenticated session.
 *
 * - "supabase" (mandatory in production): credentials are verified by
 *   Supabase Auth; the resulting Supabase access token IS the session
 *   token (verified again on every request). No password is stored.
 * - "development" (never available in production): email-only sign-in that
 *   provisions a local user, for local use and automated tests only.
 */
export async function loginWithCredentials(input: { email: unknown; password?: unknown }): Promise<LoginResult> {
  const parsed = credentialsSchema.safeParse({
    email: input.email,
    password: typeof input.password === "string" ? input.password : undefined,
  });
  if (!parsed.success) {
    throw new ValidationError("A valid email address is required.");
  }
  const { email, password } = parsed.data;

  if (getAuthProviderMode() === "supabase") {
    if (!password) throw new ValidationError("Password is required.");
    const { accessToken, expiresInSeconds } = await signInWithPassword(email, password);
    const auth = await verifySupabaseAccessToken(accessToken);
    const identity = { userId: auth.userId, email: auth.email || email };
    await withAuthorizedTransaction(identity, (tx) => ensureUserProvisioned(tx, identity));
    return { auth: identity, sessionToken: accessToken, maxAgeSeconds: expiresInSeconds };
  }

  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });
  const auth = { userId: user.id, email: user.email };
  await withAuthorizedTransaction(auth, (tx) => ensureUserProvisioned(tx, auth));
  const sessionToken = await createSessionToken(auth.userId, auth.email);
  return { auth, sessionToken, maxAgeSeconds: DEVELOPMENT_SESSION_SECONDS };
}
