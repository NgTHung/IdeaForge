import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (specifier.startsWith(".") && context.parentURL?.startsWith(new URL("../src/", import.meta.url).href) && !/\.[cm]?[jt]sx?$/.test(specifier)) return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
    return nextResolve(specifier, context);
  },
});
const { clusterCards } = await import("../src/lib/cluster-algorithm.ts");
const { clusterAssignmentRequestSchema, clusterAssignmentResponseSchema, clusterRequestSchema, clusterResponseSchema } = await import("../src/lib/cluster-contract.ts");
const { assignCardToGroup } = await import("../src/lib/cluster-assignment.ts");
const { layoutClusters, placeNewNote } = await import("../src/features/board/cluster-layout.ts");
const { appendClusterAssignment } = await import("../src/features/board/cluster-state.ts");
const { POST } = await import("../src/app/api/similarity/clusters/route.ts");
const { POST: assignPOST } = await import("../src/app/api/similarity/clusters/assign/route.ts");

const cards = ["a", "b", "c", "d"].map((id) => ({ id, text: `idea ${id}` }));
const similarity = {
  method: "mean_centered_cosine",
  embeddingModel: "test-embedding-model",
  centeredThreshold: 8,
  scores: [
    { sourceId: "a", targetId: "b", score: 0.9 },
    { sourceId: "a", targetId: "c", score: 0.1 },
    { sourceId: "a", targetId: "d", score: 0.2 },
    { sourceId: "b", targetId: "c", score: 0.2 },
    { sourceId: "b", targetId: "d", score: 0.1 },
    { sourceId: "c", targetId: "d", score: 0.8 },
  ],
};

test("cluster request validates count, card count, and duplicate IDs", () => {
  assert.equal(clusterRequestSchema.safeParse({ cards, clusterCount: 2 }).success, true);
  assert.equal(clusterRequestSchema.safeParse({ cards, clusterCount: 5 }).success, false);
  assert.equal(clusterRequestSchema.safeParse({ cards: [{ id: "a", text: "a" }, { id: "a", text: "b" }], clusterCount: 2 }).success, false);
});

test("average linkage makes deterministic groups and complete score assignments", () => {
  const result = clusterCards(cards, similarity, 2);
  assert.deepEqual(result.groups.map((group) => group.noteIds), [["a", "b"], ["c", "d"]]);
  assert.equal(result.embeddingModel, "test-embedding-model");
  assert.equal(result.groups[0].meanPairSimilarity, 0.9);
  assert.equal(result.groupPairs.length, 1);
  assert.equal(result.groupPairs[0].meanCrossSimilarity, 0.15);
  assert.equal(result.notePairs.length, 6);
  const firstPair = result.notePairs.find((pair) => pair.sourceId === "a" && pair.targetId === "b");
  assert.equal(firstPair.similarity, 0.9);
  assert.ok(Math.abs(firstPair.distance - 0.1) < 1e-8);
  assert.equal(clusterResponseSchema.safeParse({ ...result, notePairs: result.notePairs.slice(1) }).success, false);
  assert.equal(result.assignments.find((item) => item.noteId === "a").closestMember.noteId, "b");
  assert.equal(result.assignments.find((item) => item.noteId === "a").closestOutside.noteId, "d");
  assert.equal(clusterResponseSchema.safeParse(result).success, true);
  assert.deepEqual(clusterCards([...cards].reverse(), similarity, 2).groups, result.groups);
  const threeGroups = clusterCards(cards, similarity, 3);
  const singleton = threeGroups.groups.find((group) => group.size === 1);
  assert.equal(threeGroups.groups.length, 3);
  assert.equal(singleton.meanPairSimilarity, null);
  assert.equal(threeGroups.assignments.find((assignment) => assignment.noteId === singleton.noteIds[0]).closestMember, null);
});

test("layout leaves pinned and excluded ideas still in place and separates cards", () => {
  const result = clusterCards(cards, similarity, 2);
  const ideas = cards.map((card, index) => ({
    ...card, title: card.id, content: card.text,
    position: { x: index * 12, y: index * 8 }, pinned: card.id === "a", parentIds: [],
  })).concat([{ id: "empty", title: "New idea", content: "", position: { x: 400, y: 400 }, pinned: false, parentIds: [] }]);
  const layout = layoutClusters(ideas, result);
  assert.equal(layout.positions.has("a"), false);
  assert.equal(layout.positions.has("empty"), false);
  assert.equal(layout.bubbles.length, 2);
  for (const [firstId, first] of layout.positions) {
    for (const [secondId, second] of layout.positions) {
      if (firstId >= secondId) continue;
      assert.ok(first.x + 272 <= second.x || second.x + 272 <= first.x || first.y + 148 <= second.y || second.y + 148 <= first.y);
    }
  }
  assert.ok(Math.hypot(layout.bubbles[0].centerX - layout.bubbles[1].centerX, layout.bubbles[0].centerY - layout.bubbles[1].centerY) > 0);
  const positionedIdeas = ideas.map((idea) => ({ ...idea, position: layout.positions.get(idea.id) ?? idea.position }));
  const newIdea = {
    id: "e", title: "new", content: "new", position: { x: 500, y: 500 }, pinned: false, parentIds: [],
  };
  const newAssignment = assignCardToGroup({
    revision: "r1", newCard: { id: "e", text: "new" },
    groups: result.groups.map((group) => ({
      id: group.id, representativeNoteId: group.representativeNoteId,
      cards: group.noteIds.map((id) => cards.find((card) => card.id === id)),
    })),
  }, { ...similarity, scores: [...similarity.scores,
    { sourceId: "e", targetId: "a", score: 0.8 }, { sourceId: "e", targetId: "b", score: 0.9 },
    { sourceId: "e", targetId: "c", score: 0.2 }, { sourceId: "e", targetId: "d", score: 0.1 },
  ] });
  const placed = placeNewNote(newIdea, result.groups[0].id, result.groups[0].noteIds,
    newAssignment, layout.bubbles[0], positionedIdeas, {}, layout.bubbles);
  assert.ok(placed);
  assert.equal(placed.bubble.size, layout.bubbles[0].size + 1);
  assert.ok(positionedIdeas.every((idea) => placed.position.x + 272 <= idea.position.x || idea.position.x + 272 <= placed.position.x ||
    placed.position.y + 148 <= idea.position.y || idea.position.y + 148 <= placed.position.y));
});

test("layout uses note-pair scores to make the stronger match closer within a group", () => {
  const example = ["a", "b", "c", "d", "e"].map((id) => ({ id, text: id }));
  const scores = [
    ["a", "b", 0.95], ["a", "c", 0.35], ["b", "c", 0.40],
    ["d", "e", 0.94],
    ["a", "d", 0.05], ["a", "e", 0.04], ["b", "d", 0.06],
    ["b", "e", 0.03], ["c", "d", 0.02], ["c", "e", 0.01],
  ].map(([sourceId, targetId, score]) => ({ sourceId, targetId, score }));
  const result = clusterCards(example, { ...similarity, scores }, 2);
  const ideas = example.map((card) => ({ id: card.id, title: card.id, content: card.text,
    position: { x: 0, y: 0 }, pinned: false, parentIds: [] }));
  const layout = layoutClusters(ideas, result);
  const distance = (first, second) => Math.hypot(layout.positions.get(first).x - layout.positions.get(second).x,
    layout.positions.get(first).y - layout.positions.get(second).y);
  assert.ok(distance("a", "b") < distance("a", "c"));
  assert.ok(layout.bubbles[0].x + layout.bubbles[0].width < layout.bubbles[1].x ||
    layout.bubbles[1].x + layout.bubbles[1].width < layout.bubbles[0].x);
});

test("incremental assignment validates groups and chooses the strongest mean similarity", () => {
  const request = {
    newCard: { id: "e", text: "new" }, revision: "rev-1",
    groups: [
      { id: "group-2", representativeNoteId: "c", cards: [{ id: "c", text: "c" }, { id: "d", text: "d" }] },
      { id: "group-1", representativeNoteId: "a", cards: [{ id: "a", text: "a" }, { id: "b", text: "b" }] },
    ],
  };
  assert.equal(clusterAssignmentRequestSchema.safeParse(request).success, true);
  assert.equal(clusterAssignmentRequestSchema.safeParse({ ...request, groups: [request.groups[0], { ...request.groups[1], cards: [{ id: "c", text: "duplicate" }] }] }).success, false);
  const similarity = {
    method: "mean_centered_cosine", embeddingModel: "test", centeredThreshold: 8,
    scores: [
      { sourceId: "a", targetId: "b", score: 0.9 }, { sourceId: "a", targetId: "c", score: 0.1 },
      { sourceId: "a", targetId: "d", score: 0.2 }, { sourceId: "b", targetId: "c", score: 0.2 },
      { sourceId: "b", targetId: "d", score: 0.1 }, { sourceId: "c", targetId: "d", score: 0.8 },
      { sourceId: "e", targetId: "a", score: 0.2 }, { sourceId: "e", targetId: "b", score: 0.4 },
      { sourceId: "e", targetId: "c", score: 0.8 }, { sourceId: "e", targetId: "d", score: 0.6 },
    ],
  };
  const result = assignCardToGroup(request, similarity);
  assert.equal(result.chosenGroupId, "group-2");
  assert.equal(result.groups.find((group) => group.groupId === "group-2").meanSimilarity, 0.7);
  assert.equal(result.groups.find((group) => group.groupId === "group-2").closestMember.noteId, "c");
  assert.equal(result.notePairs.length, 10);
  assert.equal(clusterAssignmentResponseSchema.safeParse(result).success, true);
  assert.deepEqual(assignCardToGroup({ ...request, groups: [...request.groups].reverse() }, similarity), result);
  const baseSimilarity = { ...similarity, scores: similarity.scores.filter((pair) => pair.sourceId !== "e" && pair.targetId !== "e") };
  const base = clusterCards(cards, baseSimilarity, 2);
  const snapshot = {
    revision: "rev-1", stale: false, result: base,
    bubbles: base.groups.map((group, index) => ({ clusterId: group.id, label: group.label, size: group.size, x: index * 700, y: 0, width: 500, height: 400, centerX: index * 700 + 250, centerY: 200 })),
  };
  const updated = appendClusterAssignment(snapshot, { id: "e", title: "new", content: "new", position: { x: 900, y: 300 }, pinned: false, parentIds: [] }, result, snapshot.bubbles[1], "rev-2");
  assert.equal(updated.result.noteCount, 5);
  assert.equal(updated.result.groups.find((group) => group.id === "group-2").size, 3);
  assert.equal(updated.result.assignments.find((assignment) => assignment.noteId === "e").clusterId, "group-2");
  assert.equal(updated.result.notePairs.length, 10);
  assert.equal(clusterResponseSchema.safeParse(updated.result).success, true);
  assert.equal(updated.revision, "rev-2");
});

test("clustering route reuses the embedding result and returns validated group details", async (t) => {
  process.env.GEMINI_API_KEY = "test-only-secret";
  process.env.GEMINI_EMBEDDING_MODEL = "test-cluster-embedding";
  globalThis.__IDEAFORGE_EMBEDDING_CACHE_V2__?.clear();
  const vectors = new Map(cards.map((card, index) => [card.text, [index < 2 ? 1 : 0, index < 2 ? 0 : 1]]));
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const body = JSON.parse(init.body);
    const embeddings = body.requests.map((request) => ({
      values: Array.from({ length: 768 }, (_, index) => vectors.get(request.content.parts[0].text)?.[index] ?? 0),
    }));
    return Response.json({ embeddings });
  });
  const request = new Request("http://localhost/api/similarity/clusters", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cards, clusterCount: 2 }),
  });
  const response = await POST(request);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(clusterResponseSchema.safeParse(result).success, true);
  assert.equal(result.embeddingModel, "test-cluster-embedding");
  assert.equal(result.assignments.length, cards.length);
  assert.equal(result.notePairs.length, cards.length * (cards.length - 1) / 2);
});

test("assignment route returns one existing group without reclustering", async (t) => {
  process.env.GEMINI_API_KEY = "test-only-secret";
  process.env.GEMINI_EMBEDDING_MODEL = "test-assignment-embedding";
  globalThis.__IDEAFORGE_EMBEDDING_CACHE_V2__?.clear();
  const vectors = new Map([
    ["new note", [0, 1]], ["idea a", [1, 0]], ["idea b", [0.9, 0.1]],
    ["idea c", [0.1, 0.9]], ["idea d", [0, 1]],
  ]);
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const body = JSON.parse(init.body);
    return Response.json({ embeddings: body.requests.map((request) => ({
      values: Array.from({ length: 768 }, (_, index) => vectors.get(request.content.parts[0].text)?.[index] ?? 0),
    })) });
  });
  const payload = {
    revision: "rev-1", newCard: { id: "e", text: "new note" },
    groups: [
      { id: "group-1", representativeNoteId: "a", cards: [{ id: "a", text: "idea a" }, { id: "b", text: "idea b" }] },
      { id: "group-2", representativeNoteId: "d", cards: [{ id: "c", text: "idea c" }, { id: "d", text: "idea d" }] },
    ],
  };
  const response = await assignPOST(new Request("http://localhost/api/similarity/clusters/assign", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.revision, "rev-1");
  assert.equal(result.chosenGroupId, "group-2");
  assert.equal(result.groups.length, 2);
  assert.equal(result.embeddingModel, "test-assignment-embedding");
  assert.equal(result.notePairs.length, 10);
  assert.equal(clusterAssignmentResponseSchema.safeParse(result).success, true);
});
