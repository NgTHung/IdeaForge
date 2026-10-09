import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (context.parentURL?.startsWith(new URL("../src/", import.meta.url).href) && specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

for (const key of ["MONGODB_URI", "BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
  "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"]) delete process.env[key];

test("server modules load without account credentials and configuration is validated only on use", async () => {
  const { getServerEnv } = await import("../src/server/env.ts");
  const { getMongo } = await import("../src/server/mongodb.ts");
  const { createBoardDirectoryHandlers } = await import("../src/server/board-directory.ts");
  const healthRoute = await import("../src/app/healthz/route.ts");
  assert.equal(typeof createBoardDirectoryHandlers, "function");
  assert.equal(typeof healthRoute.GET, "function");
  assert.throws(getServerEnv, /MONGODB_URI/);
  assert.throws(getMongo, /Invalid server configuration/);

  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  process.env.BETTER_AUTH_SECRET = "test-auth-secret-with-at-least-32-characters";
  process.env.APP_ORIGIN = "http://localhost:3000/";
  process.env.GOOGLE_CLIENT_ID = "test-google-client";
  assert.throws(getServerEnv, /Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);
  process.env.GOOGLE_CLIENT_ID = "";
  process.env.GOOGLE_CLIENT_SECRET = "";
  process.env.SMTP_HOST = "smtp.example";
  assert.throws(getServerEnv, /Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM together/);
  process.env.SMTP_HOST = "";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASSWORD = "";
  process.env.SMTP_FROM = "";
  const config = getServerEnv();
  assert.equal(config.APP_ORIGIN, "http://localhost:3000");
  assert.equal(config.GOOGLE_CLIENT_ID, undefined);
  assert.equal(config.SMTP_HOST, undefined);
  assert.equal(getServerEnv(), config);
  assert.equal(getMongo().client, getMongo().client);
});
