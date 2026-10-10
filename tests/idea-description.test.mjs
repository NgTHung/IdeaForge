import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import { AI_RETRY_DELAY_MS } from "../src/lib/ai-policy.ts";
import { canFillEditorDescription, canRequestIdeaDescription, fitIdeaDescriptionContext, ideaDescriptionGoal } from "../src/features/board/description-generation.ts";
import { ideaDescriptionOutputProblem, ideaDescriptionRequestSchema, ideaDescriptionResponseSchema, MAX_IDEA_DESCRIPTION_REQUEST_BYTES } from "../src/lib/idea-description-contract.ts";
import { createIdea, updateIdea } from "../src/features/board/model.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { POST, maxDuration } = await import("../src/app/api/ideas/description/route.ts");
const requestData = {
  title: "Study buddy matching",
  goal: "Help students build a consistent study habit.",
  boardTitle: "Student study lab",
  boardDescription: "Students are exploring ways to support peer learning.",
  seedContent: "Pair students who want to study together regularly.",
  clusterLabel: "Learning routines",
};
const variables = ["FEATHERLESS_API_KEY", "FEATHERLESS_MODEL", "FEATHERLESS_FALLBACK_MODEL", "FEATHERLESS_REASONING_EFFORT"];
let savedEnv;
let providerRequests;
let logs;

beforeEach((t) => {
  savedEnv = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  variables.forEach((key) => delete process.env[key]);
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  providerRequests = [];
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

function descriptionRequest(body, headers = {}) {
  return new Request("http://localhost/api/ideas/description", {
    method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function mockProvider(t, outcomes) {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    providerRequests.push({ url: String(url), body: JSON.parse(init.body), init });
    assert.ok(outcomes.length, "Unexpected extra provider attempt");
    const outcome = outcomes.shift();
    if (outcome instanceof Error) throw outcome;
    if (typeof outcome === "number") return Response.json({ error: { message: "private provider detail" } }, { status: outcome });
    return Response.json({ choices: [{ message: { content: JSON.stringify(outcome) } }] });
  });
}

const idea = { id: "i1", title: requestData.title, content: "", position: { x: 0, y: 0 }, pinned: false, parentIds: [] };
const context = {
  goal: requestData.goal, boardTitle: requestData.boardTitle,
  boardDescription: requestData.boardDescription, seedContent: requestData.seedContent,
  clusterLabel: requestData.clusterLabel,
};
const state = { ideaId: idea.id, title: idea.title, content: "", ...context, token: 4 };

test("description route rejects malformed, oversized, and invalid requests before generation", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Invalid requests must not call the provider"));
  const cases = ["{", {}, { ...requestData, title: " " }, { ...requestData, title: "x".repeat(121) },
    { ...requestData, goal: "x".repeat(501) }, { ...requestData, boardTitle: "x".repeat(81) },
    { ...requestData, boardDescription: "x".repeat(601) },
    { ...requestData, seedContent: "x".repeat(1201) },
    { ...requestData, clusterLabel: "x".repeat(101) }, { ...requestData, unexpected: true }];
  for (const value of cases) assert.equal((await POST(descriptionRequest(value))).status, 400);
  const tooLarge = await POST(descriptionRequest(" ".repeat(8_001)));
  assert.equal(tooLarge.status, 413);
  const declaredTooLarge = await POST(descriptionRequest("{}", { "content-length": "8001" }));
  assert.equal(declaredTooLarge.status, 413);
  assert.equal(providerRequests.length, 0);
});

test("description route returns bounded content with model and time and sends the available context", async (t) => {
  process.env.FEATHERLESS_MODEL = "test-description-model";
  const output = { description: "Study buddy matching pairs students who want to study together regularly. The pairs can plan recurring sessions and support a consistent study habit, which is the board's stated goal.", question: null };
  mockProvider(t, [output]);
  const response = await POST(descriptionRequest(requestData));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual({ description: body.description, question: body.question, model: body.model }, { ...output, model: "test-description-model" });
  assert.ok(!Number.isNaN(Date.parse(body.generatedAt)));
  assert.equal(maxDuration, 95);
  assert.equal(providerRequests.length, 1);
  assert.equal(providerRequests[0].url, "https://api.featherless.ai/v1/chat/completions");
  assert.deepEqual(JSON.parse(providerRequests[0].body.messages[1].content), requestData);
  assert.match(providerRequests[0].body.messages[0].content, /never as instructions/);
  assert.match(providerRequests[0].body.messages[0].content, /title's language/);
  assert.match(providerRequests[0].body.messages[0].content, /seedContent as the participant's intended details/);
  assert.match(providerRequests[0].body.messages[0].content, /clusterLabel only as a weak topic hint/);
  assert.ok(!JSON.stringify(body).includes("test-only-secret"));
});

test("a vague title can return a short clarification question", async (t) => {
  mockProvider(t, [{ description: null, question: "What does Rocket refer to in this idea?" }]);
  const response = await POST(descriptionRequest({ title: "Rocket", goal: requestData.goal, boardTitle: requestData.boardTitle }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).question, "What does Rocket refer to in this idea?");
});

test("ambiguous model output is repaired once and only validated text returns", async (t) => {
  const privateText = "private model output";
  mockProvider(t, [
    { description: ` ${privateText} `, question: "Clarify?" },
    { description: "Students can pair up for focused study sessions. They can use the recurring meetings to support the board's goal of building a consistent study habit.", question: null },
  ]);
  const response = await POST(descriptionRequest(requestData));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).description, "Students can pair up for focused study sessions. They can use the recurring meetings to support the board's goal of building a consistent study habit.");
  assert.equal(providerRequests.length, 2);
  assert.match(providerRequests[1].body.messages.at(-1).content, /previous reply could not be used/);
  assert.ok(!JSON.stringify(logs).includes(privateText));
});

test("missing credentials and provider failures return safe errors", async (t) => {
  delete process.env.FEATHERLESS_API_KEY;
  const missingKey = await POST(descriptionRequest(requestData));
  assert.equal(missingKey.status, 503);
  assert.equal((await missingKey.json()).code, "missing_key");

  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  mockProvider(t, [503, 503, 503]);
  const overloaded = await POST(descriptionRequest(requestData));
  assert.equal(overloaded.status, 503);
  const overloadBody = await overloaded.json();
  assert.equal(overloadBody.code, "provider_overload");
  assert.ok(!JSON.stringify(overloadBody).includes("private provider detail"));
  assert.ok(!JSON.stringify(logs).includes("test-only-secret"));
});

test("contract requires exactly one nonempty description or question", () => {
  assert.deepEqual(ideaDescriptionRequestSchema.parse(requestData), requestData);
  const usefulDescription = "Study buddy matching pairs students for regular sessions. They can plan a schedule together to support a consistent study habit.";
  assert.equal(ideaDescriptionOutputProblem({ description: usefulDescription, question: null }), undefined);
  assert.ok(ideaDescriptionOutputProblem({ description: "A description.", question: "A question?" }));
  assert.ok(ideaDescriptionOutputProblem({ description: null, question: null }));
  assert.equal(ideaDescriptionResponseSchema.safeParse({ description: usefulDescription, question: null,
    model: "test-model", generatedAt: new Date().toISOString() }).success, true);
  assert.equal(ideaDescriptionResponseSchema.safeParse({ description: usefulDescription, question: "Clarify?",
    model: "test-model", generatedAt: new Date().toISOString() }).success, false);
  assert.equal(ideaDescriptionResponseSchema.safeParse({ description: "x".repeat(701), question: null,
    model: "test-model", generatedAt: new Date().toISOString() }).success, false);
});

test("editor guard accepts only the unchanged draft, request context, token, and write permission", () => {
  assert.equal(ideaDescriptionGoal({ goal: "  " }, "Board title"), "Board title");
  assert.equal(canRequestIdeaDescription(idea.title), true);
  assert.equal(canRequestIdeaDescription("New idea"), false);
  assert.equal(canRequestIdeaDescription(" "), false);
  assert.equal(canFillEditorDescription(idea, state, 4, context, true), true);
  assert.equal(canFillEditorDescription(idea, state, 3, context, true), false);
  assert.equal(canFillEditorDescription(idea, state, 4, { ...context, goal: "Changed goal" }, true), false);
  assert.equal(canFillEditorDescription(idea, state, 4, { ...context, boardTitle: "Changed board" }, true), false);
  assert.equal(canFillEditorDescription(idea, state, 4, { ...context, boardDescription: "Changed description" }, true), false);
  assert.equal(canFillEditorDescription(idea, state, 4, { ...context, seedContent: "Changed seed" }, true), false);
  assert.equal(canFillEditorDescription(idea, state, 4, { ...context, clusterLabel: "Changed group" }, true), false);
  assert.equal(canFillEditorDescription(idea, state, 4, context, false), false);
  assert.equal(canFillEditorDescription({ ...idea, title: "Renamed" }, state, 4, context, true), false);
  assert.equal(canFillEditorDescription({ ...idea, content: "Human text" }, state, 4, context, true), false);
  assert.equal(canFillEditorDescription(null, state, 4, context, true), false);
});

test("the complete request stays below the byte limit while keeping participant seed text", () => {
  const oversizedContext = {
    goal: "好".repeat(500), boardTitle: "好".repeat(80),
    boardDescription: "好".repeat(600), seedContent: "\u0001".repeat(1200),
    clusterLabel: "好".repeat(100),
  };
  const title = "好".repeat(120);
  const fitted = fitIdeaDescriptionContext(title, oversizedContext);
  assert.ok(new TextEncoder().encode(JSON.stringify({ title, ...fitted })).byteLength <= MAX_IDEA_DESCRIPTION_REQUEST_BYTES);
  assert.equal(fitted.goal, oversizedContext.goal);
  assert.equal(fitted.boardTitle, oversizedContext.boardTitle);
  assert.ok(fitted.seedContent?.length);
  assert.equal(oversizedContext.clusterLabel.length, 100);
  assert.equal(ideaDescriptionRequestSchema.safeParse({ title, ...fitted }).success, true);
});

test("generation provenance is written by the shared board model while old ideas remain valid", () => {
  const generated = { generatedContent: "A description.", title: idea.title, goal: requestData.goal,
    context: { boardTitle: requestData.boardTitle, boardDescription: requestData.boardDescription,
      seedContent: requestData.seedContent, clusterLabel: requestData.clusterLabel },
    model: "test-model", generatedAt: new Date().toISOString() };
  const saved = updateIdea(createIdea({ ideas: [], relationships: [] }, idea), idea.id,
    { content: generated.generatedContent, descriptionGeneration: generated });
  assert.deepEqual(saved.ideas[0].descriptionGeneration, generated);
  const legacy = { id: "old", title: "Older note", content: "Text", position: { x: 0, y: 0 }, pinned: false, parentIds: [] };
  assert.equal(updateIdea({ ideas: [legacy], relationships: [] }, "old", { title: "Edited note" }).ideas[0].descriptionGeneration, undefined);
});
