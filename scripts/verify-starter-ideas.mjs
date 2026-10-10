import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient, LiveMap } from "@liveblocks/client";
import { Liveblocks } from "@liveblocks/node";
import { commitStarterIdeas } from "../src/features/board/starter-ideas.ts";
import { starterIdeasResponseSchema } from "../src/lib/starter-ideas-contract.ts";

const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
if (!secret) throw new Error("Set LIVEBLOCKS_SECRET_KEY to run this check.");
const service = new Liveblocks({ secret });
const roomId = `ideaforge:${randomUUID()}`;
const exits = [];

async function connect(initialize = false) {
  const session = service.prepareSession(randomUUID());
  session.allow(roomId, session.FULL_ACCESS);
  const response = await session.authorize();
  if (response.status !== 200) throw new Error(`Liveblocks authorization returned ${response.status}.`);
  const client = createClient({ authEndpoint: async () => JSON.parse(response.body) });
  const options = { initialPresence: {} };
  if (initialize) options.initialStorage = {
    title: "Reduce campus food waste", goal: "Reduce campus food waste",
    ideas: new LiveMap(), relationships: new LiveMap(), clusterSnapshot: null, starterIdeasState: null,
  };
  const { room, leave } = client.enterRoom(roomId, options);
  exits.push(leave);
  await room.getStorage();
  return room;
}

async function until(check, label) {
  const end = Date.now() + 15_000;
  while (Date.now() < end) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

try {
  const owner = await connect(true);
  const peer = await connect();
  const result = starterIdeasResponseSchema.parse({
    attemptId: randomUUID(), title: "Reduce campus food waste", description: "Explore five approaches.",
    ideas: Array.from({ length: 5 }, (_, index) => ({
      title: `Idea ${index + 1}`,
      description: `Use approach ${index + 1} to reduce food waste with a different student-led activity.`,
      approach: `Approach ${index + 1}`,
    })),
    model: "verification-fixture", generatedAt: new Date().toISOString(),
  });
  owner.batch(() => assert.equal(commitStarterIdeas(owner.getStorageOrNull(), result, result.description), true));
  await until(() => peer.getStorageOrNull()?.get("ideas")?.size === 5 &&
    peer.getStorageOrNull()?.get("starterIdeasState")?.get("status") === "completed", "shared starter notes");
  owner.batch(() => assert.equal(commitStarterIdeas(owner.getStorageOrNull(), result, result.description), false));
  assert.equal(owner.getStorageOrNull().get("ideas").size, 5);
  const noteId = [...peer.getStorageOrNull().get("ideas").keys()][0];
  peer.getStorageOrNull().get("ideas").get(noteId).set("content", "A participant edited this starting idea.");
  await until(() => owner.getStorageOrNull().get("ideas").get(noteId).get("content") === "A participant edited this starting idea.", "shared edit");
  const reloaded = await connect();
  assert.equal(reloaded.getStorageOrNull().get("ideas").size, 5);
  assert.equal(reloaded.getStorageOrNull().get("ideas").get(noteId).get("content"), "A participant edited this starting idea.");
  console.log("Starter idea room check passed: five shared notes, one batch marker, duplicate guard, edit sync, and reconnect.");
} finally {
  for (const leave of exits) leave();
  await service.deleteRoom(roomId);
}
