# Starting ideas for new boards

New shared boards should open with five editable AI ideas drawn from their saved title and description. This document records the generation flow, storage rules, and checks needed to keep those ideas distinct and safe to retry. `work:WORK-051` implements the flow through Featherless, MongoDB, and Liveblocks.

## Goal

When a user creates a board with a title and description, create five editable idea notes that explore meaningfully different ways to address the board's subject. The board should open immediately; idea generation happens in the background. The notes must come from a real provider call and be labeled as AI generated.

Success means five distinct approaches, not five variations of one feature. For a campus food waste board, for example, forecasting demand, sharing surplus meals, purchasing incentives, composting, and procurement changes cover different mechanisms. Five surplus meal marketplaces would not meet the goal.

## Evidence behind the approach

Research on AI brainstorming has found that ordinary prompts can produce idea sets with less diversity than groups of people, and that prompting for broader exploration can improve diversity [1]. A later study identifies fixation on earlier outputs and limited coverage of different perspectives as causes of similar AI ideas [2]. A study of research idea generation also found a tradeoff between novelty and feasibility [3]. These findings support generating more than five candidates, then selecting five based on relevance, different mechanisms, and plausible execution. They do not establish a universal diversity threshold for this product; the team should evaluate outputs on its own boards.

## User experience

1. The user enters a board title and description and selects **Create board**.
2. The board is saved and opened without waiting for the provider. Its idea area shows a small **Generating five starting ideas** state. The user can add their own notes immediately.
3. Once the batch succeeds, five ordinary, editable notes appear together. Each carries an **AI generated** label or equivalent provenance display. The user can edit, move, merge, or delete them using existing note actions.
4. If generation fails, the board remains usable and displays **Could not generate starting ideas** with a **Retry** action. No canned text is presented as a provider result.
5. If the user changes the board title or description while generation is running, the old result is not inserted. A retry uses the current board context.

The initial automatic run occurs once per newly created board. Later generation is explicit. Retrying must not overwrite edited notes or silently add a second set of five.

## Generation pipeline

### 1. Build context

Use the saved board title and description, not unsaved form state. Trim and bound both inputs using the existing board validation rules. Capture the board revision or a stable fingerprint of the title and description. Treat both fields as untrusted data in the prompt; they cannot override the output contract or request credentials.

### 2. Explore a wider pool

Ask the existing server-side provider service for 10 to 12 candidates. Prompt it to explore distinct user groups, delivery channels, incentives, workflows, resources, constraints, and technical or nontechnical mechanisms where relevant. These are exploration cues, not five fixed categories imposed on every board. Ask it to consider the board context before writing candidates, but return only the structured candidates, not private reasoning.

Each candidate contains:

- `title`: short, specific note title.
- `description`: approximately two concise sentences explaining what it does and how.
- `approach`: a short internal label for its core mechanism, used during selection and evaluation.

The prompt should prohibit unsupported factual claims about demand, cost, performance, or legal compliance. Candidates should be actionable enough to discuss, while leaving room for people to develop them.

### 3. Select five

Validate the candidate structure and text limits at the server boundary. Remove empty, off-topic, and exact duplicate candidates. Select five that jointly cover different mechanisms while retaining relevance and plausible execution. The selection step may use a second provider call that returns only candidate IDs, with the selected text mapped from the validated first response. This prevents selection from silently inventing new notes.

Check semantic overlap, not just identical wording. Reuse a production-supported similarity capability if one already exists; a development-only service must not become a production dependency. If no suitable similarity service exists, use the second provider call to flag equivalent mechanisms and supplement it with deterministic duplicate checks. Pairwise similarity scores alone should not decide quality: people should review a sample of results.

If fewer than five valid, distinct candidates remain, make at most one bounded repair request that names the missing approaches and excludes already selected mechanisms. Fail the batch if it still cannot produce five valid notes. Do not save a partial batch without an explicit product decision.

### 4. Validate the final batch

Require exactly five notes, bounded titles and descriptions, distinct titles, distinct core mechanisms, and relevance to the board context. Featherless does not enforce JSON output for the configured GLM model, so the shared generator asks for JSON and Zod validates the result. Its one repair attempt handles malformed or overlapping selections.

## Storage and service contract

Keep provider credentials on the server. Reuse the existing provider client, board authorization, note creation path, and collaborative storage rules. The exact modules and fields must be identified from the current repository before implementation.

Suggested internal types:

```ts
type IdeaCandidate = {
  title: string;
  description: string;
  approach: string;
};

type IdeaGenerationBatch = {
  boardId: string;
  contextFingerprint: string;
  candidates: IdeaCandidate[];
  selectedCandidateIds: string[]; // Exactly five after validation.
};
```

The generation request should identify the board and a stable idempotency key, such as a generation batch ID tied to the board's initial context. The server must verify that the caller can access the board before generation and again before writing notes. Persist a batch status (`pending`, `completed`, or `failed`) where it can survive refresh. Store note provenance (`AI generated`, batch ID, and optionally prompt/model version) if the note schema permits it; never store provider credentials. If the existing note schema has no provenance field, add the smallest compatible representation and migrate existing notes safely.

Save the five notes through the authoritative mutation path used by collaborators. Prefer an atomic batch insert when supported. If storage cannot insert atomically, make insertion resumable and deduplicate by batch ID plus candidate ID so retries can fill missing notes without duplicating existing ones. Preserve every user-created note and the original content of notes that are later merged.

## Concurrency and failures

- Double-clicks, refreshes, client retries, and two collaborators opening the board must not start duplicate successful batches or create ten notes.
- Before inserting results, compare the current board context with the captured fingerprint. Discard stale results and expose retry with the latest context.
- A failed provider call must not roll back board creation.
- Apply the shared AI module's attempt timeout and bounded retries. It retries transient overloads and timeouts and can use the configured fallback model.
- If a user deletes or edits a generated note, an ordinary page refresh or retry must not restore or overwrite it.
- Return user-safe error messages. Log batch ID, failure category, timing, and counts without logging credentials or unnecessary board content.

## Implementation steps

1. Read `AGENTS.local.md` if present, `docs/decisions.md`, `docs/roadmap.md`, `docs/writing-style.md`, and the taskroot workflow. Identify the owning tracked task, dependencies, and any prior decision about board seeding. Record any changed product or architecture decision in `docs/decisions.md` before code changes.
2. Trace board creation from form submission to persisted board and navigation. Trace note creation, collaboration updates, and the existing AI provider service. Confirm whether generation can be started by the board creation request or requires a follow-up call after persistence.
3. Define the batch status, idempotency key, context fingerprint, and note provenance using the current data model. Choose an atomic or resumable batch write based on actual storage behavior.
4. Add the server-side candidate generation and five-idea selection service. Keep prompt construction and validation in reusable modules rather than the UI or route handler.
5. Connect generation to successful board creation. Add loading, success, failure, and retry states to the board UI. Do not block navigation or manual note creation.
6. Add tests for schema validation, meaningful duplication, board authorization, stale context, duplicate requests, partial writes, provider failure, and preservation of user edits.
7. Evaluate output quality with a small, varied set of realistic board briefs: broad and narrow topics, short and detailed descriptions, technical and nontechnical topics, and multiple languages used by the product. Have humans score relevance, mechanism diversity, clarity, and plausibility. Compare against a baseline that asks for five ideas directly; retain the wider-pool pipeline only if it measurably improves the results enough to justify latency and cost.
8. Run `npm run lint`, `npm run typecheck`, and `npm run build`. With credentials available, test a real Featherless response and verify that two Liveblocks clients see the same five notes. Report any live behavior that could not be checked.

## Acceptance criteria

- Creating a valid board opens it immediately and begins one generation batch.
- A successful batch produces exactly five editable, AI-labeled notes from real provider output.
- The five notes represent different core approaches and remain relevant to the board title and description.
- A failed batch leaves a usable board and offers a retry without inserting canned or partial results.
- Refreshes, repeated requests, and concurrent clients cannot duplicate a completed batch.
- Changed board context cannot save stale results; user edits and deletions are never overwritten.
- Provider credentials remain server-side; unauthorized callers cannot generate or insert notes for a board.
- Required repository checks pass, and the live Gemini and Liveblocks verification boundary is reported accurately.

## Integration decisions

MongoDB marks newly created boards for starter ideas and stores a short generation claim. Only the signed-in owner can call the generation endpoint. The browser inserts the five notes and a completion marker in one Liveblocks mutation, then acknowledges the claim. A failed request leaves a failed room marker and a retry action. Existing rooms retain their stored notes. The local demo still uses its fixtures.

The current generator uses Featherless GLM-5.3-Flash through the shared AI module. It requests 10 to 12 candidates, then selects five candidate indices in a second call. The note stores the original title and content, model, approach, batch ID, and generation time. Later edits remain visible as edits to AI starting ideas.

## References

1. Meincke, Mollick, and Terwiesch, [Prompting Diverse Ideas: Increasing AI Idea Variance](https://arxiv.org/abs/2402.01727), 2024.
2. Deng, Brucks, and Toubia, [Examining and Addressing Barriers to Diversity in LLM-Generated Ideas](https://arxiv.org/abs/2602.20408), 2026 preprint.
3. Si, Yang, and Hashimoto, [Can LLMs Generate Novel Research Ideas? A Large-Scale Human Study with 100+ NLP Researchers](https://arxiv.org/abs/2409.04109), 2024.
