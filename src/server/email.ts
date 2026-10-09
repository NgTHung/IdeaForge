import "server-only";
import nodemailer from "nodemailer";
import { getServerEnv } from "./env";

export async function sendAccountEmail(to: string, subject: string, url: string) {
  const env = getServerEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    throw new Error("Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM to send account email.");
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text: `Continue to IdeaForge using this link:\n\n${url}`,
  });
}
