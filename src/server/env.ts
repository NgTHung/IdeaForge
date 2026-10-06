import { z } from "zod";

const optionalNonempty = z.string().trim().min(1).optional();

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_ORIGIN: z.url().default("http://localhost:4000"),
  APP_ORIGIN: z.url().default("http://localhost:3000"),
  MONGODB_URI: z.string().trim().min(1),
  MONGODB_DB_NAME: z.string().trim().min(1).default("ideaforge_dev"),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: optionalNonempty,
  GOOGLE_CLIENT_SECRET: optionalNonempty,
  SMTP_HOST: optionalNonempty,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalNonempty,
  SMTP_PASSWORD: optionalNonempty,
  SMTP_FROM: optionalNonempty,
}).superRefine((value, context) => {
  if (Boolean(value.GOOGLE_CLIENT_ID) !== Boolean(value.GOOGLE_CLIENT_SECRET)) {
    context.addIssue({ code: "custom", message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
  }

  const smtpValues = [value.SMTP_HOST, value.SMTP_USER, value.SMTP_PASSWORD, value.SMTP_FROM];
  if (smtpValues.some(Boolean) && !smtpValues.every(Boolean)) {
    context.addIssue({ code: "custom", message: "Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM together." });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map(({ path, message }) => `${path.join(".") || "environment"}: ${message}`).join("\n");
  throw new Error(`Invalid API configuration:\n${details}`);
}

export const env = parsed.data;
