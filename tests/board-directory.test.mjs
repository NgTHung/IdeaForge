import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { test } from "node:test";
import express from "express";
import { createServer } from "node:http";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});

const { createBoardDirectoryRouter } = await import("../src/server/board-directory-router.ts");
const { safeReturnPath, createBoardSchema } = await import("../src/lib/board-directory.ts");

function fakeDatabase() {
  const boards = [];
  const memberships = [];
  const indexes = [];
  const matches = (document, query) => Object.entries(query).every(([key, expected]) => {
    const value = document[key];
    if (expected && typeof expected === "object" && "$in" in expected) return expected.$in.includes(value);
    if (expected && typeof expected === "object" && "$ne" in expected) return value !== expected.$ne;
    return value === expected;
  });
  const collection = (docs) => ({
    createIndex: async (keys, options) => { indexes.push({ keys, options }); return "index"; },
    insertOne: async (document) => { docs.push(structuredClone(document)); return { insertedId: "test" }; },
    deleteOne: async (query) => { const index = docs.findIndex((document) => matches(document, query)); if (index >= 0) docs.splice(index, 1); return { deletedCount: index >= 0 ? 1 : 0 }; },
    find: (query) => ({ sort() { return this; }, toArray: async () => docs.filter((document) => matches(document, query)).map((document) => structuredClone(document)) }),
    findOne: async (query) => structuredClone(docs.find((document) => matches(document, query)) ?? null),
    updateOne: async (query, update) => {
      const document = docs.find((candidate) => matches(candidate, query));
      if (!document) return { matchedCount: 0 };
      Object.assign(document, update.$set);
      return { matchedCount: 1 };
    },
  });
  return {
    database: { collection: (name) => name === "boards" ? collection(boards) : collection(memberships) },
    boards, memberships, indexes,
  };
}

async function withApi({ userId = null } = {}, run) {
  const db = fakeDatabase();
  const app = express();
  app.use(express.json());
  app.use("/api/boards", createBoardDirectoryRouter({
    database: db.database,
    appOrigin: "http://app.example",
    getSession: async () => userId ? { user: { id: userId } } : null,
  }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await run({ db, fetch: (path, init = {}) => fetch(`http://127.0.0.1:${port}/api/boards${path}`, init) }); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("board details are trimmed, required, bounded, and reject client ownership fields", () => {
  assert.deepEqual(createBoardSchema.parse({ title: "  Study habits  ", description: "  Context  " }), {
    title: "Study habits", description: "Context",
  });
  assert.equal(createBoardSchema.safeParse({ title: "  ", description: "" }).success, false);
  assert.equal(createBoardSchema.safeParse({ title: "x".repeat(81), description: "" }).success, false);
  assert.equal(createBoardSchema.safeParse({ title: "Goal", description: "x".repeat(2001) }).success, false);
  assert.equal(createBoardSchema.safeParse({ title: "Goal", description: "", ownerId: "attacker" }).success, false);
});

test("return destinations stay on the app origin", () => {
  assert.equal(safeReturnPath("/boards/new?returnTo=%2Fdashboard"), "/boards/new?returnTo=%2Fdashboard");
  assert.equal(safeReturnPath("//evil.example/path"), "/");
  assert.equal(safeReturnPath("https://evil.example/path"), "/");
  assert.equal(safeReturnPath("/\\evil.example"), "/");
  assert.equal(safeReturnPath("/login?returnTo=%2Flogin"), "/");
});

test("board creation requires a session and derives ownership and membership from it", async () => {
  await withApi({}, async ({ db, fetch }) => {
    const response = await fetch("/", {
      method: "POST", headers: { origin: "http://app.example", "content-type": "application/json" },
      body: JSON.stringify({ title: "Goal", description: "Context" }),
    });
    assert.equal(response.status, 401);
    assert.equal(db.boards.length, 0);
  });

  await withApi({ userId: "stable-user-1" }, async ({ db, fetch }) => {
    const response = await fetch("/", {
      method: "POST", headers: { origin: "http://app.example", "content-type": "application/json" },
      body: JSON.stringify({ title: "  Study habits ", description: "  Build a routine.  " }),
    });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.title, "Study habits");
    assert.equal(result.description, "Build a routine.");
    assert.equal(result.liveblocksRoomId, `ideaforge:${result.id}`);
    assert.equal(db.boards[0].ownerId, "stable-user-1");
    assert.deepEqual({ boardId: db.memberships[0].boardId, userId: db.memberships[0].userId, role: db.memberships[0].role }, {
      boardId: result.id, userId: "stable-user-1", role: "owner",
    });
    assert.equal(db.indexes.filter(({ options }) => options?.unique).length, 3);
  });
});

test("dashboard queries only owned and joined boards; public context preserves link access", async () => {
  await withApi({ userId: "viewer-1" }, async ({ db, fetch }) => {
    const now = new Date();
    const ownedId = randomUUID();
    const joinedId = randomUUID();
    const privateId = randomUUID();
    db.boards.push(
      { id: ownedId, title: "Owned", description: "", ownerId: "viewer-1", liveblocksRoomId: `ideaforge:${ownedId}`, createdAt: now, updatedAt: now },
      { id: joinedId, title: "Joined", description: "", ownerId: "owner-2", liveblocksRoomId: `ideaforge:${joinedId}`, createdAt: now, updatedAt: now },
      { id: privateId, title: "Private", description: "", ownerId: "someone-else", liveblocksRoomId: `ideaforge:${privateId}`, createdAt: now, updatedAt: now },
    );
    db.memberships.push({ boardId: ownedId, userId: "viewer-1", role: "owner", joinedAt: now });
    db.memberships.push({ boardId: joinedId, userId: "viewer-1", role: "viewer", joinedAt: now });
    const dashboard = await fetch("/");
    assert.equal(dashboard.status, 200);
    const lists = await dashboard.json();
    assert.deepEqual(lists.owned.map((board) => board.id), [ownedId]);
    assert.deepEqual(lists.shared.map((board) => [board.id, board.role]), [[joinedId, "viewer"]]);

    const join = await fetch(`/${privateId}/join`, {
      method: "POST", headers: { origin: "http://app.example" },
    });
    assert.equal(join.status, 204);
    assert.equal(db.memberships.find((membership) => membership.boardId === privateId).role, "editor");
    const afterJoin = await (await fetch("/")).json();
    assert.deepEqual(afterJoin.shared.map((board) => [board.id, board.role]), [[joinedId, "viewer"], [privateId, "editor"]]);

    const context = await fetch(`/${joinedId}/context`);
    assert.equal(context.status, 200);
    assert.equal((await context.json()).title, "Joined");

    const changed = await fetch(`/${joinedId}/title`, {
      method: "PATCH", headers: { origin: "http://app.example", "content-type": "application/json" },
      body: JSON.stringify({ title: "  Renamed board  " }),
    });
    assert.equal(changed.status, 204);
    assert.equal(db.boards.find((board) => board.id === joinedId).title, "Renamed board");
    assert.ok(db.boards.find((board) => board.id === joinedId).updatedAt >= now);
  });
});
