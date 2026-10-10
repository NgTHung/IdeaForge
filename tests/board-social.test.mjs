import assert from "node:assert/strict";
import test from "node:test";
import { addDecoration, appendSignal, moveDecoration, removeDecoration, signalLifetime, socialSignalSchema, canOpenCursorChat } from "../src/features/board/board-social-contract.ts";
import { setObjectAppearance } from "../src/features/board/personalization.ts";

const board = { ideas: [{ id: "source", title: "Source", content: "Original", merge: { sources: [{ id: "ancestor", content: "Snapshot" }] } }], relationships: [], clusterSnapshot: { revision: "r", result: { groups: [{ id: "group", label: "Saved name", noteIds: ["source"] }], assignments: [], notePairs: [] } } };
const sticker = { id: "sticker", kind: "star", position: { x: 100, y: 200 }, author: "Alice" };
test("decorations preserve notes, merge sources, and groups through placement, movement, and removal", () => {
  const before = structuredClone(board);
  const placed = addDecoration(board, sticker);
  const moved = moveDecoration(placed, sticker.id, { x: -40, y: 300 });
  assert.deepEqual(board, before);
  assert.equal(moved.ideas, board.ideas);
  assert.equal(moved.clusterSnapshot, board.clusterSnapshot);
  assert.equal(moved.ideas[0].merge, board.ideas[0].merge);
  assert.deepEqual(moved.decorations[0].position, { x: -40, y: 300 });
  assert.deepEqual(JSON.parse(JSON.stringify(moved)).decorations, moved.decorations);
  assert.deepEqual(removeDecoration(moved, sticker.id).decorations, []);
});
test("decoration mutations reject invalid input, duplicates, missing targets, and excess decoration counts", () => {
  const placed = addDecoration(board, sticker);
  assert.equal(addDecoration(placed, sticker), placed);
  for (const patch of [{ kind: "unknown" }, { position: { x: Infinity, y: 0 } }, { author: "" }]) assert.equal(addDecoration(board, { ...sticker, ...patch }), board);
  assert.equal(moveDecoration(placed, sticker.id, { x: NaN, y: 0 }), placed);
  assert.equal(moveDecoration(placed, "deleted", { x: 0, y: 0 }), placed);
  assert.equal(removeDecoration(board, "missing"), board);
  const full = { ...board, decorations: Array.from({ length: 200 }, (_, i) => ({ ...sticker, id: String(i) })) };
  assert.equal(addDecoration(full, sticker), full);
});
test("social messages are bounded, trimmed, and plain text; reactions accept only known choices", () => {
  const message = { id: "chat", position: { x: 10, y: 20 }, kind: "chat", value: " Hello <b>everyone</b> " };
  assert.equal(socialSignalSchema.parse(message).value, "Hello <b>everyone</b>");
  for (const value of ["", " ", "x".repeat(141)]) assert.equal(socialSignalSchema.safeParse({ ...message, value }).success, false);
  assert.equal(socialSignalSchema.safeParse({ ...message, kind: "reaction", value: "clap" }).success, true);
  assert.equal(socialSignalSchema.safeParse({ ...message, kind: "reaction", value: "custom" }).success, false);
  assert.equal(socialSignalSchema.safeParse({ ...message, position: { x: Infinity, y: 10 } }).success, false);
  assert.equal(signalLifetime(message), 6000);
  assert.equal(signalLifetime({ ...message, kind: "reaction" }), 3000);
});
test("signal queues expire old events, suppress connection-specific duplicates, and cap active events", () => {
  const signal = { id: "one", kind: "chat", value: "hi", position: { x: 0, y: 0 }, connectionId: 1, name: "Alice", expiresAt: 200 };
  const added = appendSignal([{ ...signal, id: "expired", expiresAt: 90 }], signal, 100);
  assert.deepEqual(added, [signal]);
  assert.equal(appendSignal(added, signal, 100).length, 1);
  assert.equal(appendSignal(added, { ...signal, connectionId: 2 }, 100).length, 2);
  let queue = [];
  for (let i = 0; i < 30; i++) queue = appendSignal(queue, { ...signal, id: String(i) }, 100);
  assert.equal(queue.length, 20);
  assert.equal(queue[0].id, "10");
});
test("cursor chat avoids interactive controls and open editors", () => {
  assert.equal(canOpenCursorChat(null, false), true);
  assert.equal(canOpenCursorChat(null, true), false);
  assert.equal(canOpenCursorChat({ closest: () => ({}) }, false), false);
});
test("all extra cluster themes preserve names, note content, and stored snapshots", () => {
  for (const border of ["clouds", "stars", "flowers", "paper"]) {
    const styled = setObjectAppearance(board, "cluster", "group", { color: "lavender", border, boundary: true });
    assert.equal(styled.clusterSnapshot.result.groups[0].appearance.border, border);
    assert.equal(styled.clusterSnapshot.result.groups[0].label, "Saved name");
    assert.equal(styled.clusterSnapshot.revision, "r");
    assert.equal(styled.ideas, board.ideas);
    assert.equal(setObjectAppearance(board, "idea", "source", { color: "lavender", border }), board);
  }
});

test("shared object updates reuse existing objects, remove absent fields, and report no-op changes", async () => {
  const { LiveMap, LiveObject } = await import("@liveblocks/client");
  const { syncObjectMap } = await import("../src/features/board/shared-object-map.ts");
  const original = new LiveObject({ ...sticker, extra: "old" });
  const map = new LiveMap([[sticker.id, original], ["removed", new LiveObject({ ...sticker, id: "removed" })]]);
  assert.equal(syncObjectMap(map, [sticker, { ...sticker, id: "second" }]), true);
  assert.equal(map.get(sticker.id), original);
  assert.equal(original.get("extra"), undefined);
  assert.equal(map.has("removed"), false);
  assert.equal(syncObjectMap(map, [sticker, { ...sticker, id: "second" }]), false);
});
