import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { Liveblocks } from "@liveblocks/node";
import { syncObjectMap } from "../src/features/board/shared-object-map.ts";

const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
if (!secret) throw new Error("Set LIVEBLOCKS_SECRET_KEY to run the live board social check.");
const service = new Liveblocks({ secret });
const roomId = `ideaforge:${randomUUID()}`;
const exits = [];
const original = { id: "source", title: "Original", content: "Untouched source", pinned: false, parentIds: [], position: { x: 0, y: 0 } };
const sticker = { id: "sticker", kind: "star", author: "Alice", position: { x: 20, y: 40 } };
async function until(check, label) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { if (check()) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  throw new Error(`Timed out waiting for ${label}.`);
}
async function connect(name, initialize = false, viewer = false) {
  const session = service.prepareSession(randomUUID(), { userInfo: { name } });
  session.allow(roomId, viewer ? session.READ_ACCESS : session.FULL_ACCESS);
  const response = await session.authorize();
  if (response.status !== 200) throw new Error(`Authorization failed: ${response.status}`);
  const auth = JSON.parse(response.body);
  const client = createClient({ authEndpoint: async () => auth });
  const options = { initialPresence: {} };
  if (initialize) options.initialStorage = { title: "Social verification", ideas: new LiveMap([[original.id, new LiveObject(original)]]), relationships: new LiveMap(), clusterSnapshot: null };
  const { room, leave } = client.enterRoom(roomId, options); exits.push(leave);
  await room.getStorage(); return room;
}
const decorations = (room) => room.getStorageOrNull().get("decorations");
try {
  const alice = await connect("Alice", true);
  const bob = await connect("Bob");
  const viewer = await connect("Viewer", false, true);
  assert.equal(viewer.getSelf().canWrite, false);
  alice.history.clear();
  alice.batch(() => { const saved = new LiveMap(); alice.getStorageOrNull().set("decorations", saved); syncObjectMap(saved, [sticker]); });
  await until(() => decorations(bob)?.has(sticker.id) && decorations(viewer)?.has(sticker.id), "legacy-room decoration map");
  alice.history.undo();
  await until(() => !decorations(bob)?.has(sticker.id), "placement undo");
  alice.history.redo();
  await until(() => decorations(bob)?.has(sticker.id), "placement redo");
  alice.batch(() => syncObjectMap(decorations(alice), [{ ...sticker, position: { x: 80, y: 90 } }]));
  await until(() => decorations(bob).get(sticker.id).get("position").x === 80, "saved sticker movement");
  alice.history.undo();
  await until(() => decorations(bob).get(sticker.id).get("position").x === 20, "movement undo");
  const events = []; bob.subscribe("event", (message) => events.push(message));
  const chat = { id: randomUUID(), kind: "chat", value: "Hello near the cursor", position: { x: 10, y: 20 } };
  const reaction = { id: randomUUID(), kind: "reaction", value: "clap", position: { x: 30, y: 40 } };
  alice.broadcastEvent(chat); alice.broadcastEvent(reaction);
  await until(() => events.length === 2, "cursor chat and reaction delivery");
  assert.deepEqual(events.map((item) => item.event), [chat, reaction]);
  assert.equal(events[0].user.info.name, "Alice");
  await until(() => alice.getStorageStatus() === "synchronized", "saved decorations");
  const reconnected = await connect("Reconnect");
  assert.deepEqual(decorations(reconnected).get(sticker.id).toJSON(), sticker);
  assert.deepEqual(reconnected.getStorageOrNull().get("ideas").get(original.id).toJSON(), original);
  assert.equal(reconnected.getStorageOrNull().get("chat"), undefined);
  alice.batch(() => syncObjectMap(decorations(alice), []));
  await until(() => !decorations(bob).has(sticker.id), "decoration deletion");
  console.log("Live board social verification passed: viewer access, two-client events, saved decorations, movement, deletion, undo/redo, reconnect, and unchanged notes.");
} finally {
  for (const leave of exits) leave();
  await service.deleteRoom(roomId);
}
