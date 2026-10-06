import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { z } from "zod";
import { AiError, aiErrorResponse, embedTexts, generateJson } from "../src/lib/ai.ts";
import { AI_ATTEMPT_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS, AI_RETRY_DELAY_MS } from "../src/lib/ai-policy.ts";

const schema = z.object({ title: z.string().min(1) });
const request = { contents: "Test notes", config: { systemInstruction: "Test instruction" } };
const result = { title: "Mocked concept" };
const variables = ["GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_FALLBACK_MODEL", "GEMINI_EMBEDDING_MODEL", "GEMINI_EMBEDDING_FALLBACK_MODEL"];
let savedEnv;
let requests;
let logs;

beforeEach((t) => {
  savedEnv = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  variables.forEach((key) => delete process.env[key]);
  process.env.GEMINI_API_KEY = "test-only-secret";
  requests = [];
  logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const originalSetTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) =>
    originalSetTimeout(callback, delay === AI_RETRY_DELAY_MS ? 1 : delay, ...args));
});

afterEach(() => {
  for (const key of variables) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function mockProvider(t, outcomes) {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body), init });
    assert.ok(outcomes.length, "Unexpected extra provider attempt");
    const outcome = outcomes.shift();
    if (outcome instanceof Error) throw outcome;
    if (typeof outcome === "function") return outcome(init);
    if (typeof outcome === "number") {
      return Response.json({ error: { code: outcome, message: "test-only-secret raw provider detail" } }, { status: outcome });
    }
    return Response.json(outcome);
  });
}

function generated(value = result) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] };
}

function models() {
  return requests.map(({ url }) => url.match(/models\/([^:/]+)/)[1]);
}

test("embedding-2 sends each note as a separate content", async (t) => {
  process.env.GEMINI_EMBEDDING_MODEL = "gemini-embedding-2";
  mockProvider(t, [{ embeddings: [{ values: [1, 0] }, { values: [0, 1] }] }]);
  const result = await embedTexts(["First note", "Second note"], { outputDimensionality: 2 });
  assert.deepEqual(result.vectors, [[1, 0], [0, 1]]);
  assert.deepEqual(requests[0].body.requests.map((request) => request.content.parts), [[{ text: "First note" }], [{ text: "Second note" }]]);
});

async function expectFailure(operation, code, attempts) {
  await assert.rejects(operation, (error) => error instanceof AiError && error.code === code);
  assert.equal(requests.length, attempts);
  assert.ok(!JSON.stringify(logs).includes("test-only-secret"));
}

test("generation preserves request, validates output, and uses the configured primary", async (t) => {
  process.env.GEMINI_MODEL = "test-primary";
  mockProvider(t, [generated()]);
  assert.deepEqual(await generateJson(request, schema), result);
  assert.deepEqual(models(), ["test-primary"]);
  assert.equal(requests[0].body.systemInstruction.parts[0].text, request.config.systemInstruction);
  assert.equal(requests[0].body.generationConfig.responseMimeType, "application/json");
  assert.ok(requests[0].body.generationConfig.responseJsonSchema);
  assert.equal(requests[0].init.headers.get("x-server-timeout"), "30");
  assert.equal(logs.length, 0);
});

test("malformed provider HTTP JSON reports invalid output without retry", async (t) => {
  process.env.GEMINI_FALLBACK_MODEL = "test-fallback";
  mockProvider(t, [() => new Response("not JSON", { status: 200 })]);
  await expectFailure(() => generateJson(request, schema), "invalid_output", 1);
});

test("overload retries the primary once and stops on success", async (t) => {
  process.env.GEMINI_FALLBACK_MODEL = "test-fallback";
  mockProvider(t, [503, generated()]);
  assert.deepEqual(await generateJson(request, schema), result);
  assert.deepEqual(models(), ["gemini-2.5-flash", "gemini-2.5-flash"]);
  assert.deepEqual(logs[0][1], { model: "gemini-2.5-flash", attempt: 1, code: "provider_overload", providerStatus: 503 });
});

test("two transient failures lead to one fallback with the same input and schema", async (t) => {
  process.env.GEMINI_FALLBACK_MODEL = "test-fallback";
  mockProvider(t, [503, 504, generated()]);
  assert.deepEqual(await generateJson(request, schema), result);
  assert.deepEqual(models(), ["gemini-2.5-flash", "gemini-2.5-flash", "test-fallback"]);
  assert.deepEqual(requests[0].body, requests[2].body);
});

test("fallback failures stop after three attempts and report the final cause", async (t) => {
  process.env.GEMINI_FALLBACK_MODEL = "test-fallback";
  mockProvider(t, [503, 503, 504]);
  await expectFailure(() => generateJson(request, schema), "timeout", 3);
  assert.equal(logs[2][1].model, "test-fallback");
});

test("quota exhaustion without fallback stops after two attempts", async (t) => {
  mockProvider(t, [429, 429]);
  await expectFailure(() => generateJson(request, schema), "provider_overload", 2);
});

test("a fallback equal to the primary does not add a third attempt", async (t) => {
  process.env.GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";
  mockProvider(t, [503, 503]);
  await expectFailure(() => generateJson(request, schema), "provider_overload", 2);
});

test("SDK aborts and timeout errors retry and reach the fallback", async (t) => {
  process.env.GEMINI_FALLBACK_MODEL = "test-fallback";
  mockProvider(t, [new DOMException("aborted", "AbortError"), new DOMException("timed out", "TimeoutError"), generated()]);
  assert.deepEqual(await generateJson(request, schema), result);
  assert.equal(requests.length, 3);
  assert.ok(logs.every((entry) => entry[1].code === "timeout"));
});

test("the SDK timeout aborts each hung fetch with a fresh signal", async (t) => {
  const originalSetTimeout = globalThis.setTimeout;
  const timeouts = [];
  t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) => {
    timeouts.push(delay);
    return originalSetTimeout(callback, delay === AI_ATTEMPT_TIMEOUT_MS ? 5 : delay, ...args);
  });
  const hungRequest = (init) => new Promise((resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  mockProvider(t, [hungRequest, hungRequest]);
  await expectFailure(() => generateJson(request, schema), "timeout", 2);
  assert.equal(timeouts.filter((delay) => delay === AI_ATTEMPT_TIMEOUT_MS).length, 2);
  assert.notEqual(requests[0].init.signal, requests[1].init.signal);
  assert.ok(AI_REQUEST_TIMEOUT_MS > 3 * AI_ATTEMPT_TIMEOUT_MS + AI_RETRY_DELAY_MS);
});

for (const [label, response] of [
  ["schema mismatch", generated({ title: "" })],
  ["malformed JSON", { candidates: [{ content: { parts: [{ text: "not JSON" }] } }] }],
  ["empty output", {}],
]) {
  test(`${label} reports invalid output without retry or fallback`, async (t) => {
    process.env.GEMINI_FALLBACK_MODEL = "test-fallback";
    mockProvider(t, [response]);
    await expectFailure(() => generateJson(request, schema), "invalid_output", 1);
  });
}

for (const status of [400, 401, 403, 404, 500]) {
  test(`HTTP ${status} stops immediately without leaking provider details`, async (t) => {
    process.env.GEMINI_FALLBACK_MODEL = "test-fallback";
    mockProvider(t, [status]);
    await expectFailure(() => generateJson(request, schema), "provider_error", 1);
  });
}

test("missing or blank key prevents generation and embedding calls", async (t) => {
  mockProvider(t, []);
  for (const value of [undefined, "  "]) {
    if (value === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = value;
    await expectFailure(() => generateJson(request, schema), "missing_key", 0);
    await expectFailure(() => embedTexts(["Test note"]), "missing_key", 0);
  }
});

test("embeddings retry and use only their configured embedding fallback", async (t) => {
  process.env.GEMINI_FALLBACK_MODEL = "generation-only";
  process.env.GEMINI_EMBEDDING_MODEL = "test-embedding";
  process.env.GEMINI_EMBEDDING_FALLBACK_MODEL = "embedding-fallback";
  mockProvider(t, [503, 503, { embeddings: [{ values: [1, 2] }, { values: [3, 4] }] }]);
  const embedded = await embedTexts(["A", "B"], { outputDimensionality: 2 });
  assert.deepEqual(embedded.vectors, [[1, 2], [3, 4]]);
  assert.equal(embedded.model, "embedding-fallback");
  assert.deepEqual(models(), ["test-embedding", "test-embedding", "embedding-fallback"]);
  assert.deepEqual(requests[0].body.requests.map((entry) => entry.content.parts[0].text), ["A", "B"]);
  assert.ok(requests.every(({ body }) => body.requests.every((entry) => entry.outputDimensionality === 2)));
});

test("generation fallback is never used for embeddings", async (t) => {
  process.env.GEMINI_FALLBACK_MODEL = "generation-only";
  mockProvider(t, [503, 503]);
  await expectFailure(() => embedTexts(["A"]), "provider_overload", 2);
  assert.deepEqual(models(), ["gemini-embedding-001", "gemini-embedding-001"]);
});

for (const embeddings of [undefined, [], [null], [{ values: [] }], [{ values: [1] }], [{ values: [1, null] }], [{ values: [1, 2] }, { values: [1] }]]) {
  test(`invalid embedding output ${JSON.stringify(embeddings)} stops immediately`, async (t) => {
    process.env.GEMINI_EMBEDDING_FALLBACK_MODEL = "embedding-fallback";
    mockProvider(t, [{ embeddings }]);
    await expectFailure(() => embedTexts(["A"], { outputDimensionality: 2 }), "invalid_output", 1);
  });
}

test("embedding vectors must have matching dimensions", async (t) => {
  mockProvider(t, [{ embeddings: [{ values: [1, 2] }, { values: [3] }] }]);
  await expectFailure(() => embedTexts(["A", "B"]), "invalid_output", 1);
});

test("empty embedding inputs fail before calling the provider", async (t) => {
  mockProvider(t, []);
  await assert.rejects(() => embedTexts([]), TypeError);
  await assert.rejects(() => embedTexts(["  "]), TypeError);
  assert.equal(requests.length, 0);
});

test("browser responses name causes and use safe messages and statuses", async () => {
  for (const [code, status] of [["missing_key", 503], ["provider_overload", 503], ["timeout", 504], ["invalid_output", 502], ["provider_error", 502]]) {
    const response = aiErrorResponse(new AiError(code));
    assert.equal(response.status, status);
    const payload = await response.json();
    assert.equal(payload.code, code);
    assert.ok(payload.error.length > 0);
  }
  const payload = await aiErrorResponse(new Error("test-only-secret")).json();
  assert.equal(payload.code, "provider_error");
  assert.ok(!payload.error.includes("test-only-secret"));
});
