import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href, context);
    }
    if (specifier.startsWith("./") && context.parentURL?.includes("/src/features/board/") && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(new URL(specifier + ".ts", context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { assistantActionIsCurrent, acceptAssistantCreate, makeAssistantActionDraft } = await import("../src/features/board/assistant-actions.ts");
const board = {
  ideas: [
    { id: "idea-a", title: "Daily task", content: "Start with a short challenge.", author: "A", position: { x: 0, y: 0 }, pinned: false, parentIds: [] },
    { id: "idea-b", title: "Study partner", content: "A friend checks in after studying.", author: "B", position: { x: 360, y: 0 }, pinned: false, parentIds: [] },
  ],
  relationships: [],
};
const action = {
  kind: "create",
  why: "Pair a small task with a check-in.",
  title: "Shared study routine",
  content: "Start a short challenge and check in with a partner.",
  basedOn: ["idea-a", "idea-b"],
};
const snapshot = board.ideas.map(({ id, title, content, author }) => ({ id, title, content, author }));
const draft = () => makeAssistantActionDraft("message-1:action:0", action, snapshot, "test-model", "2026-10-07T10:30:00.000Z");

test("assistant create acceptance preserves parents and saves generation provenance", () => {
  const current = draft();
  current.title = "A shared routine";
  const next = acceptAssistantCreate(board, current, "idea-new", "Person C");
  const created = next.ideas.find(({ id }) => id === "idea-new");
  assert.ok(created);
  assert.deepEqual(created.parentIds, ["idea-a", "idea-b"]);
  assert.equal(created.title, "A shared routine");
  assert.equal(created.assistant.generated.title, action.title);
  assert.equal(created.assistant.model, "test-model");
  assert.equal(created.author, "Person C");
  assert.deepEqual(next.ideas.slice(0, 2), board.ideas);
  assert.ok(created.position.y > 0);
});

test("assistant create acceptance stores each source parent once", () => {
  const repeatedSource = makeAssistantActionDraft("message-1:action:0", { ...action, basedOn: ["idea-a", "idea-a", "idea-b"] }, snapshot, "test-model", "2026-10-07T10:30:00.000Z");
  const next = acceptAssistantCreate(board, repeatedSource, "idea-new", "Person C");
  assert.deepEqual(next.ideas.find(({ id }) => id === "idea-new").parentIds, ["idea-a", "idea-b"]);
});

test("assistant action snapshots become stale after a source edit or deletion", () => {
  const current = draft();
  const deleted = { ...board, ideas: [board.ideas[0]] };
  assert.equal(assistantActionIsCurrent(board, current), true);
  assert.equal(assistantActionIsCurrent({ ...board, ideas: board.ideas.map((idea) => idea.id === "idea-a" ? { ...idea, content: "Changed" } : idea) }, current), false);
  assert.equal(assistantActionIsCurrent(deleted, current), false);
  assert.equal(acceptAssistantCreate(deleted, current, "idea-new", "Person C"), deleted);
});

test("assistant create acceptance rejects invalid edited content and a reused id", () => {
  const tooLong = draft();
  tooLong.content = "x".repeat(4000);
  assert.equal(acceptAssistantCreate(board, tooLong, "idea-new", "Person C"), board);
  assert.equal(acceptAssistantCreate(board, draft(), "idea-a", "Person C"), board);
});
