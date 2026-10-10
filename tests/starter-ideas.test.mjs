import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { LiveMap, LiveObject } from "@liveblocks/client";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    if (context.parentURL?.startsWith(new URL("../src/", import.meta.url).href) &&
      specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const { starterIdeaSelectionProblem, starterIdeasResponseSchema } = await import("../src/lib/starter-ideas-contract.ts");
const { commitStarterIdeas, placeStarterIdeas } = await import("../src/features/board/starter-ideas.ts");
const { createBoardStarterIdeasHandlers } = await import("../src/server/board-starter-ideas.ts");
const { generateStarterIdeas } = await import("../src/lib/starter-ideas.ts");

const candidates = Array.from({ length: 10 }, (_, index) => ({
  title: `Approach ${index + 1}`,
  description: `Try a distinct way ${index + 1} to address the board's goal using a concrete team activity.`,
  approach: `Mechanism ${index + 1}`,
}));

function generated(attemptId = randomUUID()) {
  return starterIdeasResponseSchema.parse({
    attemptId, title: "Reduce campus food waste", description: "Explore ways students can reduce waste.",
    ideas: candidates.slice(0, 5), model: "test-model", generatedAt: new Date().toISOString(),
  });
}

test("selection rejects repeated indices and repeated mechanisms", () => {
  assert.match(starterIdeaSelectionProblem(candidates, [0, 0, 1, 2, 3]), /different candidate indices/);
  const repeated = candidates.map((candidate) => ({ ...candidate }));
  repeated[4].approach = "MECHANISM 1";
  assert.match(starterIdeaSelectionProblem(repeated, [0, 1, 2, 3, 4]), /different approach/);
  assert.equal(starterIdeaSelectionProblem(candidates, [0, 1, 2, 3, 4]), undefined);
});

test("generation explores a wider pool before selecting five candidate IDs", async (t) => {
  const previousKey = process.env.FEATHERLESS_API_KEY;
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  t.after(() => {
    if (previousKey === undefined) delete process.env.FEATHERLESS_API_KEY;
    else process.env.FEATHERLESS_API_KEY = previousKey;
  });
  const replies = [{ candidates }, { indices: [0, 2, 4, 6, 8] }];
  const calls = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify(replies.shift()) } }] });
  });
  const result = await generateStarterIdeas("Reduce campus food waste", "Explore different ways to reduce uneaten dining hall food.");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].messages[1].content.includes("Mechanism 9"), true);
  assert.deepEqual(result.ideas.map((idea) => idea.title), ["Approach 1", "Approach 3", "Approach 5", "Approach 7", "Approach 9"]);
});

test("placed notes preserve existing notes and record AI provenance", () => {
  const existing = { id: "manual", title: "My idea", content: "User text", position: { x: -340, y: -110 }, pinned: false, parentIds: [] };
  const result = generated();
  const notes = placeStarterIdeas([existing], result, result.attemptId);
  assert.equal(notes.length, 5);
  assert.equal(new Set(notes.map((note) => note.id)).size, 5);
  assert.ok(notes.every((note) => note.starterIdea?.batchId === result.attemptId && note.author === "IdeaForge AI"));
  assert.ok(notes.every((note) => note.position.x !== existing.position.x || note.position.y !== existing.position.y));
  assert.equal(existing.content, "User text");
});

test("one room commit inserts five notes and the marker only once", () => {
  const result = generated();
  const root = new LiveObject({ title: result.title, ideas: new LiveMap(), starterIdeasState: null });
  assert.equal(commitStarterIdeas(root, result, result.description), true);
  assert.equal(root.get("ideas").size, 5);
  assert.equal(root.get("starterIdeasState").get("status"), "completed");
  assert.equal(commitStarterIdeas(root, result, result.description), false);
  assert.equal(root.get("ideas").size, 5);
  const changed = new LiveObject({ title: "New title", ideas: new LiveMap(), starterIdeasState: null });
  assert.equal(commitStarterIdeas(changed, result, result.description), false);
  const editedDescription = new LiveObject({ title: result.title, description: "Edited description", ideas: new LiveMap(), starterIdeasState: null });
  assert.equal(commitStarterIdeas(editedDescription, result, result.description), false);
  assert.equal(changed.get("ideas").size, 0);
});

function setupHandler(generate) {
  const id = randomUUID();
  const board = {
    id, title: "Reduce campus food waste", description: "Explore ways students can reduce waste.",
    ownerId: "owner", starterIdeas: true, starterIdeasJob: { status: "pending" },
  };
  const collection = {
    async findOne(filter) {
      if (filter.id !== id || filter.ownerId && filter.ownerId !== board.ownerId) return null;
      return { ...board, starterIdeasJob: { ...board.starterIdeasJob } };
    },
    async findOneAndUpdate(filter, update) {
      if (filter.id !== id || !["pending", "failed"].includes(board.starterIdeasJob.status) &&
        !(board.starterIdeasJob.status === "running" && board.starterIdeasJob.leaseUntil < new Date())) return null;
      board.starterIdeasJob = update.$set.starterIdeasJob;
      return { ...board };
    },
    async updateOne(filter, update) {
      if (filter.id !== id || filter["starterIdeasJob.attemptId"] !== board.starterIdeasJob.attemptId ||
        filter["starterIdeasJob.status"] && filter["starterIdeasJob.status"] !== board.starterIdeasJob.status) return { matchedCount: 0 };
      board.starterIdeasJob = update.$set.starterIdeasJob;
      return { matchedCount: 1 };
    },
  };
  const handlers = createBoardStarterIdeasHandlers({
    getDatabase: () => ({ collection: () => collection }),
    getSession: async () => ({ user: { id: "owner" } }),
    getAppOrigin: () => "http://app.example",
    generate,
  });
  const request = (method, body) => new Request(`http://app.example/api/boards/${id}/starter-ideas`, {
    method, headers: { origin: "http://app.example", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { id, board, handlers, request };
}

test("one active generation claim blocks a concurrent owner tab", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let started;
  const entered = new Promise((resolve) => { started = resolve; });
  let calls = 0;
  const { id, board, handlers, request } = setupHandler(async () => {
    calls += 1;
    started();
    await gate;
    return { ideas: candidates.slice(0, 5), model: "test-model" };
  });
  const first = handlers.generate(request("POST"), id);
  await entered;
  const second = await handlers.generate(request("POST"), id);
  assert.equal(second.status, 409);
  assert.equal((await second.json()).code, "in_progress");
  release();
  const result = await first;
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.ideas.length, 5);
  assert.equal(calls, 1);
  assert.equal((await handlers.finish(request("PATCH", { attemptId: payload.attemptId, status: "completed" }), id)).status, 204);
  assert.equal(board.starterIdeasJob.status, "completed");
});

test("changed board context rejects a stale result and releases the claim", async () => {
  const { id, board, handlers, request } = setupHandler(async () => {
    board.title = "Updated board goal";
    return { ideas: candidates.slice(0, 5), model: "test-model" };
  });
  const response = await handlers.generate(request("POST"), id);
  assert.equal(response.status, 409);
  assert.equal(board.starterIdeasJob.status, "failed");
});
