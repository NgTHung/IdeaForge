import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import {
  calculateSimilarity,
  similarityRequestSchema,
  similarityResultSchema,
} from "../src/lib/similarity.ts";

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
  globalThis.__IDEAFORGE_EMBEDDING_CACHE__?.clear();
  providerRequests = [];
  providerUrls = [];
});

afterEach(() => {
  for (const key of variables) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.__IDEAFORGE_EMBEDDING_CACHE__?.clear();
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
