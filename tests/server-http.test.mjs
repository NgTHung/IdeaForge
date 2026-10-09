import assert from "node:assert/strict";
import { test } from "node:test";
import { apiResponse } from "../src/server/http.ts";

test("API responses preserve redirects and separate account cookies while disabling caching", async () => {
  const redirect = await apiResponse(async () => Response.redirect("http://app.example/dashboard", 302));
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), "http://app.example/dashboard");
  assert.equal(redirect.headers.get("cache-control"), "no-store");

  const headers = new Headers();
  headers.append("Set-Cookie", "session=abc; HttpOnly; Path=/");
  headers.append("Set-Cookie", "oauth=xyz; HttpOnly; Path=/");
  const cookies = await apiResponse(async () => new Response("ok", { headers }));
  assert.deepEqual(cookies.headers.getSetCookie(), headers.getSetCookie());
  assert.equal(await cookies.text(), "ok");
});

test("unexpected API failures log only an allowlisted category and keep exception messages private", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const error = new Error("mongodb://user:private-password@database");
  error.name = "MongoServerSelectionError";
  const response = await apiResponse(async () => { throw error; });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "The request could not be completed." });
  assert.deepEqual(logs[0], ["API request failed", { cause: "MongoServerSelectionError" }]);
  error.name = "private-password";
  await apiResponse(async () => { throw error; });
  assert.deepEqual(logs[1], ["API request failed", { cause: "unexpected_error" }]);
  assert.doesNotMatch(JSON.stringify(logs), /private-password|mongodb:\/\//);
});
