import type { EmailProvider } from "./types";
import { DevelopmentEmailProvider } from "./developmentEmailProvider";

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  const configured = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (configured && configured !== "development") {
    throw new Error(
      "Production email delivery is not configured in this environment. Set EMAIL_PROVIDER=development for local/test use.",
    );
  }

  provider = new DevelopmentEmailProvider();
  return provider;
}
