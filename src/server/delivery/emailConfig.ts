export class EmailProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailProviderConfigurationError";
  }
}

export type EmailProviderMode = "development" | "smtp";

export interface SmtpEmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string | null;
}

export function getEmailProviderMode(): EmailProviderMode {
  const configured = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "development") {
    return "development";
  }
  if (configured === "smtp") {
    return "smtp";
  }
  throw new EmailProviderConfigurationError(
    `Unsupported EMAIL_PROVIDER value "${configured}". Use "development" or "smtp".`,
  );
}

export function getSmtpEmailConfig(): SmtpEmailConfig {
  const host = process.env.SMTP_HOST?.trim();
  const portValue = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  const fromEmail = process.env.EMAIL_FROM?.trim();
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || null;

  if (!host || !portValue || !user || !password || !fromEmail) {
    throw new EmailProviderConfigurationError(
      "SMTP email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM.",
    );
  }

  const port = Number(portValue);
  if (!Number.isInteger(port) || port <= 0) {
    throw new EmailProviderConfigurationError("SMTP_PORT must be a positive integer.");
  }

  return { host, port, user, password, fromEmail, fromName };
}

export function assertSmtpEmailConfigured(): void {
  if (getEmailProviderMode() !== "smtp") {
    throw new EmailProviderConfigurationError("SMTP email provider is not enabled. Set EMAIL_PROVIDER=smtp.");
  }
  getSmtpEmailConfig();
}
