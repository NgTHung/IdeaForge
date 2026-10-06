import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import {
  calculateSimilarity,
  similarityComparisonResultSchema,
  similarityRequestSchema,
  similarityResultSchema,
} from "../src/lib/similarity.ts";
import { AI_RETRY_DELAY_MS } from "../src/lib/ai-policy.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { POST } = await import("../src/app/api/similarity/route.ts");

const variables = ["GEMINI_API_KEY", "GEMINI_EMBEDDING_MODEL", "GEMINI_EMBEDDING_FALLBACK_MODEL", "SIMILARITY_MIN_CENTERED_CARDS"];
let savedEnv;
let providerRequests;
let providerUrls;

beforeEach(() => {
  savedEnv = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  variables.forEach((key) => delete process.env[key]);
  process.env.GEMINI_API_KEY = "test-only-secret";
  globalThis.__IDEAFORGE_EMBEDDING_CACHE_V2__?.clear();
  providerRequests = [];
  providerUrls = [];
});

afterEach(() => {
  for (const key of variables) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.__IDEAFORGE_EMBEDDING_CACHE_V2__?.clear();
});

function paddedVector(values) {
  return Array.from({ length: 768 }, (_, index) => values[index] ?? 0);
}

function mockEmbeddings(t, vectorByText) {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = JSON.parse(init.body);
    providerRequests.push(body);
    providerUrls.push(String(url));
    const embeddings = body.requests.map((request) => {
      const text = request.content.parts[0].text;
      const vector = vectorByText.get(text);
      assert.ok(vector, `No test embedding configured for: ${text}`);
      return { values: paddedVector(vector) };
    });
    return Response.json({ embeddings });
  });
}

const cards = (texts) => texts.map((text, index) => ({ id: `card-${index}`, text }));
const request = (body) => new Request("http://localhost/api/similarity", {
  method: "POST",
  body: typeof body === "string" ? body : JSON.stringify(body),
});

test("request schema enforces card count, unique IDs, and text length", () => {
  assert.equal(similarityRequestSchema.safeParse({ cards: cards(["one", "two"]) }).success, true);
  assert.equal(similarityRequestSchema.safeParse({ cards: cards(["one"]) }).success, false);
  assert.equal(similarityRequestSchema.safeParse({ cards: cards(Array(51).fill("note")) }).success, false);
  assert.equal(similarityRequestSchema.safeParse({ cards: [{ id: "same", text: "one" }, { id: "same", text: "two" }] }).success, false);
  assert.equal(similarityRequestSchema.safeParse({ cards: [{ id: "a", text: "x".repeat(4001) }, { id: "b", text: "two" }] }).success, false);
  assert.equal(similarityRequestSchema.safeParse({ cards: [{ id: "a", text: " " }, { id: "b", text: "two" }] }).success, false);
});

test("route rejects invalid JSON and invalid card lists before calling Gemini", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Invalid input must not reach Gemini"));
  for (const body of ["{", {}, { cards: [{ id: "a", text: "one" }] }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
});

test("route reports a missing API key without calling Gemini", async (t) => {
  delete process.env.GEMINI_API_KEY;
  t.mock.method(globalThis, "fetch", () => assert.fail("Missing key must not reach Gemini"));
  const response = await POST(request({ cards: cards(["missing-alpha", "missing-beta"]) }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "missing_key");
});

test("small boards use symmetric nearest-neighbor rank scores", async (t) => {
  process.env.SIMILARITY_MIN_CENTERED_CARDS = "4";
  mockEmbeddings(t, new Map([
    ["rank-alpha", [1, 0]],
    ["rank-beta", [0.9, 0.1]],
    ["rank-gamma", [0, 1]],
  ]));

  const result = await calculateSimilarity(cards(["rank-alpha", "rank-beta", "rank-gamma"]));
  assert.equal(result.method, "nearest_neighbor_rank");
  assert.equal(result.centeredThreshold, 4);
  assert.equal(result.scores.length, 3);
  const pair = (left, right) => result.scores.find((score) => score.sourceId === left && score.targetId === right);
  assert.ok(pair("card-0", "card-1").score > pair("card-0", "card-2").score);
  assert.deepEqual(similarityResultSchema.parse(result), result);
});

test("boards at the configured threshold use mean-centered cosine and 768 dimensions", async (t) => {
  process.env.SIMILARITY_MIN_CENTERED_CARDS = "3";
  process.env.GEMINI_EMBEDDING_MODEL = "test-embedding";
  mockEmbeddings(t, new Map([
    ["center-alpha", [1, 0]],
    ["center-beta", [0, 1]],
    ["center-gamma", [-1, 0]],
  ]));

  const result = await calculateSimilarity(cards(["center-alpha", "center-beta", "center-gamma"]));
  assert.equal(result.method, "mean_centered_cosine");
  const oppositePair = result.scores.find((score) => score.sourceId === "card-0" && score.targetId === "card-2");
  assert.ok(Math.abs(oppositePair.score - -0.8) < 1e-10);
  assert.equal(providerRequests.length, 1);
  assert.ok(providerRequests[0].requests.every((request) => request.outputDimensionality === 768));
  assert.match(providerUrls[0], /models\/test-embedding/);
});

test("route returns pairwise scores from shared embedding calls", async (t) => {
  mockEmbeddings(t, new Map([
    ["route-alpha", [1, 0]],
    ["route-beta", [0, 1]],
  ]));

  const response = await POST(request({ cards: cards(["route-alpha", "route-beta"]) }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.method, "nearest_neighbor_rank");
  assert.equal(result.scores.length, 1);
  assert.equal(result.scores[0].sourceId, "card-0");
  assert.equal(result.scores[0].targetId, "card-1");
  assert.equal(providerRequests.length, 1);
});

test("comparison mode returns raw and centered cosine from one provider batch", async (t) => {
  process.env.GEMINI_EMBEDDING_MODEL = "comparison-embedding";
  process.env.SIMILARITY_MIN_CENTERED_CARDS = "3";
  mockEmbeddings(t, new Map([
    ["compare-alpha", [1, 0]],
    ["compare-beta", [0, 1]],
    ["compare-gamma", [-1, 0]],
  ]));

  const response = await POST(request({ compareMethods: true, cards: cards(["compare-alpha", "compare-beta", "compare-gamma"]) }));
  assert.equal(response.status, 200);
  const result = similarityComparisonResultSchema.parse(await response.json());
  assert.equal(result.method, "cosine_comparison");
  assert.equal(result.model, "comparison-embedding");
  assert.equal(result.rawScores.length, 3);
  assert.equal(result.centeredScores.length, 3);
  const rawOppositePair = result.rawScores.find((score) => score.sourceId === "card-0" && score.targetId === "card-2");
  const centeredOppositePair = result.centeredScores.find((score) => score.sourceId === "card-0" && score.targetId === "card-2");
  assert.equal(rawOppositePair.score, -1);
  assert.ok(Math.abs(centeredOppositePair.score - -0.8) < 1e-10);
  assert.equal(providerRequests.length, 1);
});

test("adding a note keeps old raw cosine fixed and recalculates old centered distances", async (t) => {
  process.env.GEMINI_EMBEDDING_MODEL = "dynamic-embedding";
  mockEmbeddings(t, new Map([
    ["dynamic-alpha", [1, 0]],
    ["dynamic-beta", [0, 1]],
    ["dynamic-gamma", [-1, 0]],
    ["dynamic-new-note", [1, 1]],
  ]));

  const beforeResponse = await POST(request({
    compareMethods: true,
    cards: cards(["dynamic-alpha", "dynamic-beta", "dynamic-gamma"]),
  }));
  const before = similarityComparisonResultSchema.parse(await beforeResponse.json());
  const afterResponse = await POST(request({
    compareMethods: true,
    cards: cards(["dynamic-alpha", "dynamic-beta", "dynamic-gamma", "dynamic-new-note"]),
  }));
  const after = similarityComparisonResultSchema.parse(await afterResponse.json());
  const alphaBeta = (scores) => scores.find((score) => score.sourceId === "card-0" && score.targetId === "card-1").score;

  assert.equal(beforeResponse.status, 200);
  assert.equal(afterResponse.status, 200);
  assert.equal(alphaBeta(after.rawScores), alphaBeta(before.rawScores));
  assert.notEqual(alphaBeta(after.centeredScores), alphaBeta(before.centeredScores));
  assert.equal(providerRequests.length, 2);
  assert.equal(providerRequests[1].requests.length, 1, "only the new note needs an embedding");
});

test("same card text is embedded once across concurrent and later requests", async (t) => {
  mockEmbeddings(t, new Map([
    ["cache-alpha", [1, 0]],
    ["cache-beta", [0, 1]],
  ]));
  const input = cards(["cache-alpha", "cache-beta"]);

  await Promise.all([calculateSimilarity(input), calculateSimilarity(input)]);
  await calculateSimilarity(input);

  assert.equal(providerRequests.length, 1);
  assert.equal(providerRequests[0].requests.length, 2);
});

test("fallback vectors are never mixed with primary-model vectors in one board", async (t) => {
  process.env.GEMINI_EMBEDDING_MODEL = "primary-embedding";
  process.env.GEMINI_EMBEDDING_FALLBACK_MODEL = "fallback-embedding";
  const fallbackVectors = new Map([
    ["fallback-alpha", [1, 0]],
    ["fallback-beta", [0, 1]],
  ]);
  const primaryVectors = new Map([
    ["fallback-alpha", [0, 1]],
    ["fresh-gamma", [1, 0]],
  ]);
  let primaryFailures = 0;
  t.mock.method(console, "error", () => {});
  const originalSetTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) =>
    originalSetTimeout(callback, delay === AI_RETRY_DELAY_MS ? 1 : delay, ...args));
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const model = String(url).match(/models\/([^:]+)/)[1];
    const body = JSON.parse(init.body);
    providerUrls.push(String(url));
    providerRequests.push(body);
    if (model === "primary-embedding" && primaryFailures < 2) {
      primaryFailures += 1;
      return Response.json({ error: { code: 503, message: "busy" } }, { status: 503 });
    }
    const vectorsByText = model === "fallback-embedding" ? fallbackVectors : primaryVectors;
    const embeddings = body.requests.map((request) => {
      const text = request.content.parts[0].text;
      const vector = vectorsByText.get(text);
      assert.ok(vector, `No vector configured for ${model}: ${text}`);
      return { values: paddedVector(vector) };
    });
    return Response.json({ embeddings });
  });

  await calculateSimilarity(cards(["fallback-alpha", "fallback-beta"]));
  assert.deepEqual(providerUrls.map((url) => url.match(/models\/([^:]+)/)[1]), [
    "primary-embedding", "primary-embedding", "fallback-embedding",
  ]);
  const cache = globalThis.__IDEAFORGE_EMBEDDING_CACHE_V2__;
  const fallbackEntries = await Promise.all(["fallback-alpha", "fallback-beta"].map((text) => cache.get(text)));
  assert.deepEqual(fallbackEntries.map((entry) => entry.model), ["fallback-embedding", "fallback-embedding"]);

  await calculateSimilarity(cards(["fallback-alpha", "fresh-gamma"]));
  assert.deepEqual(providerRequests[3].requests.map((request) => request.content.parts[0].text), ["fresh-gamma"]);
  assert.deepEqual(providerRequests[4].requests.map((request) => request.content.parts[0].text), ["fallback-alpha", "fresh-gamma"]);
  assert.match(providerUrls[4], /models\/primary-embedding/);
  const primaryEntries = await Promise.all(["fallback-alpha", "fresh-gamma"].map((text) => cache.get(text)));
  assert.deepEqual(primaryEntries.map((entry) => entry.model), ["primary-embedding", "primary-embedding"]);

  await calculateSimilarity(cards(["fallback-alpha", "fresh-gamma"]));
  assert.equal(providerRequests.length, 5);
});

test("embedding cache evicts the least recently used entry at its 2,000-item limit", async (t) => {
  const cache = globalThis.__IDEAFORGE_EMBEDDING_CACHE_V2__;
  const warmVector = paddedVector([1, 0]);
  for (let index = 0; index < 2_000; index += 1) {
    cache.set(`warm-${index}`, Promise.resolve({ model: "gemini-embedding-001", vector: warmVector }));
  }
  mockEmbeddings(t, new Map([["new-lru-text", [0, 1]]]));

  await calculateSimilarity(cards(["warm-0", "new-lru-text"]));

  assert.equal(cache.size, 2_000);
  assert.equal(cache.has("warm-0"), true);
  assert.equal(cache.has("warm-1"), false);
  assert.equal(cache.has("new-lru-text"), true);
  assert.deepEqual(providerRequests[0].requests.map((request) => request.content.parts[0].text), ["new-lru-text"]);
});
