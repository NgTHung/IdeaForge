import "server-only";
import { z } from "zod";
import { ServerConfigurationError } from "./http";

const optionalNonempty = z.preprocess((value) => typeof value === "string" && !value.trim() ? undefined : value,
  z.string().trim().min(1).optional());

const envSchema = z.object({
  APP_ORIGIN: z.url({ protocol: /^https?$/ }).default("http://localhost:3000").transform((value) => new URL(value).origin),
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
    context.addIssue({ code: "custom", path: [value.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"],
      message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
  }

  const smtpKeys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"] as const;
  if (smtpKeys.some((key) => Boolean(value[key]))) {
    for (const key of smtpKeys.filter((key) => !value[key])) {
      context.addIssue({ code: "custom", path: [key],
        message: "Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM together." });
    }
  }
});

let env: z.infer<typeof envSchema> | undefined;

export function getServerEnv() {
  if (env) return env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = new Set(Object.keys(envSchema.shape));
    const fields = [...new Set(parsed.error.issues.map(({ path }) => String(path[0])).filter((key) => keys.has(key)))];
    throw new ServerConfigurationError(fields);
  }
  return env = parsed.data;
}
