import assert from "node:assert/strict";
import { test } from "node:test";
import { addMergedIdea, mergeContext, mergeDisplayData, mergeRecordFor } from "../src/features/board/merge-board.ts";
import { mergeCoverageProblem, mergeProposalSchema } from "../src/lib/ideas.ts";

const idea = (id, x) => ({ id, title: `Title ${id}`, content: `Content ${id}`, author: `Author ${id}`, position: { x, y: 0 }, pinned: false, parentIds: [] });
const board = {
  goal: "Help students study.",
  ideas: [idea("a", 0), idea("b", 400), idea("c", 800)],
  relationships: [
    { id: "ab", source: "a", target: "b", type: "synergy", explanation: "A helps B." },
    { id: "bc", source: "b", target: "c", type: "conflict", explanation: "B competes with C.", condition: "When rooms are shared." },
  ],
};
const proposal = mergeProposalSchema.parse({
  status: "useful", reason: "", title: "A and B", concept: "Combine A and B.",
  contributions: [{ sourceId: "a", contribution: "A adds a start." }, { sourceId: "b", contribution: "B adds a partner." }],
  excluded: [{ sourceId: "c", reason: "C targets a different problem." }],
  bridge: "A starts what B sustains.", tension: "Timing.", assumptions: [], nextExperiment: "Try it for a week.",
});

test("coverage accepts left-out notes and rejects missing or repeated ones", () => {
  assert.equal(mergeCoverageProblem(proposal, ["a", "b", "c"]), undefined);
  assert.match(mergeCoverageProblem(proposal, ["a", "b", "c", "d"]), /\(a, b, c, d\).*contain a, b, c$/);
  assert.match(mergeCoverageProblem({ ...proposal, excluded: undefined }, ["a", "b", "c"]), /contain a, b$/);
  assert.equal(mergeProposalSchema.safeParse({ ...proposal, excluded: [{ sourceId: "a", reason: "Repeated." }] }).success, false);
  const copied = mergeProposalSchema.parse({ ...proposal, excluded: [{ sourceId: "c", contribution: "", reason: "C targets a different problem." }] });
  assert.deepEqual(copied.excluded, proposal.excluded);
});

test("keeping a partial merge records only the contributing notes as parents and sources", () => {
  const context = mergeContext(board, ["a", "b", "c"]);
  const record = mergeRecordFor(context, proposal, "test-model", "2026-10-08T10:00:00.000Z");
  assert.deepEqual(record.sources.map((source) => source.id), ["a", "b"]);
  assert.deepEqual(record.sources[0], { id: "a", title: "Title a", content: "Content a", author: "Author a" });
  assert.deepEqual(record.relationships.map((link) => link.sourceId + link.targetId), ["ab"]);
  assert.deepEqual(record.proposal.excluded, [{ sourceId: "c", reason: "C targets a different problem." }]);

  const next = addMergedIdea(board, "merged", "A and B", "Combine A and B.", record, "Tester");
  const merged = next.ideas.find((item) => item.id === "merged");
  assert.deepEqual(merged.parentIds, ["a", "b"]);
  assert.deepEqual(next.ideas.slice(0, 3), board.ideas);
  assert.deepEqual(mergeDisplayData(merged.merge).excluded, record.proposal.excluded);
});

test("records without left-out notes keep every selected note", () => {
  const full = { ...proposal, contributions: [...proposal.contributions, { sourceId: "c", contribution: "C adds a room." }], excluded: undefined };
  const record = mergeRecordFor(mergeContext(board, ["a", "b", "c"]), full, "test-model", "2026-10-08T10:00:00.000Z");
  assert.deepEqual(record.sources.map((source) => source.id), ["a", "b", "c"]);
  assert.equal(record.relationships.length, 2);
  assert.deepEqual(mergeDisplayData(record).excluded, []);
});
