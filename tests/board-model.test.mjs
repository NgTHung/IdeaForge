import assert from "node:assert/strict";
import test from "node:test";
import { createRelationship, deleteIdea, updateIdea, updateRelationship } from "../src/features/board/model.ts";
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
  const directed = createRelationship(initialBoard, { id: "directed", source: "study-rooms", target: "scheduling", type: "extends", explanation: "Adds a way to book sessions." });
  assert.equal(directed.relationships.length, initialBoard.relationships.length + 1);
});

test("conflict relationships require a condition and link edits reject duplicates", async () => {
  const missingCondition = createRelationship(initialBoard, { id: "conflict-no-condition", source: "study-rooms", target: "peer-matching", type: "conflict", explanation: "These may compete." });
  assert.equal(missingCondition, initialBoard);
  const conflict = createRelationship(initialBoard, { id: "conflict", source: "study-rooms", target: "peer-matching", type: "conflict", explanation: "These compete in one room.", condition: "During individual exams." });
  assert.equal(conflict.relationships.at(-1).condition, "During individual exams.");
  const duplicate = updateRelationship(conflict, "conflict", { type: "synergy", explanation: "Matched peers can meet in a shared room." });
  assert.equal(duplicate, conflict);
  const edited = updateRelationship(conflict, "conflict", { condition: "During quiet study hours." });
  assert.equal(edited.relationships.at(-1).condition, "During quiet study hours.");
});

test("changing a conflict link to another type removes its obsolete condition", () => {
  const board = { ideas: [{ id: "a" }, { id: "b" }], relationships: [] };
  const conflict = createRelationship(board, { id: "conflict", source: "a", target: "b", type: "conflict", explanation: "They compete", condition: "At the same time" });
  const updated = updateRelationship(conflict, "conflict", { type: "synergy", explanation: "They support each other" });
  assert.equal(updated.relationships[0].condition, undefined);
  assert.equal(conflict.relationships[0].condition, "At the same time");
});
