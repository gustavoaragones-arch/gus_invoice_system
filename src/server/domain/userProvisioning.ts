import type { Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";

/**
 * Ensures a domain `User` row exists for an authenticated Supabase Auth
 * identity, creating it on first sight. Supabase Auth maintains its own
 * `auth.users` table outside this application's schema; `app_user` here
 * is a lightweight local mirror keyed on the same id (Phase 2 §03 Section
 * 3.16: "id equals the Supabase Auth user id"), needed because User is a
 * real foreign-key target for Business and AuditEvent.
 *
 * `app_user` has no RLS policy (nothing in it is business-scoped), so
 * this is safe to call from within any withAuthorizedTransaction.
 */
export async function ensureUserProvisioned(tx: Tx, auth: AuthContext) {
  return tx.user.upsert({
    where: { id: auth.userId },
    update: {},
    create: { id: auth.userId, email: auth.email },
  });
}
