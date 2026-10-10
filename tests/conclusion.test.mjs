import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { conclusionDraftProblem, conclusionDraftSchema, conclusionRequestSchema } = await import("../src/lib/conclusion.ts");
const {
  conclusionClusters, conclusionContext, conclusionExportMarkdown, conclusionFileName, conclusionMarkdown, conclusionRecord, setBoardConclusion,
} = await import("../src/features/board/board-conclusion.ts");
const { deleteIdea, moveIdea, updateIdea } = await import("../src/features/board/model.ts");
const { POST } = await import("../src/app/api/conclusion/route.ts");

const idea = (id, author, extra = {}) => ({ id, title: `Title ${id}`, content: `Content ${id}`, author, position: { x: 0, y: 0 }, pinned: false, parentIds: [], ...extra });
const mergeRecord = {
  version: 2,
  sources: [{ id: "a", title: "Title a", content: "Content a", author: "An" }, { id: "b", title: "Title b", content: "Content b", author: "Binh" }],
  goal: "Find a team.",
  relationships: [],
  proposal: {
    status: "useful", reason: "", title: "Merged", concept: "A and B together.",
    contributions: [{ sourceId: "a", contribution: "A adds." }, { sourceId: "b", contribution: "B adds." }],
    bridge: "A feeds B.", tension: "Timing.", assumptions: ["Students take the quiz."], nextExperiment: "Pilot with ten students.",
  },
  model: "test-model", generatedAt: "2026-10-09T00:00:00.000Z",
};
const board = {
  goal: "Find a team.",
  ideas: [idea("a", "An"), idea("b", "Binh"), idea("c", "Chi"), idea("d", "Dung"), idea("m", "Binh", { parentIds: ["a", "b"], merge: mergeRecord })],
  relationships: [
    { id: "ab", source: "a", target: "b", type: "synergy", explanation: "A helps B." },
    { id: "bc", source: "b", target: "c", type: "conflict", explanation: "B competes with C.", condition: "When teams lock early." },
    { id: "cd", source: "c", target: "d", type: "extends", explanation: "C extends D." },
  ],
  votes: [{ ideaId: "a", voterId: "u1", voterName: "Uyen", value: 1 }],
  clusterSnapshot: { revision: "r1", stale: false, bubbles: [], result: { groups: [
    { id: "g1", label: "Matching", noteIds: ["a", "b", "gone"] },
    { id: "g2", label: "Rules", noteIds: ["c", "d"] },
  ] } },
};

const draft = {
  title: "Team matching",
  summary: "Matching plus rules.",
  themes: [{ title: "Fit first", text: "Match on fit.", cardIds: ["a", "b"] }],
  keyIdeas: [{ cardId: "a", why: "It starts matching." }],
  conflicts: [{ relationshipId: "bc", handling: "open_question", text: "Decide when teams lock." }],
  assumptions: [],
  openQuestions: [{ text: "When do teams lock?", cardIds: ["b", "c"] }],
  nextSteps: [{ text: "Pilot the quiz.", cardIds: ["a"] }],
};

test("a selection combines clusters and ideas once, with links between selected notes only", () => {
  assert.deepEqual(conclusionClusters(board).map((cluster) => cluster.noteIds), [["a", "b"], ["c", "d"]]);
  const context = conclusionContext(board, { clusterIds: ["g1"], ideaIds: ["c", "a"] });
  assert.deepEqual(context.request.notes.map((note) => note.id), ["a", "b", "c"]);
  assert.deepEqual(context.request.clusters, [{ id: "g1", name: "Matching", noteIds: ["a", "b"] }]);
  assert.deepEqual(context.request.relationships.map((link) => link.id), ["ab", "bc"]);
  assert.equal(context.request.relationships[1].condition, "When teams lock early.");
  assert.equal(context.request.notes[0].author, "An");
  assert.equal(conclusionContext(board, { clusterIds: [], ideaIds: [] }), null);
  assert.equal(conclusionRequestSchema.safeParse(context.request).success, true);
});

test("a selected merged note carries its merge record", () => {
  const { request } = conclusionContext(board, { clusterIds: [], ideaIds: ["m"] });
  assert.deepEqual(request.notes[0].merge, {
    bridge: "A feeds B.", tension: "Timing.", assumptions: ["Students take the quiz."], nextExperiment: "Pilot with ten students.",
    sources: [{ id: "a", title: "Title a", author: "An", text: "Content a" }, { id: "b", title: "Title b", author: "Binh", text: "Content b" }],
  });
});

test("the fingerprint follows selected text but not card positions", () => {
  const selection = { clusterIds: ["g1"], ideaIds: [] };
  const { fingerprint } = conclusionContext(board, selection);
  assert.equal(conclusionContext(moveIdea(board, "a", { x: 50, y: 90 }), selection).fingerprint, fingerprint);
  assert.notEqual(conclusionContext(updateIdea(board, "a", { content: "Changed" }), selection).fingerprint, fingerprint);
  assert.notEqual(conclusionContext({ ...board, goal: "Another goal." }, selection).fingerprint, fingerprint);
});

test("requests reject unselected link endpoints, duplicate notes, and oversized text", () => {
  const { request } = conclusionContext(board, { clusterIds: [], ideaIds: ["a", "b"] });
  assert.equal(conclusionRequestSchema.safeParse({ ...request, relationships: [{ id: "x", type: "synergy", explanation: "", sourceId: "a", targetId: "z" }] }).success, false);
  assert.equal(conclusionRequestSchema.safeParse({ ...request, notes: [request.notes[0], request.notes[0]] }).success, false);
  const long = Array.from({ length: 5 }, (_, index) => ({ id: `n${index}`, title: "", text: "x".repeat(4000), author: "A" }));
  assert.equal(conclusionRequestSchema.safeParse({ ...request, notes: long, relationships: [], clusters: [] }).success, false);
});

test("drafts must cite requested cards and handle every conflict", () => {
  const { request } = conclusionContext(board, { clusterIds: ["g1"], ideaIds: ["c"] });
  assert.equal(conclusionDraftProblem(draft, request), undefined);
  assert.match(conclusionDraftProblem({ ...draft, keyIdeas: [{ cardId: "d", why: "Not selected." }] }, request), /not in it: d/);
  assert.match(conclusionDraftProblem({ ...draft, conflicts: [] }, request), /missing: bc/);
  assert.match(conclusionDraftProblem({ ...draft, conflicts: [...draft.conflicts, { relationshipId: "ab", handling: "addressed", text: "Not a conflict." }] }, request), /each once/);
});

test("a single merged note may cite its parents and must list its assumptions", () => {
  const { request } = conclusionContext(board, { clusterIds: [], ideaIds: ["m"] });
  const single = { ...draft, conflicts: [], themes: [{ title: "Quiz seating", text: "Seat by quiz.", cardIds: ["m", "a"] }], keyIdeas: [{ cardId: "m", why: "It is the concept." }], openQuestions: [], nextSteps: [{ text: "Pilot with ten students.", cardIds: ["m"] }] };
  assert.match(conclusionDraftProblem(single, request), /assumptions/);
  assert.equal(conclusionDraftProblem({ ...single, assumptions: [{ text: "Students take the quiz.", cardIds: ["m"] }] }, request), undefined);
});

test("the Markdown names cards by title and author, not by ID", () => {
  const { request } = conclusionContext(board, { clusterIds: ["g1"], ideaIds: ["c"] });
  const markdown = conclusionMarkdown(conclusionDraftSchema.parse(draft), request);
  assert.match(markdown, /### Fit first\n\nMatch on fit\.\n\nCards: Title a \(An\), Title b \(Binh\)/);
  assert.match(markdown, /- \*\*Title a\*\* \(An\): It starts matching\./);
  assert.match(markdown, /- \*\*Title b and Title c\*\*, open question: Decide when teams lock\./);
  assert.match(markdown, /1\. Pilot the quiz\. \(Cards: Title a \(An\)\)/);
  assert.doesNotMatch(markdown, /cardId|"a"/);
});

test("keeping a conclusion changes nothing else, and later edits leave its snapshot alone", () => {
  const { request } = conclusionContext(board, { clusterIds: ["g1"], ideaIds: ["c"] });
  const record = conclusionRecord({ request, result: draft, model: "test-model", generatedAt: "2026-10-09T01:00:00.000Z" },
    { title: " Edited title ", markdown: " Edited text " }, "Uyen", "2026-10-09T02:00:00.000Z");
  assert.equal(record.title, "Edited title");
  assert.equal(record.markdown, "Edited text");
  assert.equal(record.generated, draft);
  const kept = setBoardConclusion(board, record);
  for (const key of ["ideas", "relationships", "votes", "clusterSnapshot", "goal"]) assert.equal(kept[key], board[key]);
  const edited = deleteIdea(updateIdea(kept, "a", { content: "Rewritten" }), "b");
  assert.equal(edited.conclusion, record);
  assert.equal(edited.conclusion.request.notes[0].text, "Content a");
});

test("the export lists the board, goal, keeper, and each source with its author", () => {
  const { request } = conclusionContext(board, { clusterIds: ["g1"], ideaIds: ["c"] });
  const record = conclusionRecord({ request, result: draft, model: "test-model", generatedAt: "2026-10-09T01:00:00.000Z" },
    { title: "Team matching", markdown: "Body text." }, "Uyen", "2026-10-09T02:00:00.000Z");
  const exported = conclusionExportMarkdown(record, "Hackathon board");
  assert.match(exported, /^# Team matching\n\nBoard: Hackathon board {2}\nGoal: Find a team\. {2}\nKept by Uyen on 2026-10-09\n\nBody text\.\n\n## Sources/);
  assert.match(exported, /### Cluster: Matching\n\n- Title a \(An\)\n- Title b \(Binh\)/);
  assert.match(exported, /### Other selected ideas\n\n- Title c \(Chi\)/);
  assert.equal(conclusionFileName("Ý tưởng Đồ án!"), "y-tuong-do-an-conclusion.md");
  assert.equal(conclusionFileName("***"), "board-conclusion.md");
});

let savedKey;
beforeEach((t) => {
  savedKey = process.env.FEATHERLESS_API_KEY;
  process.env.FEATHERLESS_API_KEY = "test-only-secret";
  t.mock.method(console, "error", () => {});
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.FEATHERLESS_API_KEY;
  else process.env.FEATHERLESS_API_KEY = savedKey;
});

const conclusionRequest = (body) => new Request("http://localhost/api/conclusion", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

test("the route rejects invalid requests before calling the provider", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Invalid input must not reach the provider"));
  const { request } = conclusionContext(board, { clusterIds: ["g1"], ideaIds: ["c"] });
  for (const body of ["{", {}, { ...request, notes: [] }, { ...request, relationships: [{ ...request.relationships[1], condition: "" }] }]) {
    assert.equal((await POST(conclusionRequest(body))).status, 400);
  }
});

test("the route sends a draft citing an unknown card back once, then returns the corrected draft", async (t) => {
  const { request } = conclusionContext(board, { clusterIds: ["g1"], ideaIds: ["c"] });
  const replies = [{ ...draft, keyIdeas: [{ cardId: "zz", why: "Invented." }] }, draft];
  const bodies = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify(replies.shift()) } }] });
  });
  const response = await POST(conclusionRequest(request));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.result.keyIdeas, draft.keyIdeas);
  assert.equal(bodies.length, 2);
  assert.match(bodies[1].messages.at(-1).content, /not in it: zz/);
  assert.deepEqual(JSON.parse(bodies[0].messages[1].content), conclusionRequestSchema.parse(request));
});

test("the route reports invalid output when the repair also fails", async (t) => {
  const { request } = conclusionContext(board, { clusterIds: ["g1"], ideaIds: ["c"] });
  t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ message: { content: JSON.stringify({ ...draft, conflicts: [] }) } }] }));
  const response = await POST(conclusionRequest(request));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "invalid_output");
});
