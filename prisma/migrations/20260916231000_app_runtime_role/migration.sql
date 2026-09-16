-- Creates a dedicated, non-superuser Postgres role for the *running
-- application* to connect as, distinct from the (superuser/table-owner)
-- role Prisma Migrate uses to apply schema changes.
--
-- Why this migration exists: Row-Level Security (the previous migration,
-- 20260916225500_invariant_constraints) is unconditionally bypassed for
-- superusers and — via ALTER TABLE ... FORCE ROW LEVEL SECURITY though it
-- is — for the table owner too, UNLESS the connecting role is neither.
-- The migration-running role (`postgres` locally; the platform admin role
-- on Supabase) is both, so RLS would silently do nothing if the app also
-- connected as that role. SEC-ISO-004 requires RLS to be a *real* second
-- layer, not a policy that looks correct but never actually runs.
--
-- src/server/db/client.ts (the app's Prisma Client) connects via
-- DATABASE_URL, which must point at this role. Prisma Migrate itself
-- connects via DIRECT_URL, which stays pointed at the admin/owner role —
-- see .env.example and docs/phase-3/README.md.
--
-- The password below is a fixed, published, LOCAL-DEVELOPMENT-ONLY value
-- (this migration runs identically against the ephemeral test database
-- and any local dev database, both throwaway). It is not a secret and
-- must never be reused for a real deployment — see docs/phase-3/README.md
-- "What Was Not Connected" for what a production Supabase deployment
-- must do differently (a generated, secret-managed credential; Supabase's
-- own role model may replace this entirely).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH
      LOGIN
      PASSWORD 'app_runtime_local_dev_only'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOBYPASSRLS
      NOREPLICATION;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;

-- Ensure any table created by a *later* migration is covered too, without
-- requiring every future migration to remember this grant.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

-- app_current_business_ids() (defined in the previous migration) must be
-- callable by app_runtime — it is what every RLS policy relies on.
GRANT EXECUTE ON FUNCTION app_current_business_ids() TO app_runtime;

-- Explicitly confirm intent: app_runtime must never be granted DELETE or
-- UPDATE on audit_event, even though the blanket grant above included it
-- for consistency with every other table — the append-only trigger
-- (previous migration) is the enforcement mechanism either way, but least
-- privilege is a second, independent reason this should never succeed.
REVOKE UPDATE, DELETE ON "audit_event" FROM app_runtime;
