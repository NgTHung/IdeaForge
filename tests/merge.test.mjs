import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { POST } = await import("../src/app/api/merge/route.ts");
const payload = { goal: "Test goal", sources: [{ id: "a", text: "A" }, { id: "b", text: "B" }] };
let savedKey;

beforeEach((t) => {
  savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  t.mock.method(console, "error", () => {});
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedKey;
});

function mergeRequest(body) {
  return new Request("http://localhost/api/merge", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
}

test("bad JSON and invalid sources fail before provider calls", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Invalid input must not reach Gemini"));
  for (const body of ["{", {}, { ...payload, sources: [payload.sources[0], payload.sources[0]] }]) {
    assert.equal((await POST(mergeRequest(body))).status, 400);
  }
});

test("missing key response identifies the cause", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Missing key must not reach Gemini"));
  const response = await POST(mergeRequest(payload));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "missing_key");
});

test("merge returns the validated result from a mocked provider", async (t) => {
  process.env.GEMINI_API_KEY = "test-only-secret";
  const result = {
    status: "useful", reason: "", title: "Mocked concept", concept: "Mocked concept text", contributionA: "A contributes",
    contributionB: "B contributes", bridge: "A enables B", tension: "Mocked tension", assumptions: ["Mocked assumption"], nextExperiment: "Mocked experiment",
  };
  t.mock.method(globalThis, "fetch", async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }));
  const response = await POST(mergeRequest(payload));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.result, result);
  assert.equal(typeof body.model, "string");
  assert.ok(!Number.isNaN(Date.parse(body.generatedAt)));
});

test("merge reports invalid provider output with a safe error", async (t) => {
  process.env.GEMINI_API_KEY = "test-only-secret";
  t.mock.method(globalThis, "fetch", async () => Response.json({ candidates: [{ content: { parts: [{ text: "test-only-secret" }] } }] }));
  const response = await POST(mergeRequest(payload));
  assert.equal(response.status, 502);
  const error = await response.json();
  assert.equal(error.code, "invalid_output");
  assert.ok(!JSON.stringify(error).includes("test-only-secret"));
});
