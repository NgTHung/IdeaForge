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
  savedKey = process.env.FEATHERLESS_API_KEY;
  delete process.env.FEATHERLESS_API_KEY;
  t.mock.method(console, "error", () => {});
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.FEATHERLESS_API_KEY;
  else process.env.FEATHERLESS_API_KEY = savedKey;
});

function mergeRequest(body) {
  return new Request("http://localhost/api/merge", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
}

test("bad JSON and invalid sources fail before provider calls", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Invalid input must not reach the provider"));
  const conflictWithoutCondition = { ...payload, relationship: { type: "conflict", explanation: "These approaches compete.", sourceId: "a", targetId: "b" } };
  for (const body of ["{", {}, { ...payload, sources: [payload.sources[0], payload.sources[0]] }, conflictWithoutCondition]) {
    assert.equal((await POST(mergeRequest(body))).status, 400);
  }
});

test("missing key response identifies the cause", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Missing key must not reach the provider"));
  const response = await POST(mergeRequest(payload));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "missing_key");
});

test("merge returns the validated result from a mocked provider", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  const conflictPayload = { ...payload, relationship: {
    type: "conflict", explanation: "A quiet room and group study compete.", condition: "When the room is shared during individual exams.", sourceId: "a", targetId: "b",
  } };
  const result = {
    status: "useful", reason: "", title: "Mocked concept", concept: "Mocked concept text",
    contributions: [{ sourceId: "a", contribution: "A contributes" }, { sourceId: "b", contribution: "B contributes" }],
    bridge: "A enables B", tension: "Mocked tension", assumptions: ["Mocked assumption"], nextExperiment: "Mocked experiment",
  };
  let providerRequest;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    providerRequest = JSON.parse(init.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  });
  const response = await POST(mergeRequest(conflictPayload));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.equal(JSON.parse(providerRequest.messages[1].content).relationships[0].condition, conflictPayload.relationship.condition);
  assert.match(providerRequest.messages[0].content, /Address every conflict condition/);
  const body = await response.json();
  assert.deepEqual(body.result, result);
  assert.equal(typeof body.model, "string");
  assert.ok(!Number.isNaN(Date.parse(body.generatedAt)));
});

test("merge reports invalid provider output with a safe error", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ message: { content: "test-only-secret" } }] }));
  const response = await POST(mergeRequest(payload));
  assert.equal(response.status, 502);
  const error = await response.json();
  assert.equal(error.code, "invalid_output");
  assert.ok(!JSON.stringify(error).includes("test-only-secret"));
});

test("merge repairs a proposal whose contributions miss a source", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  const result = {
    status: "useful", reason: "", title: "Mocked concept", concept: "Mocked concept text",
    contributions: [{ sourceId: "a", contribution: "A contributes" }, { sourceId: "b", contribution: "B contributes" }],
    bridge: "A enables B", tension: "Mocked tension", assumptions: ["Mocked assumption"], nextExperiment: "Mocked experiment",
  };
  const replies = [{ ...result, contributions: [result.contributions[0], { sourceId: "c", contribution: "Unknown source" }] }, result];
  const requests = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify(replies.shift()) } }] });
  });
  const response = await POST(mergeRequest(payload));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result, result);
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages[3].content, /every source ID \(a, b\) must appear exactly once across contributions and excluded, but they contain a, c\./);
});

test("merge accepts a proposal that leaves out a note with a reason", async (t) => {
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  const sources = [...payload.sources, { id: "c", text: "C" }];
  const result = {
    status: "useful", reason: "", title: "Mocked concept", concept: "Mocked concept text",
    contributions: [{ sourceId: "a", contribution: "A contributes" }, { sourceId: "b", contribution: "B contributes" }],
    excluded: [{ sourceId: "c", reason: "C solves a different problem" }],
    bridge: "A enables B", tension: "Mocked tension", assumptions: [], nextExperiment: "Mocked experiment",
  };
  let providerRequest;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    providerRequest = JSON.parse(init.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  });
  const response = await POST(mergeRequest({ ...payload, sources }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result, result);
  assert.match(providerRequest.messages[0].content, /List each left-out source in excluded/);
});
