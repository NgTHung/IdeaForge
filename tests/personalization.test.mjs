import assert from "node:assert/strict";
import test from "node:test";
import { advanceMilestones, boardMood, cursorStyleSchema, defaultPreferences, earnedAchievements, emptyLedger, parsePreferences, reachedMilestones, recordContribution, setObjectAppearance } from "../src/features/board/personalization.ts";
import { renameClusterGroup } from "../src/features/board/cluster-state.ts";

function boardFixture() {
  return { goal: "Original goal", ideas: [
    { id: "a", title: "Original A", content: "**Source text**", author: "Alice", parentIds: [], position: { x: 0, y: 0 }, pinned: true },
    { id: "b", title: "Original B", content: "B", author: "Bob", parentIds: [], position: { x: 400, y: 0 }, pinned: false },
    { id: "merged", title: "Merged", content: "Kept concept", parentIds: ["a", "b"], merge: { sources: [{ id: "a", content: "Saved A" }, { id: "b", content: "Saved B" }] } },
  ], relationships: [{ id: "link", source: "a", target: "b", type: "extends", explanation: "Original explanation", author: "Alice" }], votes: [{ ideaId: "a", voterId: "bob", value: 1 }],
    clusterSnapshot: { revision: "revision", stale: false, result: { groups: [{ id: "g1", label: "First", noteIds: ["a"] }, { id: "g2", label: "Second", noteIds: ["b"] }], assignments: [{ noteId: "a", clusterId: "g1" }], notePairs: [{ sourceId: "a", targetId: "b", similarity: .5 }] }, bubbles: [{ clusterId: "g1", x: 1, y: 2 }] } };
}
test("defaults preserve earlier boards and themes; invalid stored preferences fail safely", () => {
  assert.deepEqual(parsePreferences(null), defaultPreferences);
  assert.equal(parsePreferences(null, "dark").theme, "dark");
  assert.deepEqual(parsePreferences("broken"), defaultPreferences);
  assert.deepEqual(parsePreferences(JSON.stringify({ ...defaultPreferences, animations: "false" })), defaultPreferences);
  const off = parsePreferences(JSON.stringify({ ...defaultPreferences, animations: false, cursor: { color: "rose", shape: "cat" } }));
  assert.equal(off.animations, false);
  assert.equal(off.cursor.shape, "cat");
  assert.equal(cursorStyleSchema.safeParse({ color: "url(secret)", shape: "cat" }).success, false);
});
test("note styles preserve content, provenance, votes, and clustering state", () => {
  const board = boardFixture(); const before = structuredClone(board);
  const styled = setObjectAppearance(board, "idea", "merged", { color: "rose", border: "cat" });
  assert.deepEqual(board, before);
  assert.equal(styled.ideas[2].merge, board.ideas[2].merge);
  assert.equal(styled.ideas[2].content, "Kept concept");
  assert.equal(styled.ideas[2].parentIds, board.ideas[2].parentIds);
  assert.equal(styled.clusterSnapshot, board.clusterSnapshot);
  assert.equal(styled.votes, board.votes);
  assert.deepEqual(styled.ideas[2].appearance, { color: "rose", border: "cat" });
});
test("relationship and cluster styles preserve their meaning, names, scores, positions, and revision", () => {
  const board = boardFixture();
  const link = setObjectAppearance(board, "relationship", "link", { color: "lavender", stroke: "dotted" });
  assert.deepEqual({ ...link.relationships[0], appearance: undefined }, { ...board.relationships[0], appearance: undefined });
  const group = setObjectAppearance(link, "cluster", "g1", { color: "mint", border: "rainbow", boundary: true });
  assert.equal(group.clusterSnapshot.revision, "revision");
  assert.equal(group.clusterSnapshot.result.groups[0].label, "First");
  assert.equal(group.clusterSnapshot.result.assignments, board.clusterSnapshot.result.assignments);
  assert.equal(group.clusterSnapshot.result.notePairs, board.clusterSnapshot.result.notePairs);
  assert.equal(group.clusterSnapshot.bubbles, board.clusterSnapshot.bubbles);
  assert.equal(group.ideas, board.ideas);
  const restored = JSON.parse(JSON.stringify(group));
  assert.deepEqual(restored.clusterSnapshot.result.groups[0].appearance, { color: "mint", border: "rainbow", boundary: true });
});
test("missing targets and invalid styles never mutate a board", () => {
  const board = boardFixture();
  assert.equal(setObjectAppearance(board, "idea", "missing", { color: "mint", border: "cat" }), board);
  assert.equal(setObjectAppearance(board, "relationship", "link", { color: "mint", stroke: "bad" }), board);
  assert.equal(setObjectAppearance(board, "cluster", "g1", { color: "mint", border: "cat", boundary: "true" }), board);
  assert.equal(setObjectAppearance({ ...board, clusterSnapshot: null }, "cluster", "g1", { color: "mint", border: "cat", boundary: true }).clusterSnapshot, null);
});
test("renaming a styled group keeps its appearance and updates the shared heading and bubble label", () => {
  const styled = setObjectAppearance(boardFixture(), "cluster", "g1", { color: "blue", border: "cat", boundary: true });
  const renamed = renameClusterGroup(styled.clusterSnapshot, "g1", "Study buddies");
  assert.equal(renamed.result.groups[0].label, "Study buddies");
  assert.equal(renamed.bubbles[0].label, "Study buddies");
  assert.deepEqual(renamed.result.groups[0].appearance, { color: "blue", border: "cat", boundary: true });
  assert.equal(renamed.result.notePairs, styled.clusterSnapshot.result.notePairs);
  assert.equal(styled.clusterSnapshot.result.groups[0].label, "First");
});
test("achievement rules count distinct new notes, and only a cross-cluster merge earns Unexpected combo", () => {
  const board = boardFixture();
  let ledger = recordContribution(emptyLedger, "a", board);
  assert.deepEqual(earnedAchievements(ledger), ["spark"]);
  ledger = recordContribution(ledger, "a", board);
  assert.equal(ledger.ideas.length, 1);
  ledger = recordContribution(ledger, "merged", board, ["a"]);
  assert.equal(ledger.crossClusterMerge, false);
  assert.equal(ledger.ideas.length, 1);
  ledger = recordContribution(ledger, "merged", board, ["a", "b"]);
  for (const id of ["b", "c", "d", "e"]) ledger = recordContribution(ledger, id, board);
  assert.deepEqual(earnedAchievements(ledger), ["spark", "combo", "gardener"]);
  assert.deepEqual(earnedAchievements(JSON.parse(JSON.stringify(ledger))), ["spark", "combo", "gardener"]);
  assert.deepEqual(emptyLedger, { ideas: [], crossClusterMerge: false });
});
test("mood comes from saved notes and merges rather than local effects", () => {
  assert.equal(boardMood({ ideas: [] }), "seed");
  assert.equal(boardMood({ ideas: [{ id: "a" }] }), "sprout");
  assert.equal(boardMood({ ideas: Array.from({ length: 10 }, (_, id) => ({ id })) }), "grown");
  assert.equal(boardMood(boardFixture()), "bloom");
});
test("team milestones celebrate only once across repeated saves, undo, redo, and initial loading", () => {
  const ten = { ideas: Array.from({ length: 10 }, (_, id) => ({ id })) };
  const first = advanceMilestones(ten, []);
  assert.deepEqual(first.celebrate, ["ten"]);
  assert.deepEqual(advanceMilestones(ten, first.reached).celebrate, []);
  const undone = advanceMilestones({ ideas: ten.ideas.slice(1) }, first.reached);
  assert.deepEqual(advanceMilestones(ten, undone.reached).celebrate, []);
  const merged = { ideas: [...ten.ideas, { id: "merged", merge: { sources: [] } }] };
  const afterMerge = advanceMilestones(merged, first.reached);
  assert.deepEqual(afterMerge.celebrate, ["merge"]);
  assert.deepEqual(advanceMilestones(merged, reachedMilestones(merged)).celebrate, []);
  assert.deepEqual(advanceMilestones(merged, afterMerge.reached).celebrate, []);
});
