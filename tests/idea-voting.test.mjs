import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { LiveMap, LiveObject } from "@liveblocks/client";
import { deleteIdea, updateIdea } from "../src/features/board/model.ts";
import { scoreForIdea, toggleIdeaUpvote, upvotersForIdea, voteByUser, voterNameFor } from "../src/features/board/idea-voting.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith("/shared-votes.ts") && !specifier.endsWith(".ts")) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { syncIdeaVotes } = await import("../src/features/board/shared-votes.ts");

const idea = (id) => ({ id, title: id, content: "Original note", position: { x: 0, y: 0 }, pinned: false, parentIds: [] });
const board = { ideas: [idea("a"), idea("b"), { ...idea("merged"), parentIds: ["a", "b"], merge: {
  sources: [{ id: "a", title: "a", content: "Saved source", author: "Alice" }],
} }], relationships: [] };

test("upvotes toggle independently per stable participant and idea", () => {
  const first = toggleIdeaUpvote(board, "a", "alice", "Alice");
  const second = toggleIdeaUpvote(first, "a", "bob", "Bob");
  const third = toggleIdeaUpvote(second, "b", "alice", "Alice");
  assert.equal(scoreForIdea(third.votes, "a"), 2);
  assert.equal(scoreForIdea(third.votes, "b"), 1);
  const removed = toggleIdeaUpvote(third, "a", "alice", "Alice");
  assert.equal(voteByUser(removed.votes, "a", "alice"), false);
  assert.equal(voteByUser(removed.votes, "a", "bob"), true);
  assert.equal(voteByUser(removed.votes, "b", "alice"), true);
  assert.deepEqual(upvotersForIdea(removed.votes, "a").map(voterNameFor), ["Bob"]);
});

test("voting stores trimmed names and preserves ideas, ancestry, and source snapshots", () => {
  const before = structuredClone(board);
  const next = toggleIdeaUpvote(board, "merged", "alice", "  Alice  ");
  assert.deepEqual(next.votes, [{ ideaId: "merged", voterId: "alice", voterName: "Alice", value: 1 }]);
  assert.equal(next.ideas, board.ideas);
  assert.equal(next.relationships, board.relationships);
  assert.deepEqual(board, before);
  const reloaded = JSON.parse(JSON.stringify(next));
  assert.equal(scoreForIdea(reloaded.votes, "merged"), 1);
  assert.equal(voterNameFor(reloaded.votes[0]), "Alice");
  assert.deepEqual(reloaded.ideas, before.ideas);
  assert.equal(toggleIdeaUpvote(reloaded, "merged", "alice", "Renamed Alice").votes.length, 0);
});

test("legacy downvotes never count and can be replaced by an upvote", () => {
  const legacy = { ...board, votes: [
    { ideaId: "a", voterId: "alice", value: -1 },
    { ideaId: "a", voterId: "bob", value: 1 },
  ] };
  assert.equal(scoreForIdea(legacy.votes, "a"), 1);
  assert.equal(voteByUser(legacy.votes, "a", "alice"), false);
  assert.equal(voterNameFor(upvotersForIdea(legacy.votes, "a")[0]), "Guest bob");
  const next = toggleIdeaUpvote(legacy, "a", "alice", "Alice");
  assert.equal(scoreForIdea(next.votes, "a"), 2);
  assert.equal(next.votes.filter((vote) => vote.voterId === "alice").length, 1);
  assert.equal(next.votes.find((vote) => vote.voterId === "alice").value, 1);
});

test("scores count distinct participants, including people with identical names", () => {
  const votes = [
    { ideaId: "a", voterId: "first", voterName: "Alex", value: 1 },
    { ideaId: "a", voterId: "second", voterName: "Alex", value: 1 },
    { ideaId: "a", voterId: "first", voterName: "Alex", value: 1 },
  ];
  assert.equal(scoreForIdea(votes, "a"), 2);
  assert.equal(scoreForIdea(undefined, "a"), 0);
  assert.equal(scoreForIdea(votes, "missing"), 0);
});

test("missing ideas and empty voter identities cannot create votes", () => {
  assert.equal(toggleIdeaUpvote(board, "missing", "alice", "Alice"), board);
  assert.equal(toggleIdeaUpvote(board, "a", "", "Alice"), board);
  assert.equal(toggleIdeaUpvote(board, "a", "   ", "Alice"), board);
  assert.equal(voterNameFor(toggleIdeaUpvote(board, "a", "alice", " ").votes[0]), "Guest alic");
  assert.equal(toggleIdeaUpvote(board, "a", "alice", "x".repeat(100)).votes[0].voterName.length, 60);
});

test("editing leaves votes intact and deleting removes only that idea's votes", () => {
  const next = toggleIdeaUpvote(toggleIdeaUpvote(board, "a", "alice", "Alice"), "b", "bob", "Bob");
  const edited = updateIdea(next, "a", { title: "Changed title" });
  assert.equal(edited.votes, next.votes);
  const removed = deleteIdea(edited, "a");
  assert.deepEqual(removed.votes, [{ ideaId: "b", voterId: "bob", voterName: "Bob", value: 1 }]);
  assert.deepEqual(removed.ideas.find((idea) => idea.id === "merged").merge, board.ideas[2].merge);
});

test("older rooms initialize vote storage on the first upvote and skip unchanged writes", () => {
  const storage = new LiveObject({ title: "Older room", ideas: new LiveMap(), relationships: new LiveMap(), clusterSnapshot: null });
  assert.equal(syncIdeaVotes(storage, []), false);
  assert.equal(storage.get("votes"), undefined);
  const votes = toggleIdeaUpvote(board, "a", "alice", "Alice").votes;
  assert.equal(syncIdeaVotes(storage, votes), true);
  assert.deepEqual([...storage.get("votes").values()], votes);
  assert.equal(syncIdeaVotes(storage, structuredClone(votes)), false);
  assert.equal(syncIdeaVotes(storage, []), true);
  assert.equal(storage.get("votes").size, 0);
});

test("vote storage updates names and removes only votes absent from the next board", () => {
  const storage = new LiveObject({ votes: new LiveMap() });
  const voted = toggleIdeaUpvote(toggleIdeaUpvote(board, "a", "alice", "Alice"), "b", "bob", "Bob");
  syncIdeaVotes(storage, voted.votes);
  const renamed = voted.votes.map((vote) => vote.voterId === "bob" ? { ...vote, voterName: "Robert" } : vote);
  assert.equal(syncIdeaVotes(storage, renamed), true);
  syncIdeaVotes(storage, renamed.filter((vote) => vote.ideaId !== "a"));
  assert.deepEqual([...storage.get("votes").values()], [{ ideaId: "b", voterId: "bob", voterName: "Robert", value: 1 }]);
});
