import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Spins up a real, ephemeral PostgreSQL instance (no system install, no
 * Docker required) so integration tests run against actual Postgres
 * semantics — NUMERIC precision, CHECK constraints, partial unique
 * indexes, triggers, and Row-Level Security — rather than a mock. This is
 * test-only infrastructure; production points DATABASE_URL at the
 * provisioned Supabase Postgres instance instead (see .env.example).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", ".embedded-postgres", "test-data");
const PORT = 54330;
const USER = "postgres";
const PASSWORD = "postgres";
const DATABASE = "gus_invoice_system_test";

/** Admin/owner connection — used only for running migrations
 * (`prisma migrate deploy`), never by the application's own Prisma
 * Client. See prisma/migrations/*_app_runtime_role for why. */
export const TEST_ADMIN_DATABASE_URL = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public`;

/** Restricted, non-superuser connection the application (and therefore
 * every integration test) actually runs queries through — this is what
 * makes the Row-Level Security policies take effect at all. */
export const TEST_APP_DATABASE_URL = `postgresql://app_runtime:app_runtime_local_dev_only@localhost:${PORT}/${DATABASE}?schema=public`;

let pg: EmbeddedPostgres | undefined;
let started = false;

export async function startTestDatabase(): Promise<string> {
  if (started) return TEST_ADMIN_DATABASE_URL;

  pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DATABASE);
  started = true;
  return TEST_ADMIN_DATABASE_URL;
}

export async function stopTestDatabase(): Promise<void> {
  if (pg && started) {
    await pg.stop();
    started = false;
  }
}
