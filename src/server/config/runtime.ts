/**
 * Phase 11 — explicit production/development separation.
 *
 * Every provider (authentication, email, calendar) has a development
 * implementation for local use and automated tests. In production the
 * provider must be selected explicitly and the development implementation
 * is never a valid choice: a missing or "development" value fails closed
 * instead of silently falling back.
 */

export class ProductionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionConfigurationError";
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export type AuthProviderMode = "supabase" | "development";

export function getAuthProviderMode(): AuthProviderMode {
  const configured = process.env.AUTH_PROVIDER?.trim().toLowerCase();

  if (isProduction()) {
    if (configured !== "supabase") {
      throw new ProductionConfigurationError(
        'AUTH_PROVIDER must be explicitly set to "supabase" in production. Development authentication is not permitted.',
      );
    }
    return "supabase";
  }

  if (!configured || configured === "development") return "development";
  if (configured === "supabase") return "supabase";
  throw new ProductionConfigurationError(
    `Unsupported AUTH_PROVIDER value "${configured}". Use "supabase" or "development".`,
  );
}

/** Application base URL used for redirects. Required (and never defaulted) in production. */
export function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured;
  if (isProduction()) {
    throw new ProductionConfigurationError("NEXT_PUBLIC_APP_URL must be set in production.");
  }
  return "http://localhost:3000";
}

const REQUIRED_PRODUCTION_VARIABLES = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "GOOGLE_OAUTH_STATE_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "EMAIL_FROM",
] as const;

/**
 * Validates production configuration. Reports variable NAMES only — never
 * values. Throws ProductionConfigurationError listing every problem.
 * No-op outside production.
 */
export function assertProductionConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const problems: string[] = [];

  if (env.AUTH_PROVIDER?.trim().toLowerCase() !== "supabase") {
    problems.push('AUTH_PROVIDER must be "supabase"');
  }
  if (env.EMAIL_PROVIDER?.trim().toLowerCase() !== "smtp") {
    problems.push('EMAIL_PROVIDER must be "smtp"');
  }
  if (env.CALENDAR_PROVIDER?.trim().toLowerCase() !== "google") {
    problems.push('CALENDAR_PROVIDER must be "google"');
  }

  for (const name of REQUIRED_PRODUCTION_VARIABLES) {
    if (!env[name]?.trim()) problems.push(`${name} is required`);
  }

  const key = env.TOKEN_ENCRYPTION_KEY?.trim();
  if (key && Buffer.from(key, "base64").length !== 32) {
    problems.push("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  const stateSecret = env.GOOGLE_OAUTH_STATE_SECRET?.trim();
  if (stateSecret && stateSecret.length < 32) {
    problems.push("GOOGLE_OAUTH_STATE_SECRET must be at least 32 characters");
  }
  if (stateSecret && (stateSecret === key || stateSecret === env.SUPABASE_JWT_SECRET?.trim())) {
    problems.push("GOOGLE_OAUTH_STATE_SECRET must be a dedicated secret (not reused from another variable)");
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl && !appUrl.startsWith("https://")) {
    problems.push("NEXT_PUBLIC_APP_URL must use https://");
  }

  const supabaseUrl = env.SUPABASE_URL?.trim();
  if (supabaseUrl && !supabaseUrl.startsWith("https://")) {
    problems.push("SUPABASE_URL must use https://");
  }

  if (problems.length > 0) {
    throw new ProductionConfigurationError(
      `Invalid production configuration: ${problems.join("; ")}.`,
    );
  }
}
