import type { EmailMessage, EmailProvider } from "./types";

/**
 * Deterministic development/test email provider. Validates the destination
 * and records the message in server logs only. This does not deliver email
 * to a real mailbox and must not be described as production delivery.
 */
export class DevelopmentEmailProvider implements EmailProvider {
  readonly name = "development";

  async send(message: EmailMessage): Promise<void> {
    const destination = message.to.trim();
    if (!destination || !destination.includes("@")) {
      throw new Error("A valid destination email address is required.");
    }

    if (process.env.NODE_ENV !== "test") {
      console.info("[development-email-provider]", {
        to: destination,
        subject: message.subject,
      });
    }
  }
}
