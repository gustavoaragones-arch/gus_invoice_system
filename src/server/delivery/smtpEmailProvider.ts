import nodemailer from "nodemailer";
import type { EmailMessage, EmailProvider } from "./types";
import { getSmtpEmailConfig } from "./emailConfig";

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";

  async send(message: EmailMessage): Promise<void> {
    const config = getSmtpEmailConfig();
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    await transport.sendMail({
      from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });
  }
}
