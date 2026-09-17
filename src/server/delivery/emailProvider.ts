import type { EmailProvider } from "./types";
import { DevelopmentEmailProvider } from "./developmentEmailProvider";
import { SmtpEmailProvider } from "./smtpEmailProvider";
import { getEmailProviderMode } from "./emailConfig";

let developmentProvider: EmailProvider | null = null;
let smtpProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  const mode = getEmailProviderMode();
  if (mode === "development") {
    if (!developmentProvider) {
      developmentProvider = new DevelopmentEmailProvider();
    }
    return developmentProvider;
  }

  if (!smtpProvider) {
    smtpProvider = new SmtpEmailProvider();
  }
  return smtpProvider;
}

export function resetEmailProvidersForTests(): void {
  developmentProvider = null;
  smtpProvider = null;
}
