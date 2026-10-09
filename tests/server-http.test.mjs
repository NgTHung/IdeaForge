import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoClient, MongoParseError } from "mongodb";
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

test("MongoDB parse failures log fixed reasons without exposing driver messages", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const cases = [
    ['"mongodb://private-user:private-password@localhost"', "invalid_scheme"],
    ["mongodb://private-user:private-password%zz@localhost", "invalid_percent_encoding"],
    ["mongodb://private#user:private-password@localhost", "unescaped_username"],
    ["mongodb://private-user:private#password@localhost", "unescaped_password"],
    ["mongodb://@localhost", "empty_credentials"],
    ["mongodb+srv://private-user:private-password@one.example.com,two.example.com", "srv_multiple_hosts"],
    ["mongodb+srv://private-user:private-password@one.example.com:27017", "srv_port"],
    ["mongodb://private-user:private-password@localhost/?private-token=value", "unsupported_options"],
    ["mongodb://", "invalid_uri"],
  ];
  for (const [uri, reason] of cases) {
    const response = await apiResponse(async () => { new MongoClient(uri); return Response.json({}); });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "The request could not be completed." });
    assert.deepEqual(logs.at(-1), ["API request failed", { cause: "MongoParseError", reason }]);
  }
  for (const message of [
    "Multiple text records not allowed",
    "Text record may only set any of: authSource, replicaSet, loadBalanced",
    "Cannot have empty URI params in DNS TXT Record",
  ]) {
    await apiResponse(async () => { throw new MongoParseError(message); });
    assert.deepEqual(logs.at(-1), ["API request failed", { cause: "MongoParseError", reason: "invalid_dns_txt" }]);
  }
  await apiResponse(async () => { throw new MongoParseError("unknown failure: private-password mongodb://private-user@localhost"); });
  assert.deepEqual(logs.at(-1), ["API request failed", { cause: "MongoParseError", reason: "unknown_parse_error" }]);
  assert.doesNotMatch(JSON.stringify(logs), /private|mongodb:\/\/|records not allowed/);
});

test("MongoDB URIs without a database path accept a separately selected database", () => {
  for (const uri of ["mongodb://user:password@localhost", "mongodb+srv://user:password@cluster.example.com"]) {
    const client = new MongoClient(uri);
    assert.equal(client.db("ideaforge_dev").databaseName, "ideaforge_dev");
  }
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
