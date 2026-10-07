import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import { AI_RETRY_DELAY_MS } from "../src/lib/ai-policy.ts";
import { assistantResponseSchema, resolveAliases } from "../src/lib/assistant.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { POST, maxDuration } = await import("../src/app/api/assistant/route.ts");
const payload = {
  goal: "Help students build a consistent study habit.",
  cards: [
    { id: "123e4567-e89b-12d3-a456-426614174000", title: "Daily challenge", content: "A short task feels easy to start." },
    { id: "123e4567-e89b-12d3-a456-426614174001", title: "Study partner", content: "A friend can check in after a study session." },
  ],
  relationships: [{
    source: "123e4567-e89b-12d3-a456-426614174000",
    target: "123e4567-e89b-12d3-a456-426614174001",
    type: "synergy",
    explanation: "A partner can encourage someone to complete a short task.",
  }],
  selectedCardId: "123e4567-e89b-12d3-a456-426614174000",
  message: "How could these ideas work together?",
  history: [],
};
const ids = payload.cards.map(({ id }) => id);
const variables = ["FEATHERLESS_API_KEY", "FEATHERLESS_MODEL", "FEATHERLESS_FALLBACK_MODEL", "FEATHERLESS_REASONING_EFFORT"];
let savedEnv;
let requests;
let errors;
let warnings;

beforeEach((t) => {
  savedEnv = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  variables.forEach((key) => delete process.env[key]);
  requests = [];
  errors = [];
  warnings = [];
  t.mock.method(console, "error", (...args) => errors.push(args));
  t.mock.method(console, "warn", (...args) => warnings.push(args));
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

function assistantRequest(body) {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function chat(value) {
  return { choices: [{ message: { content: JSON.stringify(value) } }] };
}

function mockProvider(t, outcomes) {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body), init });
    assert.ok(outcomes.length, "Unexpected extra provider attempt");
    const outcome = outcomes.shift();
    if (outcome instanceof Error) throw outcome;
    if (typeof outcome === "number") {
      return Response.json({ error: { code: outcome, message: "test-only-secret raw provider detail" } }, { status: outcome });
    }
    return Response.json(outcome);
  });
}

function baseReply(actions = []) {
  return {
    reply: [{ text: "A short challenge can pair with a friend's check-in.", cites: ["c1", "c2"] }],
    actions,
  };
}

test("mocked assistant route rejects malformed JSON and every request limit before provider calls", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  t.mock.method(globalThis, "fetch", () => assert.fail("Invalid input must not reach the provider"));
  const tooManyCards = Array.from({ length: 101 }, (_, index) => ({ id: "id-" + index, title: "", content: "" }));
  const tooMuchCardText = {
    ...payload,
    cards: [{ ...payload.cards[0], title: "x".repeat(2001), content: "y".repeat(2000) }],
    relationships: [],
    selectedCardId: undefined,
  };
  const tooMuchBoardText = {
    ...payload,
    cards: Array.from({ length: 11 }, (_, index) => ({ id: "id-" + index, title: "", content: "x".repeat(3900) })),
    relationships: [],
    selectedCardId: undefined,
  };
  const invalid = [
    "{",
    { ...payload, cards: tooManyCards, relationships: [], selectedCardId: undefined },
    tooMuchCardText,
    tooMuchBoardText,
    { ...payload, relationships: Array.from({ length: 501 }, () => payload.relationships[0]) },
    { ...payload, message: "x".repeat(2001) },
    { ...payload, history: Array.from({ length: 11 }, () => ({ role: "user", text: "Earlier question" })) },
    { ...payload, cards: [payload.cards[0], payload.cards[0]], relationships: [], selectedCardId: undefined },
    { ...payload, relationships: [{ ...payload.relationships[0], target: "unknown" }] },
    { ...payload, relationships: [{ ...payload.relationships[0], target: payload.relationships[0].source }] },
    { ...payload, selectedCardId: "unknown" },
    { ...payload, history: [{ role: "assistant", text: "x".repeat(6401) }] },
  ];
  for (const body of invalid) {
    const response = await POST(assistantRequest(body));
    assert.equal(response.status, 400);
    const error = await response.json();
    if (typeof body === "string") assert.equal(error.error, "Send valid JSON.");
    else assert.match(error.error, /4,000|limits|characters/i);
  }
});

test("mocked assistant translates aliases to real IDs for citations and every action kind", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  const first = baseReply([
    { kind: "create", why: "Combine the two ideas.", title: "Daily study pair", content: "A friend joins a short daily challenge.", basedOn: ["c1", "c2"] },
    { kind: "edit", why: "Clarify the challenge.", card: "c1", title: "Short daily challenge" },
    { kind: "link", why: "The partner extends the challenge.", source: "c1", target: "c2", type: "extends", explanation: "Check-ins can encourage completion." },
  ]);
  const second = {
    reply: [{ text: "These two ideas (c1) could be explored together (c2).", cites: ["c1", "c2"] }],
    actions: [{ kind: "merge", why: "Both cards describe compatible study support.", a: "c1", b: "c2" }],
  };
  mockProvider(t, [chat(first), chat(second)]);

  const firstResponse = await POST(assistantRequest(payload));
  const firstBody = await firstResponse.json();
  assert.equal(firstResponse.status, 200);
  assert.deepEqual(firstBody.result.reply[0].cites, ids);
  assert.deepEqual(firstBody.result.actions.map((action) => action.kind), ["create", "edit", "link"]);
  assert.deepEqual(firstBody.result.actions[0].basedOn, ids);
  assert.equal(firstBody.result.actions[1].card, ids[0]);
  assert.deepEqual([firstBody.result.actions[2].source, firstBody.result.actions[2].target], ids);
  assert.equal(typeof firstBody.model, "string");
  assert.ok(!Number.isNaN(Date.parse(firstBody.generatedAt)));

  const secondResponse = await POST(assistantRequest(payload));
  const secondBody = await secondResponse.json();
  assert.equal(secondResponse.status, 200);
  assert.deepEqual(secondBody.result.actions[0], { kind: "merge", why: "Both cards describe compatible study support.", a: ids[0], b: ids[1] });
  assert.equal(secondBody.result.reply[0].text, "These two ideas could be explored together.");

  for (const request of requests) {
    const prompt = request.body.messages[1].content;
    const parsedPrompt = JSON.parse(prompt);
    assert.deepEqual(parsedPrompt.cards.map(({ id }) => id), ["c1", "c2"]);
    assert.deepEqual([parsedPrompt.relationships[0].source, parsedPrompt.relationships[0].target], ["c1", "c2"]);
    assert.equal(parsedPrompt.selectedCard, "c1");
    assert.ok(!prompt.includes(ids[0]));
    assert.ok(!prompt.includes(ids[1]));
  }
});

test("assistant removes links already saved on the board and repeated link actions", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  mockProvider(t, [chat(baseReply([
    { kind: "link", why: "Already saved.", source: "c2", target: "c1", type: "synergy", explanation: "Duplicate." },
    { kind: "link", why: "New direction.", source: "c1", target: "c2", type: "extends", explanation: "A partner extends the challenge." },
    { kind: "link", why: "Repeated direction.", source: "c1", target: "c2", type: "extends", explanation: "Repeated." },
  ]))]);
  const response = await POST(assistantRequest(payload));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.result.actions, [{
    kind: "link", why: "New direction.", source: ids[0], target: ids[1], type: "extends", explanation: "A partner extends the challenge.",
  }]);
  assert.deepEqual(warnings, [["Assistant output items removed", { citations: 0, actions: 2 }]]);
});

test("mocked assistant allows an empty board and sends no selected card alias", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  mockProvider(t, [chat({
    reply: [{ text: "No board card is relevant to this question.", cites: [] }],
    actions: [],
  })]);
  const response = await POST(assistantRequest({
    goal: payload.goal,
    cards: [],
    relationships: [],
    message: "What is outside this board?",
  }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result.reply[0].cites, []);
  assert.equal(JSON.parse(requests[0].body.messages[1].content).selectedCard, null);
});

test("mocked assistant removes unknown or same-card references and logs counts only", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  mockProvider(t, [chat({
    reply: [{ text: "The first card is relevant.", cites: ["c1", "c99", "c1"] }],
    actions: [
      { kind: "link", why: "Invalid same-card link.", source: "c1", target: "c1", type: "synergy", explanation: "Invalid." },
      { kind: "merge", why: "Invalid same-card merge.", a: "c2", b: "c2" },
      { kind: "edit", why: "Unknown card.", card: "c42", title: "Changed" },
    ],
  })]);
  const response = await POST(assistantRequest(payload));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.result.reply[0].cites, [ids[0]]);
  assert.deepEqual(body.result.actions, []);
  assert.deepEqual(warnings, [["Assistant output items removed", { citations: 2, actions: 3 }]]);
  assert.ok(!JSON.stringify(warnings).includes("A short task feels easy to start."));

  const sanitized = resolveAliases({
    reply: [{ text: "The first card is relevant.", cites: ["c1", "c99", "c1"] }],
    actions: [
      { kind: "create", why: "Unknown source.", title: "No source", content: "Discard me.", basedOn: ["c99"] },
      { kind: "create", why: "One source is valid.", title: "Valid idea", content: "Keep this.", basedOn: ["c1", "c99"] },
    ],
  }, new Map([["c1", ids[0]], ["c2", ids[1]]]));
  assert.deepEqual(sanitized.removed, { citations: 2, actions: 1 });
  assert.deepEqual(sanitized.result.reply[0].cites, [ids[0]]);
  assert.deepEqual(sanitized.result.actions, [{
    kind: "create",
    why: "One source is valid.",
    title: "Valid idea",
    content: "Keep this.",
    basedOn: [ids[0]],
  }]);
});

test("mocked assistant reports missing provider credentials without calling fetch", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Missing credentials must not reach the provider"));
  const response = await POST(assistantRequest(payload));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "missing_key");
});

test("mocked invalid provider output returns a safe error without the secret", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  mockProvider(t, [{ choices: [{ message: { content: "test-only-secret is not JSON" } }] }]);
  const response = await POST(assistantRequest(payload));
  assert.equal(response.status, 502);
  const error = await response.json();
  assert.equal(error.code, "invalid_output");
  assert.ok(!JSON.stringify(error).includes("test-only-secret"));
  assert.ok(!JSON.stringify(errors).includes("test-only-secret"));
});

test("mocked provider overload retries and returns the safe overload cause", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  mockProvider(t, [503, 503]);
  const response = await POST(assistantRequest(payload));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "provider_overload");
  assert.equal(requests.length, 2);
});

test("assistant route uses the 95-second AI budget", () => {
  assert.equal(maxDuration, 95);
});

test("assistant response schema validates the route envelope for the browser", () => {
  const response = {
    result: {
      reply: [{ text: "Daily challenge makes a small start easier.", cites: [ids[0]] }],
      actions: [{ kind: "create", why: "Connect the two approaches.", title: "A shared routine", content: "Pair a short task with a check-in.", basedOn: ids }],
    },
    model: "zai-org/GLM-5.3-Flash",
    generatedAt: "2026-10-07T10:30:00.000Z",
  };
  assert.equal(assistantResponseSchema.safeParse(response).success, true);
  assert.equal(assistantResponseSchema.safeParse({ ...response, model: " " }).success, false);
  assert.equal(assistantResponseSchema.safeParse({ ...response, generatedAt: "yesterday" }).success, false);
});
