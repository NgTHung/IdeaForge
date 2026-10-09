import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { sendAccountEmail } from "./email";
import { getMongo } from "./mongodb";
import { getServerEnv } from "./env";
import { signupPasswordError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

function createAuth() {
  const env = getServerEnv();
  const { database, client: mongoClient } = getMongo();
  return betterAuth({
    appName: "IdeaForge",
    baseURL: env.APP_ORIGIN,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_ORIGIN],
    database: mongodbAdapter(database, { client: mongoClient }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAccountEmail(user.email, "Reset your IdeaForge password", url);
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== "/sign-up/email") return;
        const password = (context.body as { password?: unknown } | undefined)?.password;
        const error = typeof password === "string" ? signupPasswordError(password) : "Enter a valid password.";
        if (error) throw APIError.from("BAD_REQUEST", { code: "INVALID_PASSWORD", message: error });
      }),
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendAccountEmail(user.email, "Verify your IdeaForge email", url);
      },
    },
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          socialProviders: {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              requireEmailVerification: true,
            },
          },
        }
      : {}),
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return auth ??= createAuth();
}
