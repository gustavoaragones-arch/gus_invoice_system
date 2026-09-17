import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  startTestDatabase,
  stopTestDatabase,
  TEST_ADMIN_DATABASE_URL,
  TEST_APP_DATABASE_URL,
} from "./support/testDatabase";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, "..");

/**
 * Vitest `globalSetup`: runs once, in the main process, before any test
 * worker is forked. This is what makes DATABASE_URL/DIRECT_URL reliably
 * visible to every worker's `import { prisma } from "@/server/db/client"`
 * — those workers inherit process.env at fork time, which happens only
 * after this function has already set both variables and the schema has
 * been migrated.
 *
 * Two different roles are used deliberately (see
 * prisma/migrations/*_app_runtime_role): migrations run as the
 * admin/owner role (DIRECT_URL), but the application — and therefore
 * every integration test exercising src/server/domain — connects as the
 * restricted, non-superuser `app_runtime` role (DATABASE_URL). Row-Level
 * Security is unconditionally bypassed for superusers and table owners,
 * so testing against the admin role would make every RLS test pass
 * without RLS having done anything at all.
 */
export async function setup() {
  // Calendar OAuth token encryption requires a 32-byte base64 key in tests.
  if (!process.env.TOKEN_ENCRYPTION_KEY || Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64").length !== 32) {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  }

  await startTestDatabase();

  process.env.DATABASE_URL = TEST_ADMIN_DATABASE_URL;
  process.env.DIRECT_URL = TEST_ADMIN_DATABASE_URL;
  execSync("npx prisma migrate deploy", {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: "inherit",
  });

  // Now switch DATABASE_URL to the restricted role for the actual test
  // run. DIRECT_URL stays pointed at the admin role (unused at runtime by
  // the Prisma Client, only by the `prisma migrate` CLI, which is not
  // invoked again after this point).
  process.env.DATABASE_URL = TEST_APP_DATABASE_URL;
}

export async function teardown() {
  await stopTestDatabase();
}
