// Live benchmark for WORK-038: runs the real /api/conclusion handler against the generation model and records validity, repairs, and latency.
// The board below is synthetic test data written for this probe, not a real team's notes.
// Run: node --conditions=react-server scripts/probe-board-conclusion.mjs [runsPerScenario]
import dotenv from "dotenv";
import { writeFileSync } from "node:fs";
import { registerHooks } from "node:module";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
const { POST } = await import("../src/app/api/conclusion/route.ts");
const { conclusionContext } = await import("../src/features/board/board-conclusion.ts");
const { conclusionCitations } = await import("../src/lib/conclusion.ts");
const { generationModel } = await import("../src/lib/ai.ts");

const goal = "Help first-year students find a hackathon team.";
const card = (id, author, title, text) => ({ id, author, title, text });
const clusters = [
  { name: "Matching and profiles", notes: [
    card("profile-skills", "An", "Skill profiles", "Each student lists two skills they have and one they want to learn."),
    card("match-quiz", "Binh", "Matching quiz", "A five-question quiz on role, schedule, and ambition suggests three possible teammates."),
    card("anon-profiles", "Chi", "Anonymous first round", "Hide names and photos in the first matching round so shy students aren't judged on looks or year."),
    card("github-stats", "Dung", "Show GitHub activity", "Show each person's GitHub contribution graph so teams can judge experience quickly."),
    card("role-tags", "An", "Role tags", "Tag yourself as builder, designer, pitcher, or researcher."),
    card("availability", "Binh", "Availability grid", "Mark which evenings you can meet before the event."),
    card("ambition-level", "Chi", "Ambition level", "Say whether you want to win, learn, or just have fun, so expectations match."),
    card("make-it-easy", "Dung", "Make it easy", "Make finding a team easy."),
  ] },
  { name: "Icebreakers and events", notes: [
    card("speed-meet", "Binh", "Speed meeting", "Ten rounds of three-minute chats at the kickoff, then everyone writes down who they'd team with."),
    card("idea-pitch-wall", "An", "Idea pitch wall", "Students pin one-line ideas on a wall; others sign up under ideas they like."),
    card("mini-challenge", "Chi", "Mini challenge", "A 30-minute puzzle in random groups of three before the main event, to try working together."),
    card("pre-event-discord", "Dung", "Pre-event Discord", "Open a Discord a week early with a channel for people looking for teams."),
    card("food-mixer", "Binh", "Pizza mixer", "Free pizza the evening before, seated by role tag so each table has a mix."),
    card("lightning-intros", "An", "Lightning intros", "Everyone gets 20 seconds on a microphone to say what they want to build."),
    card("fun", "Chi", "Make it fun", "It should feel fun, not like a job interview."),
    card("game-night", "Dung", "Board game night", "A casual board game night two weeks before, so people meet without pressure."),
  ] },
  { name: "Team formation rules", notes: [
    card("assign-teams", "An", "Assign teams early", "Assign every participant to a team one day before the event so nobody arrives without one."),
    card("free-choice", "Binh", "Free choice", "Let students pick their teammates freely until the event starts."),
    card("team-size", "Chi", "Team size of four", "Teams must have three or four people."),
    card("mixed-years", "Dung", "Mix years", "Each team needs at least one first-year and one older student."),
    card("solo-pool", "An", "Solo pool", "Anyone without a team by kickoff joins a pool that organizers split into teams."),
    card("switch-window", "Binh", "Switch window", "Allow team changes in the first two hours, then lock teams."),
    card("friends-allowed", "Chi", "Keep friend pairs", "Let two friends stay together even when teams are assigned."),
  ] },
  { name: "Mentors and support", notes: [
    card("mentor-office-hours", "Dung", "Mentor office hours", "Mentors hold 15-minute slots to help teams that are struggling to gel."),
    card("buddy-system", "An", "Buddy system", "Pair each first-year with a returning participant who introduces them around."),
    card("conflict-guide", "Binh", "Team conflict guide", "A one-page guide on splitting work and handling disagreements."),
    card("checkin-bot", "Chi", "Check-in bot", "A bot asks each team every six hours if everyone is still involved."),
    card("faq", "Dung", "Team FAQ", "An FAQ page on how teams work, what to bring, and what if you don't have a team."),
    card("mentor-matching", "An", "Mentors suggest teammates", "Mentors who know students from class suggest who would work well together."),
  ] },
];
const merged = {
  ...card("merged-quiz-speed", "Binh", "Quiz-seeded speed meeting",
    "Use the matching quiz to seat speed-meeting rounds, so each three-minute chat is with someone whose role and ambition fit."),
  mergedFrom: [
    { id: "match-quiz", author: "Binh", text: "A five-question quiz on role, schedule, and ambition suggests three possible teammates." },
    { id: "speed-meet", author: "Binh", text: "Ten rounds of three-minute chats at the kickoff, then everyone writes down who they'd team with." },
  ],
};
const relationships = [
  { id: "r-assign-free", type: "conflict", sourceId: "assign-teams", targetId: "free-choice", explanation: "One fixes teams before the event, the other leaves them open until it starts.",
    condition: "Both can't hold if students who want to choose are still choosing when the assignment deadline passes." },
  { id: "r-anon-github", type: "conflict", sourceId: "anon-profiles", targetId: "github-stats", explanation: "Anonymous matching hides the experience signal GitHub stats would show.",
    condition: "Both can't hold in the first matching round if GitHub graphs reveal identity or seniority." },
  { id: "r-quiz-skills", type: "synergy", sourceId: "match-quiz", targetId: "profile-skills", explanation: "The quiz can use declared skills to improve its suggestions." },
  { id: "r-solo-assign", type: "extends", sourceId: "solo-pool", targetId: "assign-teams", explanation: "The solo pool applies assignment only to people still without a team." },
  { id: "r-buddy-mixed", type: "synergy", sourceId: "buddy-system", targetId: "mixed-years", explanation: "Buddies make mixed-year teams form naturally." },
  { id: "r-switch-free", type: "extends", sourceId: "switch-window", targetId: "free-choice", explanation: "The switch window bounds free choice with a lock time." },
];

const allNotes = clusters.flatMap((cluster) => cluster.notes);
const toIdea = (note, extra = {}) => ({ id: note.id, title: note.title, content: note.text, author: note.author, position: { x: 0, y: 0 }, pinned: false, parentIds: [], ...extra });
const board = {
  goal,
  ideas: [...allNotes.map((note) => toIdea(note)), toIdea(merged, { parentIds: merged.mergedFrom.map((source) => source.id), merge: {
    version: 2, goal, relationships: [], model: "probe-fixture", generatedAt: "2026-10-09T00:00:00.000Z",
    sources: merged.mergedFrom.map((source) => ({ id: source.id, title: allNotes.find((note) => note.id === source.id).title, content: source.text, author: source.author })),
    proposal: { status: "useful", reason: "", title: merged.title, concept: merged.text, contributions: [],
      bridge: "The quiz narrows who meets; the chats test whether the predicted fit holds.", tension: "Quiz answers may not predict how people work together.",
      assumptions: ["Students answer the quiz honestly.", "Three minutes is enough to judge fit."],
      nextExperiment: "Run two quiz-seeded rounds with 20 students and compare team picks with random seating." },
  } })],
  relationships: relationships.map((link) => ({ id: link.id, source: link.sourceId, target: link.targetId, type: link.type, explanation: link.explanation, ...(link.condition ? { condition: link.condition } : {}) })),
  clusterSnapshot: { revision: "probe", stale: false, bubbles: [], result: { groups: clusters.map((cluster, index) => ({ id: `g${index}`, label: cluster.name, noteIds: cluster.notes.map((note) => note.id) })) } },
};
const groupId = (name) => `g${clusters.findIndex((cluster) => cluster.name === name)}`;
const scenarios = [
  { name: "medium", selection: { clusterIds: [groupId("Matching and profiles"), groupId("Team formation rules")], ideaIds: ["buddy-system", "mentor-office-hours", "merged-quiz-speed"] } },
  { name: "full-board", selection: { clusterIds: clusters.map((cluster) => groupId(cluster.name)), ideaIds: ["merged-quiz-speed"] } },
  { name: "single-merged", selection: { clusterIds: [], ideaIds: ["merged-quiz-speed"] } },
].map((scenario) => ({ ...scenario, request: conclusionContext(board, scenario.selection).request }));

const runs = Number(process.argv[2] ?? 4);
const plan = [...Array(runs).fill("medium"), ...Array(runs).fill("full-board"), ...Array(Math.max(1, Math.floor(runs / 2))).fill("single-merged")];
const originalError = console.error;
const results = [];
console.log(`model=${generationModel()} fallback=${process.env.FEATHERLESS_FALLBACK_MODEL} reasoning=${process.env.FEATHERLESS_REASONING_EFFORT}`);
for (const [index, scenarioName] of plan.entries()) {
  const scenario = scenarios.find((item) => item.name === scenarioName);
  const body = JSON.stringify(scenario.request);
  const failures = [];
  console.error = (message, details) => { if (message === "AI request failed") failures.push(details); else originalError(message, details); };
  const started = performance.now();
  let payload;
  let status;
  try {
    const response = await POST(new Request("http://localhost/api/conclusion", { method: "POST", body }));
    status = response.status;
    payload = await response.json();
  } finally {
    console.error = originalError;
  }
  const seconds = Number(((performance.now() - started) / 1000).toFixed(1));
  const ok = status === 200;
  const entry = { run: index + 1, scenario: scenarioName, requestChars: body.length, seconds, status, failures, ...(ok ? { model: payload.model, result: payload.result } : { code: payload.code }) };
  results.push(entry);
  const cited = ok ? new Set(conclusionCitations(payload.result)).size : 0;
  console.log(`#${entry.run} ${scenarioName} chars=${entry.requestChars} ${ok ? "ok" : `FAIL ${entry.code}`} ${seconds}s failures=[${failures.map((failure) => `${failure.code}@${failure.attempt}`).join(",")}]${ok ? ` model=${payload.model} cited=${cited} conflicts=${payload.result.conflicts.map((conflict) => conflict.handling).join("/")} assumptions=${payload.result.assumptions.length}` : ""}`);
}
const out = process.env.PROBE_OUTPUT ?? "/tmp/board-conclusion-probe.json";
writeFileSync(out, JSON.stringify({ model: generationModel(), results }, null, 2));
console.log(`results written to ${out}`);
