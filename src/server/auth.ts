import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { sendAccountEmail } from "./email";
import { database, mongoClient } from "./mongodb";
import { env } from "./env";

export const auth = betterAuth({
  appName: "IdeaForge",
  baseURL: env.API_ORIGIN,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_ORIGIN],
  database: mongodbAdapter(database, { client: mongoClient }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAccountEmail(user.email, "Reset your IdeaForge password", url);
    },
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
