import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { Liveblocks } from "@liveblocks/node";

const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
if (!secret) throw new Error("Set LIVEBLOCKS_SECRET_KEY in .env to run this integration check.");

const liveblocks = new Liveblocks({ secret });
const roomId = `ideaforge:${randomUUID()}`;
const exits = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(userId, withStorage = false) {
  const session = liveblocks.prepareSession(userId);
  session.allow(roomId, session.FULL_ACCESS);
  const response = await session.authorize();
  if (response.status !== 200) throw new Error(`Liveblocks auth failed with HTTP ${response.status}.`);
  const auth = JSON.parse(response.body);
  const client = createClient({ authEndpoint: async () => auth });
  const options = { initialPresence: {} };
  if (withStorage) options.initialStorage = {
    title: "History test",
    goal: "Verify room history",
    ideas: new LiveMap([
      ["a", new LiveObject({ id: "a", title: "A", content: "Alpha", position: { x: 0, y: 0 }, pinned: false, parentIds: [] })],
      ["b", new LiveObject({ id: "b", title: "B", content: "Beta", position: { x: 300, y: 0 }, pinned: false, parentIds: [] })],
    ]),
    relationships: new LiveMap(),
    dismissedConnections: new LiveMap(),
    clusterSnapshot: null,
  };
  const { room, leave } = client.enterRoom(roomId, options);
  exits.push(leave);
  return room;
}

async function synchronized(room) {
  const end = Date.now() + 15_000;
  while (Date.now() < end) {
    if (room.getStorageStatus() === "synchronized") return;
    await wait(50);
  }
  throw new Error("Liveblocks Storage did not synchronize within 15 seconds.");
}

async function until(check, label) {
  const end = Date.now() + 8_000;
  while (Date.now() < end) {
    if (check()) return;
    await wait(40);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function storage(room) { return room.getStorageOrNull(); }
function ideas(room) { return storage(room).get("ideas"); }
function links(room) { return storage(room).get("relationships"); }

try {
  const first = await connect(`history-check-${randomUUID()}`, true);
  await first.getStorage();
  await synchronized(first);
  const second = await connect(`history-check-${randomUUID()}`);
  await second.getStorage();
  await synchronized(second);

  first.history.clear();
  first.batch(() => ideas(first).set("created", new LiveObject({
    id: "created", title: "Created", content: "Text", position: { x: 20, y: 30 }, pinned: false, parentIds: [],
  })));
  assert.equal(first.history.canUndo(), true, "create should be undoable");
  first.history.undo();
  assert.equal(ideas(first).has("created"), false, "undo should remove created idea");
  first.history.redo();
  assert.equal(ideas(first).has("created"), true, "redo should restore created idea");

  first.history.clear();
  const idea = ideas(first).get("a");
  first.batch(() => { idea.set("title", "Saved title"); idea.set("content", "Saved content"); });
  first.history.undo();
  assert.equal(idea.get("title"), "A");
  assert.equal(idea.get("content"), "Alpha");
  assert.equal(first.history.canUndo(), false, "one saved text edit should be one step");
  first.history.redo();
  assert.equal(idea.get("content"), "Saved content");

  first.history.clear();
  first.batch(() => idea.set("position", { x: 80, y: 110 }));
  first.history.undo();
  assert.deepEqual(idea.get("position"), { x: 0, y: 0 }, "one committed drag position should undo in one step");
  assert.equal(first.history.canUndo(), false);

  first.batch(() => links(first).set("ab", new LiveObject({ id: "ab", source: "a", target: "b", type: "synergy", explanation: "", author: "test" })));
  first.history.clear();
  first.batch(() => {
    ideas(first).delete("a");
    links(first).delete("ab");
  });
  first.history.undo();
  assert.equal(ideas(first).has("a"), true, "delete undo restores idea");
  assert.equal(links(first).has("ab"), true, "delete undo restores incident relationship");
  first.history.redo();
  assert.equal(ideas(first).has("a"), false, "delete redo removes idea");
  assert.equal(links(first).has("ab"), false, "delete redo removes incident relationship");

  first.history.clear();
  await Promise.resolve({ title: "Accepted AI result" });
  first.batch(() => {
    ideas(first).set("merged", new LiveObject({ id: "merged", title: "Merged", content: "Concept", position: { x: 100, y: 100 }, pinned: false, parentIds: ["a", "b"] }));
    links(first).set("ancestry-a", new LiveObject({ id: "ancestry-a", source: "a", target: "merged", type: "extends", explanation: "", author: "test" }));
    links(first).set("ancestry-b", new LiveObject({ id: "ancestry-b", source: "b", target: "merged", type: "extends", explanation: "", author: "test" }));
  });
  first.history.undo();
  assert.equal(ideas(first).has("merged"), false, "accepted AI action undo removes child");
  assert.equal(links(first).has("ancestry-a"), false, "accepted AI action undo removes grouped links");
  first.history.redo();
  assert.equal(links(first).has("ancestry-b"), true);

  first.history.clear();
  second.history.clear();
  first.batch(() => ideas(first).get("a").set("title", "Local title"));
  await until(() => ideas(second).get("a")?.get("title") === "Local title", "first user's edit");
  second.batch(() => ideas(second).get("a").set("content", "Remote content"));
  await until(() => ideas(first).get("a")?.get("content") === "Remote content", "second user's edit");
  first.history.undo();
  assert.equal(ideas(first).get("a").get("title"), "A");
  assert.equal(ideas(first).get("a").get("content"), "Remote content", "unrelated remote field must survive local undo");

  first.history.clear();
  second.history.clear();
  first.batch(() => ideas(first).get("a").set("title", "Local same-field value"));
  await until(() => ideas(second).get("a")?.get("title") === "Local same-field value", "local same-field edit");
  second.batch(() => ideas(second).get("a").set("title", "Remote same-field value"));
  await until(() => ideas(first).get("a")?.get("title") === "Remote same-field value", "remote same-field edit");
  first.history.undo();
  console.log(`Same-field native undo outcome: ${ideas(first).get("a").get("title")}`);

  first.history.clear();
  second.history.clear();
  first.batch(() => ideas(first).get("a").set("title", "Local redo value"));
  first.history.undo();
  await synchronized(first);
  second.batch(() => ideas(second).get("a").set("content", "Remote during redo"));
  await until(() => ideas(first).get("a")?.get("content") === "Remote during redo", "remote edit after undo");
  assert.equal(first.history.canRedo(), true, "remote edits leave local redo available");
  first.history.redo();
  assert.equal(ideas(first).get("a").get("title"), "Local redo value");
  first.history.undo();
  first.batch(() => ideas(first).get("a").set("content", "New local edit"));
  assert.equal(first.history.canRedo(), false, "a new local edit clears redo");

  first.history.clear();
  second.history.clear();
  first.batch(() => ideas(first).set("shared-edit", new LiveObject({ id: "shared-edit", title: "Shared", content: "", position: { x: 0, y: 0 }, pinned: false, parentIds: [] })));
  await until(() => ideas(second).has("shared-edit"), "second shared idea creation");
  second.batch(() => ideas(second).get("shared-edit").set("content", "Remote edit"));
  await until(() => ideas(first).get("shared-edit")?.get("content") === "Remote edit", "remote edit to created idea");
  first.history.undo();
  await until(() => !ideas(second).has("shared-edit"), "unsafe creation undo after remote edit");

  first.history.clear();
  second.history.clear();
  first.batch(() => ideas(first).set("shared", new LiveObject({ id: "shared", title: "Shared", content: "", position: { x: 0, y: 0 }, pinned: false, parentIds: [] })));
  await until(() => ideas(second).has("shared"), "shared idea creation");
  second.batch(() => links(second).set("shared-link", new LiveObject({ id: "shared-link", source: "shared", target: "b", type: "synergy", explanation: "", author: "test" })));
  await until(() => links(first).has("shared-link"), "remote relationship creation");
  first.history.undo();
  await until(() => !ideas(second).has("shared"), "undo after remote relationship");
  assert.equal(links(first).has("shared-link"), true, "native undo leaves the remote dangling link stored");

  first.history.clear();
  exits.splice(0, exits.length).forEach((leave) => leave());
  const reloaded = await connect(`history-check-${randomUUID()}`);
  await reloaded.getStorage();
  await synchronized(reloaded);
  assert.equal(reloaded.history.canUndo(), false, "a new client session has no prior undo stack");
  assert.equal(ideas(reloaded).has("shared"), false, "Storage still persists after reconnect");

  console.log("Liveblocks history check passed: create/edit/drag/delete/AI grouping, unrelated fields, same-field outcome, redo rules, unsafe creation undo, dangling-link behavior, and session reset.");
  console.log("Physics pollution, browser shortcuts, write-permission controls, and board-switch remount require application/browser verification.");
  console.log("Same-field and unsafe-create undo remain intentionally unguarded by native history.");
} finally {
  exits.splice(0, exits.length).forEach((leave) => leave());
  try { await liveblocks.deleteRoom(roomId); } catch { /* Keep test cleanup best effort. */ }
}
