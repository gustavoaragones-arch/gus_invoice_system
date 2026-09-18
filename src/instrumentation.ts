import { assertProductionConfiguration } from "@/server/config/runtime";

/**
 * Runs once when the server starts. In production an invalid or incomplete
 * configuration (missing secrets, development providers) aborts startup
 * instead of letting the application run with insecure fallbacks.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertProductionConfiguration();
  }
}
