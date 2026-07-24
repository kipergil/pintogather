import nodemailer, { type Transporter } from "nodemailer";

/**
 * Null until SMTP_HOST is set — every call site checks this and no-ops
 * instead, mirroring the Stripe/Anthropic clients elsewhere, so the app
 * runs fine before email is configured. Uses the same Elestio-hosted SMTP
 * relay as the Directus instance's own transactional email, not a
 * third-party email API — plain SMTP via nodemailer.
 */
export const emailTransport: Transporter | null = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  : null;

export const EMAIL_FROM = process.env.SMTP_FROM || "PinTogather <no-reply@pintogather.app>";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Best-effort send — logs and returns false on failure rather than throwing, since a broken email send should never block the action that triggered it (e.g. creating an invitation). */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!emailTransport) {
    console.warn(`Email not configured (SMTP_HOST unset) — skipped sending "${input.subject}" to ${input.to}`);
    return false;
  }

  try {
    await emailTransport.sendMail({ from: EMAIL_FROM, ...input });
    return true;
  } catch (error) {
    console.error(`Failed to send email "${input.subject}" to ${input.to}:`, error);
    return false;
  }
}
