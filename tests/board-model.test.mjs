import assert from "node:assert/strict";
import test from "node:test";
import { createRelationship, deleteIdea, updateIdea } from "../src/features/board/model.ts";
import { initialBoard } from "../src/features/board/fixtures.ts";

test("deleting an idea removes every relationship attached to it", () => {
  const next = deleteIdea(initialBoard, "study-rooms");
  assert.equal(next.ideas.some((idea) => idea.id === "study-rooms"), false);
  assert.equal(next.relationships.some((link) => link.source === "study-rooms" || link.target === "study-rooms"), false);
  assert.equal(initialBoard.ideas.length, 5);
});

test("text edits and deletions preserve the group snapshot and mark it stale", () => {
  const board = {
    ...initialBoard,
    clusterSnapshot: { revision: "rev-1", stale: false, result: { groups: [{ noteIds: ["study-rooms"] }] }, bubbles: [] },
  };
  const edited = updateIdea(board, "study-rooms", { content: "updated" });
  assert.equal(edited.clusterSnapshot.stale, true);
  assert.equal(board.clusterSnapshot.stale, false);
  const deleted = deleteIdea(board, "study-rooms");
  assert.equal(deleted.clusterSnapshot.stale, true);
  assert.equal(deleted.clusterSnapshot.revision, "rev-1");
});

test("self links and reversed symmetric duplicates are rejected", () => {
  const self = createRelationship(initialBoard, { id: "self", source: "study-rooms", target: "study-rooms", type: "conflict", explanation: "" });
  assert.equal(self, initialBoard);
  const reverse = createRelationship(initialBoard, { id: "reverse", source: "peer-matching", target: "study-rooms", type: "synergy", explanation: "" });
  assert.equal(reverse, initialBoard);
  const directed = createRelationship(initialBoard, { id: "directed", source: "study-rooms", target: "scheduling", type: "extends", explanation: "" });
  assert.equal(directed.relationships.length, initialBoard.relationships.length + 1);
});
