import dotenv from "dotenv";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { Liveblocks } from "@liveblocks/node";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
const { syncBoardConclusion } = await import("../src/features/board/shared-conclusion.ts");
const { conclusionContext, conclusionRecord } = await import("../src/features/board/board-conclusion.ts");

const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
if (!secret) throw new Error("Set LIVEBLOCKS_SECRET_KEY in .env to run this integration check.");
const liveblocks = new Liveblocks({ secret });
const roomId = `ideaforge:${randomUUID()}`;
const exits = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const originalIdeas = [
  { id: "a", title: "Skill profiles", content: "List two skills.", author: "An", position: { x: 0, y: 0 }, pinned: false, parentIds: [] },
  { id: "b", title: "Matching quiz", content: "Five questions.", author: "Binh", position: { x: 300, y: 0 }, pinned: false, parentIds: [] },
];
const originalVotes = [["a:u1", { ideaId: "a", voterId: "u1", voterName: "Uyen", value: 1 }]];

async function connect(userId, name, { initialize = false, readOnly = false } = {}) {
  const session = liveblocks.prepareSession(userId, { userInfo: { name } });
  session.allow(roomId, readOnly ? session.READ_ACCESS : session.FULL_ACCESS);
  const response = await session.authorize();
  if (response.status !== 200) throw new Error(`Liveblocks auth failed with HTTP ${response.status}.`);
  const auth = JSON.parse(response.body);
  const client = createClient({ authEndpoint: async () => auth });
  const options = { initialPresence: {} };
  // Matches a room created before conclusions existed: no conclusion key.
  if (initialize) options.initialStorage = {
    title: "Conclusion verification", goal: "Find a team.",
    ideas: new LiveMap(originalIdeas.map((idea) => [idea.id, new LiveObject(idea)])),
    relationships: new LiveMap(), votes: new LiveMap(originalVotes), clusterSnapshot: null,
  };
  const { room, leave } = client.enterRoom(roomId, options);
  exits.push(leave);
  await room.getStorage();
  return { room, leave };
}

function board(room) {
  const storage = room.getStorageOrNull();
  return {
    goal: storage.get("goal"),
    ideas: [...storage.get("ideas").values()].map((idea) => idea.toJSON()),
    relationships: [],
    votes: [...storage.get("votes")?.values() ?? []],
    conclusion: storage.get("conclusion")?.toJSON() ?? null,
  };
}
function keep(room, ideaIds, title, keptBy) {
  const { request } = conclusionContext(board(room), { ideaIds, clusterIds: [] });
  const result = {
    title, summary: "Summary.", themes: [{ title: "Theme", text: "Text.", cardIds: ideaIds }], keyIdeas: [{ cardId: ideaIds[0], why: "Why." }],
    conflicts: [], assumptions: [], openQuestions: [], nextSteps: [{ text: "Step.", cardIds: ideaIds }],
  };
  const record = conclusionRecord({ request, result, model: "verification-fixture", generatedAt: new Date().toISOString() },
    { title, markdown: `Body for ${title}.` }, keptBy, new Date().toISOString());
  room.batch(() => syncBoardConclusion(room.getStorageOrNull(), record));
  return record;
}
async function until(check, label) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (check()) return;
    await pause(50);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

try {
  const { room: first, leave: leaveFirst } = await connect(randomUUID(), "Alice", { initialize: true });
  const { room: second } = await connect(randomUUID(), "Bob");
  const { room: reader } = await connect(randomUUID(), "Reader", { readOnly: true });
  assert.equal(board(second).conclusion, null);

  const firstRecord = keep(first, ["a", "b"], "First conclusion", "Alice");
  await until(() => board(second).conclusion?.title === "First conclusion", "the first conclusion on the second client");
  await until(() => board(reader).conclusion?.title === "First conclusion", "the first conclusion on the read-only client");
  assert.deepEqual(board(second).conclusion, firstRecord);

  assert.throws(() => reader.batch(() => syncBoardConclusion(reader.getStorageOrNull(), null)), "a read-only client must not change the conclusion");
  await pause(500);
  assert.equal(board(first).conclusion?.title, "First conclusion");

  const secondRecord = keep(second, ["b"], "Second conclusion", "Bob");
  await until(() => board(first).conclusion?.title === "Second conclusion", "the replacement on the first client");
  assert.deepEqual(board(first).conclusion, secondRecord);
  assert.deepEqual(board(first).conclusion.request.notes.map((note) => note.id), ["b"]);

  await until(() => second.getStorageStatus() === "synchronized", "saved conclusion");
  leaveFirst();
  exits.splice(exits.indexOf(leaveFirst), 1);
  const { room: reloaded } = await connect(randomUUID(), "Alice again");
  assert.deepEqual(board(reloaded).conclusion, secondRecord);
  assert.deepEqual(board(reloaded).ideas, originalIdeas);
  assert.deepEqual(board(reloaded).votes, originalVotes.map(([, vote]) => vote));
  console.log("Liveblocks conclusion passed: older-room initialization, sync to a second and a read-only client, read-only write rejection, whole replacement, reload persistence, and unchanged ideas and votes.");
} finally {
  exits.splice(0).forEach((leave) => leave());
  await liveblocks.deleteRoom(roomId);
}
