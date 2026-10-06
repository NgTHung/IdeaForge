import assert from "node:assert/strict";
import test from "node:test";
import { createRelationship, deleteIdea } from "../src/features/board/model.ts";
import { initialBoard } from "../src/features/board/fixtures.ts";

test("deleting an idea removes every relationship attached to it", () => {
  const next = deleteIdea(initialBoard, "study-rooms");
  assert.equal(next.ideas.some((idea) => idea.id === "study-rooms"), false);
  assert.equal(next.relationships.some((link) => link.source === "study-rooms" || link.target === "study-rooms"), false);
  assert.equal(initialBoard.ideas.length, 5);
});

test("self links and reversed symmetric duplicates are rejected", () => {
  const self = createRelationship(initialBoard, { id: "self", source: "study-rooms", target: "study-rooms", type: "conflict", explanation: "" });
  assert.equal(self, initialBoard);
  const reverse = createRelationship(initialBoard, { id: "reverse", source: "peer-matching", target: "study-rooms", type: "synergy", explanation: "" });
  assert.equal(reverse, initialBoard);
  const directed = createRelationship(initialBoard, { id: "directed", source: "study-rooms", target: "scheduling", type: "extends", explanation: "" });
  assert.equal(directed.relationships.length, initialBoard.relationships.length + 1);
});
