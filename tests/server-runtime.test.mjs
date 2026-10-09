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

test("server modules load without credentials and configuration failures name settings without leaking values", async (t) => {
  const { getServerEnv } = await import("../src/server/env.ts");
  const { apiResponse } = await import("../src/server/http.ts");
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const { getMongo } = await import("../src/server/mongodb.ts");
  const { createBoardDirectoryHandlers } = await import("../src/server/board-directory.ts");
  const healthRoute = await import("../src/app/healthz/route.ts");
  assert.equal(typeof createBoardDirectoryHandlers, "function");
  assert.equal(typeof healthRoute.GET, "function");
  assert.throws(getServerEnv, /MONGODB_URI/);
  assert.throws(getMongo, /MONGODB_URI/);
  const missing = await apiResponse(async () => { getServerEnv(); return Response.json({ ok: true }); });
  assert.equal(missing.status, 503);
  assert.equal(missing.headers.get("cache-control"), "no-store");
  assert.deepEqual(await missing.json(), { error: "Server configuration is missing or invalid. Check: MONGODB_URI, BETTER_AUTH_SECRET." });
  assert.deepEqual(logs[0], ["API request failed", { cause: "server_configuration", fields: ["MONGODB_URI", "BETTER_AUTH_SECRET"] }]);

  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  process.env.BETTER_AUTH_SECRET = "test-auth-secret-with-at-least-32-characters";
  process.env.APP_ORIGIN = "http://localhost:3000/";
  process.env.GOOGLE_CLIENT_ID = "test-google-client";
  assert.throws(getServerEnv, /GOOGLE_CLIENT_SECRET/);
  process.env.GOOGLE_CLIENT_ID = "";
  process.env.GOOGLE_CLIENT_SECRET = "";
  process.env.SMTP_HOST = "smtp.example";
  assert.throws(getServerEnv, /SMTP_USER, SMTP_PASSWORD, SMTP_FROM/);
  process.env.BETTER_AUTH_SECRET = "secret-value";
  process.env.APP_ORIGIN = "not-a-url-containing-private-data";
  const invalid = await apiResponse(async () => { getServerEnv(); return Response.json({ ok: true }); });
  const invalidBody = await invalid.text();
  assert.equal(invalid.status, 503);
  assert.match(invalidBody, /APP_ORIGIN/);
  assert.match(invalidBody, /BETTER_AUTH_SECRET/);
  assert.doesNotMatch(invalidBody + JSON.stringify(logs), /secret-value|private-data|mongodb:\/\//);
  process.env.BETTER_AUTH_SECRET = "test-auth-secret-with-at-least-32-characters";
  process.env.APP_ORIGIN = "http://localhost:3000/";
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
