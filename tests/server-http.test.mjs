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
