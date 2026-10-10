import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (context.parentURL?.startsWith(new URL("../src/", import.meta.url).href) &&
      specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const { getMongo } = await import("../src/server/mongodb.ts");
const { getServerEnv } = await import("../src/server/env.ts");
const { createBoardStarterIdeasHandlers } = await import("../src/server/board-starter-ideas.ts");
const { client, database } = getMongo();
const boardId = randomUUID();
const ownerId = `starter-ideas-check-${randomUUID()}`;
const boards = database.collection("boards");
const origin = getServerEnv().APP_ORIGIN;
const handlers = createBoardStarterIdeasHandlers({
  getDatabase: () => database,
  getSession: async () => ({ user: { id: ownerId } }),
  getAppOrigin: () => origin,
});

try {
  const now = new Date();
  await boards.insertOne({
    id: boardId, title: "Reduce campus food waste",
    description: "Student teams want practical ways to reduce uneaten food in campus dining halls.",
    ownerId, liveblocksRoomId: `ideaforge:${boardId}`, createdAt: now, updatedAt: now,
    starterIdeas: true, starterIdeasJob: { status: "pending" },
  });
  const endpoint = `${origin}/api/boards/${boardId}/starter-ideas`;
  const result = await handlers.generate(new Request(endpoint, { method: "POST", headers: { origin } }), boardId);
  if (result.status !== 200) throw new Error(`Generation returned ${result.status}: ${await result.text()}`);
  const body = await result.json();
  assert.equal(body.ideas.length, 5);
  assert.equal(new Set(body.ideas.map((idea) => idea.approach.toLocaleLowerCase())).size, 5);
  const finish = await handlers.finish(new Request(endpoint, {
    method: "PATCH", headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId: body.attemptId, status: "completed" }),
  }), boardId);
  assert.equal(finish.status, 204);
  assert.equal((await boards.findOne({ id: boardId }))?.starterIdeasJob?.status, "completed");
  console.log("Starter idea server check passed: MongoDB claim, real provider output, five distinct approaches, and completion.");
} finally {
  await boards.deleteOne({ id: boardId, ownerId });
  await client.close();
}
