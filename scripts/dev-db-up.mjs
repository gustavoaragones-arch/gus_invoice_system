// One-off helper (not part of the app) used during Phase 3 implementation
// to run Prisma Migrate against a real, ephemeral local Postgres instance.
// Not imported by application code or tests (tests/support/testDatabase.ts
// manages its own lifecycle per test run).
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", ".embedded-postgres", "dev-data");

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "postgres",
  password: "postgres",
  port: 54329,
  persistent: true,
});

await pg.initialise();
await pg.start();
await pg.createDatabase("gus_invoice_system_dev").catch(() => {});
console.log("READY postgresql://postgres:postgres@localhost:54329/gus_invoice_system_dev?schema=public");

process.stdin.resume();
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});
