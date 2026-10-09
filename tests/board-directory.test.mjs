import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (context.parentURL?.startsWith(new URL("../src/", import.meta.url).href) && specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const { createBoardDirectoryHandlers } = await import("../src/server/board-directory.ts");
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
    deleteMany: async (query) => {
      let deletedCount = 0;
      for (let index = docs.length - 1; index >= 0; index--) {
        if (matches(docs[index], query)) { docs.splice(index, 1); deletedCount++; }
      }
      return { deletedCount };
    },
    find: (query) => ({ sort() { return this; }, toArray: async () => docs.filter((document) => matches(document, query)).map((document) => structuredClone(document)) }),
    findOne: async (query) => structuredClone(docs.find((document) => matches(document, query)) ?? null),
    updateOne: async (query, update, options) => {
      const document = docs.find((candidate) => matches(candidate, query));
      if (!document) {
        if (options?.upsert) docs.push(structuredClone({ ...query, ...update.$setOnInsert }));
        return { matchedCount: 0 };
      }
      if (update.$set) Object.assign(document, update.$set);
      return { matchedCount: 1 };
    },
  });
  return {
    database: { collection: (name) => name === "boards" ? collection(boards) : collection(memberships) },
    boards, memberships, indexes,
  };
}

async function withApi({ userId = null, deleteRoom } = {}, run) {
  const db = fakeDatabase();
  const handlers = createBoardDirectoryHandlers({
    getDatabase: () => db.database,
    getAppOrigin: () => "http://app.example",
    getSession: async () => userId ? { user: { id: userId } } : null,
    deleteRoom,
  });
  await run({ db, handlers, fetch: (path, init = {}) => {
    const request = new Request(`http://app.example/api/boards${path}`, init);
    if (path === "/") return request.method === "POST" ? handlers.create(request) : handlers.list(request);
    const [, id, operation] = path.split("/");
    return handlers[request.method === "DELETE" ? "delete" : operation](request, id);
  } });
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

test("mutations reject missing and foreign origins before reading a session or database", async () => {
  const handlers = createBoardDirectoryHandlers({
    getAppOrigin: () => "http://app.example",
    getDatabase: () => { throw new Error("Database should not be opened"); },
    getSession: () => { throw new Error("Session should not be read"); },
  });
  for (const origin of [undefined, "http://evil.example", "null"]) {
    for (const [method, handler] of [["POST", handlers.create], ["POST", handlers.join], ["PATCH", handlers.title], ["DELETE", handlers.delete]]) {
      const response = await handler(new Request("http://app.example/api/boards", {
        method, headers: origin ? { origin } : {}, body: "{}",
      }), randomUUID());
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
});

test("board handlers reject malformed, oversized, and invalid JSON without saving", async () => {
  await withApi({ userId: "owner" }, async ({ db, fetch }) => {
    for (const [body, status] of [["{", 400], ["null", 400], [JSON.stringify({ title: "" }), 400],
      [JSON.stringify({ title: "Goal", ownerId: "attacker" }), 400], ["x".repeat(1024 * 1024 + 1), 413]]) {
      const response = await fetch("/", { method: "POST", headers: { origin: "http://app.example" }, body });
      assert.equal(response.status, status);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    assert.equal(db.boards.length, 0);
  });
});

test("invalid and missing boards return JSON errors, and link holders can rename without a session", async () => {
  await withApi({}, async ({ db, fetch }) => {
    assert.equal((await fetch("/not-a-uuid/context")).status, 400);
    assert.equal((await fetch(`/${randomUUID()}/context`)).status, 404);
    const id = randomUUID();
    const now = new Date();
    db.boards.push({ id, title: "Before", description: "", ownerId: "owner", liveblocksRoomId: `ideaforge:${id}`, createdAt: now, updatedAt: now });
    const response = await fetch(`/${id}/title`, {
      method: "PATCH", headers: { origin: "http://app.example" }, body: JSON.stringify({ title: "After" }),
    });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.equal(db.boards[0].title, "After");
    assert.equal((await fetch(`/${id}/join`, { method: "POST", headers: { origin: "http://app.example" } })).status, 401);
    assert.equal((await fetch(`/${id}/title`, { method: "PATCH", headers: { origin: "http://app.example" }, body: "{" })).status, 400);
    assert.equal((await fetch(`/${id}/title`, { method: "PATCH", headers: { origin: "http://app.example" }, body: '{"title":""}' })).status, 400);
    assert.equal((await fetch(`/${randomUUID()}/title`, { method: "PATCH", headers: { origin: "http://app.example" }, body: '{"title":"Valid"}' })).status, 404);
  });
});

test("joining twice retains the original membership role and date", async () => {
  await withApi({ userId: "viewer" }, async ({ db, fetch }) => {
    const id = randomUUID();
    const now = new Date();
    db.boards.push({ id, title: "Board", description: "", ownerId: "owner", liveblocksRoomId: `ideaforge:${id}`, createdAt: now, updatedAt: now });
    db.memberships.push({ boardId: id, userId: "viewer", role: "viewer", joinedAt: now });
    for (let i = 0; i < 2; i++) assert.equal((await fetch(`/${id}/join`, { method: "POST", headers: { origin: "http://app.example" } })).status, 204);
    assert.equal(db.memberships.length, 1);
    assert.equal(db.memberships[0].role, "viewer");
    assert.deepEqual(db.memberships[0].joinedAt, now);
    assert.equal((await fetch(`/${randomUUID()}/join`, { method: "POST", headers: { origin: "http://app.example" } })).status, 404);
  });
});

test("index failures retry and unexpected errors do not expose database credentials", async (t) => {
  t.mock.method(console, "error", () => {});
  const db = fakeDatabase();
  const original = db.database.collection;
  let fail = true;
  db.database.collection = (name) => ({ ...original(name), createIndex: async () => {
    if (fail) throw new Error("mongodb://user:secret@database");
  } });
  const handlers = createBoardDirectoryHandlers({ getDatabase: () => db.database, getAppOrigin: () => "http://app.example", getSession: async () => ({ user: { id: "owner" } }) });
  const response = await handlers.list(new Request("http://app.example/api/boards"));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "The request could not be completed." });
  fail = false;
  assert.equal((await handlers.list(new Request("http://app.example/api/boards"))).status, 200);
});

test("a failed owner membership insert removes the new board", async (t) => {
  t.mock.method(console, "error", () => {});
  const db = fakeDatabase();
  const original = db.database.collection;
  db.database.collection = (name) => name === "boards" ? original(name) : {
    ...original(name), insertOne: async () => { throw new Error("Membership unavailable"); },
  };
  const handlers = createBoardDirectoryHandlers({ getDatabase: () => db.database, getAppOrigin: () => "http://app.example", getSession: async () => ({ user: { id: "owner" } }) });
  const response = await handlers.create(new Request("http://app.example/api/boards", {
    method: "POST", headers: { origin: "http://app.example" }, body: '{"title":"Goal"}',
  }));
  assert.equal(response.status, 500);
  assert.equal(db.boards.length, 0);
});

test("board deletion requires the owner and removes only that room and its directory records", async () => {
  for (const userId of [null, "member", "owner"]) {
    const deletedRooms = [];
    await withApi({ userId, deleteRoom: async (roomId) => deletedRooms.push(roomId) }, async ({ db, fetch }) => {
      const id = randomUUID();
      const otherId = randomUUID();
      const now = new Date();
      for (const boardId of [id, otherId]) {
        db.boards.push({ id: boardId, title: "Board", description: "", ownerId: "owner", liveblocksRoomId: `ideaforge:${boardId}`, createdAt: now, updatedAt: now });
        db.memberships.push({ boardId, userId: "owner", role: "owner", joinedAt: now });
        db.memberships.push({ boardId, userId: "member", role: "editor", joinedAt: now });
      }
      const response = await fetch(`/${id}`, { method: "DELETE", headers: { origin: "http://app.example" } });
      assert.equal(response.status, userId === "owner" ? 204 : userId === null ? 401 : 404);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(deletedRooms, userId === "owner" ? [`ideaforge:${id}`] : []);
      assert.equal(db.boards.length, userId === "owner" ? 1 : 2);
      assert.equal(db.memberships.length, userId === "owner" ? 2 : 4);
      assert.ok(db.boards.some((board) => board.id === otherId));
      assert.equal((await fetch("/invalid-id", { method: "DELETE", headers: { origin: "http://app.example" } })).status, userId === null ? 401 : 400);
    });
  }
});

test("failed room deletion keeps directory records and an already deleted room allows cleanup", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const failure of [undefined, { status: 404 }, { status: 503 }]) {
    await withApi({ userId: "owner", deleteRoom: failure ? async () => { throw failure; } : undefined }, async ({ db, fetch }) => {
      const id = randomUUID();
      const now = new Date();
      db.boards.push({ id, title: "Board", description: "", ownerId: "owner", liveblocksRoomId: `ideaforge:${id}`, createdAt: now, updatedAt: now });
      db.memberships.push({ boardId: id, userId: "owner", role: "owner", joinedAt: now });
      const response = await fetch(`/${id}`, { method: "DELETE", headers: { origin: "http://app.example" } });
      assert.equal(response.status, failure?.status === 404 ? 204 : failure ? 500 : 503);
      assert.equal(db.boards.length, failure?.status === 404 ? 0 : 1);
      assert.equal(db.memberships.length, failure?.status === 404 ? 0 : 1);
    });
  }
});
