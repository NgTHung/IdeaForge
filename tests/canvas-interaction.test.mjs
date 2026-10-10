import assert from "node:assert/strict";
import test from "node:test";
import { canDragIdea, displayIdeas, reactionShortcut, signalPosition } from "../src/features/board/canvas-interaction.ts";
import { IDEA_CARD_SIZE, moveIdea, updateIdea } from "../src/features/board/model.ts";
import { routeCanvasEdges } from "../src/features/board/edge-routing.ts";

const idea = (id, x, y) => ({ id, title: id, content: "Source text", position: { x, y }, pinned: false, parentIds: [] });
test("typed links and ancestry routes attach to the displayed note throughout a drag", () => {
  const ideas = [idea("a", 0, 0), idea("b", 800, 0), { ...idea("merged", 1200, 500), parentIds: ["a"] }];
  const links = [{ id: "typed", source: "a", target: "b" }, { id: "ancestry:a:merged", source: "a", target: "merged" }];
  const original = structuredClone(ideas);
  for (const position of [{ x: 100, y: 150 }, { x: -200, y: 300 }]) {
    const displayed = displayIdeas(ideas, { a: position });
    const routes = routeCanvasEdges(displayed, links);
    for (const link of links) {
      const endpoint = routes.get(link.id).points[0];
      assert.ok(endpoint.x >= position.x && endpoint.x <= position.x + IDEA_CARD_SIZE.width);
      assert.ok(endpoint.y >= position.y && endpoint.y <= position.y + IDEA_CARD_SIZE.height);
      assert.ok(endpoint.x === position.x || endpoint.x === position.x + IDEA_CARD_SIZE.width || endpoint.y === position.y || endpoint.y === position.y + IDEA_CARD_SIZE.height);
    }
    assert.equal(displayed[1], ideas[1]);
  }
  assert.deepEqual(ideas, original);
});
test("pinning rejects a stale drag preview and commit; unpinning restores movement", () => {
  const original = { ideas: [idea("a", 0, 0)], relationships: [] };
  const pinned = updateIdea(original, "a", { pinned: true });
  assert.equal(canDragIdea(pinned, "a", true), false);
  assert.equal(displayIdeas(pinned.ideas, { a: { x: 99, y: 88 } })[0], pinned.ideas[0]);
  assert.equal(moveIdea(pinned, "a", { x: 99, y: 88 }), pinned);
  assert.equal(moveIdea(original, "missing", { x: 99, y: 88 }), original);
  assert.equal(moveIdea(original, "a", { x: 0, y: 0 }), original);
  const unpinned = updateIdea(pinned, "a", { pinned: false });
  assert.equal(canDragIdea(unpinned, "a", true), true);
  assert.equal(canDragIdea(unpinned, "a", false), false);
  const moved = moveIdea(unpinned, "a", { x: 99, y: 88 });
  assert.deepEqual(moved.ideas[0].position, { x: 99, y: 88 });
  assert.equal(moved.ideas[0].content, original.ideas[0].content);
  assert.equal(moved.ideas[0].parentIds, original.ideas[0].parentIds);
});
test("chat follows its sender, while reactions retain their emission position", () => {
  const chat = { kind: "chat", connectionId: 7, position: { x: 10, y: 20 } };
  const positions = { 7: { x: 40, y: 50 }, 8: { x: 900, y: 900 } };
  assert.equal(signalPosition(chat, positions), positions[7]);
  assert.equal(signalPosition(chat, {}), chat.position);
  assert.equal(signalPosition({ ...chat, kind: "reaction" }, positions), chat.position);
});
test("R opens reactions only outside typing, dialogs, composition, repeated keys, and modifier shortcuts", () => {
  const key = { key: "r", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, repeat: false, blocked: false };
  assert.equal(reactionShortcut(key), true);
  assert.equal(reactionShortcut({ ...key, key: "R" }), true);
  for (const flag of ["ctrlKey", "metaKey", "altKey", "shiftKey", "isComposing", "repeat", "blocked"]) assert.equal(reactionShortcut({ ...key, [flag]: true }), false);
  assert.equal(reactionShortcut({ ...key, key: "Enter" }), false);
});
