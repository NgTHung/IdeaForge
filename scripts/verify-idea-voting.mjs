import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { Liveblocks } from "@liveblocks/node";
import { toggleIdeaUpvote, scoreForIdea, voterNameFor, upvotersForIdea } from "../src/features/board/idea-voting.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith("/shared-votes.ts") && !specifier.endsWith(".ts")) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { syncIdeaVotes } = await import("../src/features/board/shared-votes.ts");
const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
if (!secret) throw new Error("Set LIVEBLOCKS_SECRET_KEY in .env to run this integration check.");
const liveblocks = new Liveblocks({ secret });
const roomId = `ideaforge:${randomUUID()}`;
const exits = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const originalIdeas = [
  { id: "a", title: "A", content: "Original A", position: { x: 0, y: 0 }, pinned: false, parentIds: [] },
  { id: "b", title: "B", content: "Original B", position: { x: 300, y: 0 }, pinned: false, parentIds: ["a"],
    merge: { sources: [{ id: "a", title: "A", content: "Source snapshot", author: "Original author" }] } },
];

async function connect(userId, name, initialize = false) {
  const session = liveblocks.prepareSession(userId, { userInfo: { name } });
  session.allow(roomId, session.FULL_ACCESS);
  const response = await session.authorize();
  if (response.status !== 200) throw new Error(`Liveblocks auth failed with HTTP ${response.status}.`);
  const auth = JSON.parse(response.body);
  const client = createClient({ authEndpoint: async () => auth });
  const options = { initialPresence: {} };
  if (initialize) options.initialStorage = {
    title: "Voting verification", ideas: new LiveMap(originalIdeas.map((idea) => [idea.id, new LiveObject(idea)])),
    relationships: new LiveMap(), clusterSnapshot: null,
  };
  const { room, leave } = client.enterRoom(roomId, options);
  exits.push(leave);
  await room.getStorage();
  return { room, leave };
}

function board(room) {
  const storage = room.getStorageOrNull();
  return { ideas: [...storage.get("ideas").values()].map((idea) => idea.toJSON()), relationships: [],
    votes: [...storage.get("votes")?.values() ?? []] };
}
function upvote(room, ideaId, voterId, voterName) {
  room.batch(() => syncIdeaVotes(room.getStorageOrNull(), toggleIdeaUpvote(board(room), ideaId, voterId, voterName).votes));
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
  const aliceId = randomUUID();
  const bobId = randomUUID();
  const { room: first, leave: leaveFirst } = await connect(aliceId, "Alice", true);
  const { room: second } = await connect(bobId, "Bob");
  upvote(first, "a", aliceId, "Alice");
  await until(() => scoreForIdea(board(second).votes, "a") === 1, "first upvote and lazy vote map");
  upvote(second, "a", bobId, "Bob");
  await until(() => scoreForIdea(board(first).votes, "a") === 2, "second participant's upvote");
  assert.deepEqual(upvotersForIdea(board(first).votes, "a").map(voterNameFor).sort(), ["Alice", "Bob"]);

  upvote(first, "b", aliceId, "Alice");
  upvote(second, "b", bobId, "Bob");
  await until(() => [first, second].every((room) => scoreForIdea(board(room).votes, "b") === 2), "concurrent upvotes");
  await until(() => first.getStorageStatus() === "synchronized", "saved votes");
  leaveFirst();
  exits.splice(exits.indexOf(leaveFirst), 1);
  assert.equal(voterNameFor(upvotersForIdea(board(second).votes, "a").find((vote) => vote.voterId === aliceId)), "Alice");

  const { room: reloaded } = await connect(aliceId, "Renamed Alice");
  assert.equal(scoreForIdea(board(reloaded).votes, "a"), 2);
  assert.equal(scoreForIdea(board(reloaded).votes, "b"), 2);
  assert.deepEqual(board(reloaded).ideas, originalIdeas);
  upvote(reloaded, "a", aliceId, "Renamed Alice");
  await until(() => scoreForIdea(board(second).votes, "a") === 1, "removal after reconnect with the same ID");
  assert.equal(scoreForIdea(board(second).votes, "b"), 2);
  assert.equal(voterNameFor(upvotersForIdea(board(second).votes, "a")[0]), "Bob");
  assert.deepEqual(board(second).ideas, originalIdeas);
  console.log("Liveblocks voting passed: older-room initialization, named upvotes, concurrent votes, offline names, reload persistence, stable identity, removal, and unchanged notes and snapshots.");
} finally {
  exits.splice(0).forEach((leave) => leave());
  await liveblocks.deleteRoom(roomId);
}
