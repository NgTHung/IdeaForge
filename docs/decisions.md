# Decisions

What IdeaForge is, how it's built, and why. The initial decisions were accepted on 2026-10-05 for a one-week Forgehack project in the AI + Creativity / Collaboration track. The same day, they were consolidated with the team's discussion brief. Add a dated entry to the [log](#log) when scope, architecture, or access policy changes.

## Product

Pitch: a shared canvas where a team finds which of its ideas are worth combining, combines them into new concepts, and can trace who contributed what.

Audience: student teams brainstorming hackathon projects, who struggle to turn scattered contributions into one concept they want to build. Both the audience and the benefit are hypotheses to test this week, not established demand.

Differentiator: Miro AI already generates, clusters, and summarizes sticky notes, so clustering alone doesn't set IdeaForge apart. A merge alone doesn't either. On 2026-10-05, three Gemini models given the same two notes all proposed the same obvious combination, which any chat assistant would also produce. IdeaForge's value is in choosing the pair on a crowded board, including pairs from different themes and different people, and merging it with visible ancestry and authorship.

### Core journey

A participant opens a board link and enters a display name. The team adds idea cards and clicks **Organize** to group related cards. They select a card, click **Suggest connections**, and review the suggested links. They merge two cards into a concept preview, keep it, and generate a short concept brief from it.

### Relationships

A link records how two ideas relate. Each link has a type, an explanation, and an author.

| Type | Meaning | Direction |
| --- | --- | --- |
| Works well together | Combining the ideas produces a useful outcome | None |
| Conflicts with | The ideas can't both hold under a condition the link states | None |
| Extends | One idea adds a capability or detail to the other | From the extending card to the extended card |

"Extends" replaces the earlier "supplements" because the direction matters. These rules apply to links:

- Similarity isn't agreement. Two cards on the same topic can propose opposite approaches, so closeness on the canvas never creates a link.
- When asked for connections, the AI can answer that no useful relationship exists, or that a relationship needs clarification and what question would settle it.
- AI suggestions are provisional. Nothing is saved until a person accepts a suggestion, optionally after editing its type or explanation.
- A request returns at most three suggestions. Candidates include the card's nearest neighbors and a few cards from other groups, because combining ideas across themes is part of the creativity hypothesis.
- Anyone can link or merge any two cards, however far apart they are.

### Merge rules

- Each board has a goal that constrains generation.
- Exactly two nonempty notes are merged at a time. Merged notes can be merged again.
- When the two cards are linked, the merge request includes the link type and explanation. Merging a "conflicts with" pair asks for a concept that addresses the stated condition.
- The AI returns a title, a concept, each source's contribution, a tension, the assumptions the concept introduces, and a next experiment.
- Generation produces a preview. People can edit the title and concept or regenerate the preview before keeping it. Only keeping creates a new note, and the originals stay intact.
- Each merged note stores its parents' IDs, their authors, and a snapshot of the text used. Later edits to a source don't rewrite the snapshot.
- A preview can't be kept if a source card's text changed after generation, so the person regenerates it instead. Suggested links follow the same rule.
- When a connection is weak, the AI must say so instead of presenting it as a validated opportunity.
- Generated explanations are claims for the team to assess, not proof that a concept works.

### Organize

Cards move only when someone clicks **Organize** or drags a card. There's no continuous physics. Organize lays out the board once from embedding similarity and saves the positions, and the other browsers animate to them. Pinned cards keep their positions. Canvas distance is an approximate cue, not a precise map of meaning.

### Concept brief

A concept brief summarizes one merged concept. It covers the concept, the cards and authors that contributed, the assumptions and open questions, and the next experiment. It draws only on board content and doesn't present anything as a decision the team agreed on.

### Scope

MVP: one shared board for about four participants and 30 to 50 short cards. These are design targets, not measured capacity. The MVP includes:

- Display names and card authors.
- Creating, editing, deleting, and dragging cards.
- Typed manual links.
- Organize with pinning.
- AI connection suggestions with human review.
- Editable merge previews with ancestry.
- The concept brief.
- Persistence across reloads and reconnects.
- Clear feedback when an AI request fails.

Stretch, started only after the MVP works on the deployed app:

- A board assistant that proposes create, edit, link, and merge actions as previews. A board this size fits in one prompt, so the assistant uses the whole board as context and needs no retrieval.
- Live cursors.

Deferred:

- Retrieval over uploaded documents.
- Continuous physics.
- Drawing tools and extra shapes.
- Voting and private contribution rounds.
- Accounts, a separate database, and a trained relationship model.
- Zoom-out summaries.
- Critic personas. If added later, they should match the target audience and be labeled as simulated feedback.
- Views for assumptions, evidence, and dependencies.

## Technology

| Choice | Why | Tradeoff |
| --- | --- | --- |
| Next.js App Router, React, TypeScript | UI and server routes in one project | The canvas must be a client component |
| React Flow | Cards are custom nodes, links and ancestry are custom edges, and pan/zoom/select/drag are built in | A notes interface, not a full drawing editor |
| d3-force | Organize layout: attraction from similarity, collision, pinned nodes, and settling by manual ticks | Its collision force treats nodes as circles, so rectangular cards need a sized radius or a custom force |
| Liveblocks Storage and Presence | Managed sync, reconnection, durable rooms, and who's online, with little infrastructure | External account and service dependency |
| Gemini via `@google/genai` | Merges, connection suggestions, and briefs with structured JSON output | Model access, quality, and availability vary; see [AI reliability](#ai-reliability) |
| `gemini-embedding-001` | Card similarity for Organize and suggestion candidates | Short cards on one goal score close together; see [Similarity](#similarity) |
| Zod | One typed contract validates requests and responses | A valid shape doesn't guarantee a good idea or real card IDs |
| Tailwind plus a small CSS layer | Fast layout and styling | Keep the style set small and coherent |
| npm with a lockfile | Reproducible installs | Dependency updates must be deliberate |
| No database | Board data lives in Liveblocks, and embeddings are recomputed from card text | The local board doesn't persist |

React Flow's core is MIT-licensed. Its complete force-layout and collaboration examples are paid Pro examples, so the team writes its own d3-force integration. tldraw would fit better if freeform drawing became central, but its production license-key requirement makes it a poorer fit for this scope.

The team brief proposed React with Vite, Express, Socket.IO, MongoDB, and Render. The brief was written without reading this repository. Adopting it would rebuild the canvas, merge flow, rooms, persistence, and reconnection that already work here. It would also mean building card versioning, stale-edit detection, and recovery from missed messages, because Socket.IO delivers each message at most once by default. Liveblocks already provides these. Switch only if nobody on the team can work in Next.js.

The generation model is set by `GEMINI_MODEL`. `gemini-2.5-flash` is only a starting default. On 2026-10-05 the project's API key could also use newer Flash models up to `gemini-3.8-flash`. Compare models on the [evaluation cases](roadmap.md#ai-evaluation) before the demo. The code uses the SDK's `models.generateContent` and `models.embedContent` interfaces.

### Similarity

Raw cosine similarity between short cards on one goal falls in a narrow range. In a nine-note test on 2026-10-05 with `gemini-embedding-001` at 768 dimensions, every pair scored between 0.66 and 0.93, and an unrelated pair scored the same as a related one (0.80). Subtracting the board's mean embedding before comparing separated them (0.21 and −0.04). IdeaForge therefore compares mean-centered vectors. Small boards fall back to nearest-neighbor ranks below a card count set during evaluation.

`gemini-embedding-001` kept an English and a Vietnamese version of the same idea closer than `gemini-embedding-2` did, at 0.60 versus 0.24 after centering. That was a single pair, so recheck it on real notes. Distance also didn't reveal stance: a note against gamification scored like an unrelated note to "short daily challenges". The type of a relationship comes from the language model, not from embeddings.

### AI reliability

On 2026-10-05 the merge prompt ran twice on each of three models, using the same two notes:

- `gemini-2.5-flash` took 4.8 and 6.7 seconds.
- `gemini-3.8-flash` took 4.4 seconds once and failed once with a 503 "high demand" response.
- `gemini-3.5-flash-lite` took 1.6 and 1.8 seconds.

All AI routes share one server module. It retries once on overload or timeout, then falls back to a second configured model. Errors returned to the browser name their cause: missing key, provider overload, timeout, or invalid output. Manual work stays usable when an AI request fails.

## Architecture

`Board` renders the canvas and receives data and operations from one of two adapters: `LocalBoard` keeps in-memory state, and `SharedBoard` applies Liveblocks mutations. Each browser keeps its own selection, viewport, pending merge proposal, pending connection suggestions, and loading and error states. Room storage holds card text, authors, positions, pin state, the goal, links, and accepted ideas. Presence holds each participant's display name and the card they're editing.

Cards are stored as one `LiveObject` per card in a `LiveMap`, and mutations update individual fields. A text edit replaces the whole string, so while one person edits a card, other browsers show who it is and can't type in it. Rich-text CRDT editing is out of scope.

For a merge, suggestion, or brief, the browser sends the goal, the relevant card text, and any link between the selected cards to a route handler. The route validates the request with Zod and calls Gemini through the shared AI module. It then validates the structured output and checks that every returned card ID appeared in the request. The browser holds the result until someone accepts it. Accepting first checks that the source cards haven't changed since the request, then writes through the same Liveblocks mutations as manual edits. Accepting a merge creates the child note in one operation, and the original generated proposal is stored alongside the editable concept text.

For Organize, the browser that clicks the button gets similarity scores from the server. It then runs d3-force to completion with pinned cards fixed, and writes every new position in one batch. Other browsers animate from the old positions to the new ones. Only one browser computes each layout, so browsers never compete over positions. Embeddings are derived from card text. The server computes them on request and caches at most 2,000 text entries per process. Each score batch uses vectors from one embedding model, and the cache evicts least-recently used entries. Embeddings aren't board data.

## Access and configuration

- Gemini and Liveblocks keys are server-only. Locally they're kept in git-ignored `.env.local`, and on the host they're set as server-side environment variables.
- An HTTP-only cookie identifies each guest. Guests enter a display name when they join, and the app shows the name without verifying it.
- `/api/liveblocks-auth` grants access only to the requested `ideaforge:<uuid>` room.
- Anyone with a board link can edit that board. Boards are shared demo rooms, not private workspaces.
- **New shared board** creates a fresh, seeded board. It doesn't copy the local board.
- AI requests have input size limits and a 30-second timeout but no app-level quota. Gemini's provider quotas apply. Per-user fairness controls are deferred.
- The app is deployed on Day 1, so testing and the demo run on a public URL. The host is chosen on Day 1, either Vercel or Railway, and recorded here.

## Log

- **2026-10-06: similarity cache keeps model provenance and has a fixed bound.** Embedding calls return the selected model. Similarity reuses cached vectors only when all cards in a board use one model; it embeds the full board together when cached and new vectors would differ. The process cache evicts least-recently used entries above 2,000 card texts.
- **2026-10-06: shared AI call policy implemented.** Generation uses `GEMINI_MODEL` and optional `GEMINI_FALLBACK_MODEL`. Embeddings use `GEMINI_EMBEDDING_MODEL` and optional `GEMINI_EMBEDDING_FALLBACK_MODEL`, because generation models cannot serve as embedding fallbacks. Each attempt has a 30-second timeout. Overload, quota exhaustion, and timeout trigger one retry after one second, then one fallback attempt. SDK retries are disabled so the shared module owns the attempt count. The merge route allows 95 seconds, and the browser waits 96 seconds. Errors return a cause and a safe message. Server logs contain the model, attempt, cause, and HTTP status, without raw provider errors or card text.
- **2026-10-05: initial decisions accepted**, as recorded above.
- **2026-10-05: development audit advisory accepted.** `npm audit` reports five high-severity findings in the dev-only lint chain (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`). No patched `braces` release exists. Don't force-downgrade Next tooling to an unrelated major version; recheck during the week.
- **2026-10-05: daily AI cap removed.** The demo first enforced 100 Gemini calls per UTC day with a persistent counter. It was removed at the user's request after merges started failing. The counter showed only two attempts, so the cap itself wasn't the cause. The gate, counter, and its tests were deleted. The failure didn't recur after a restart, and its cause is still unknown.
- **2026-10-05: scope consolidated with the team discussion brief.** The changes are:
  - The differentiator moved from the merge itself to finding which pair to merge.
  - Typed relationships with review were added: works well together, conflicts with, and extends.
  - Organize on demand replaced continuous physics.
  - Display names, card authors, card deletion, an editing lock, and the concept brief joined the MVP.
  - Merge previews became editable and link-aware, with stale-source checks.
  - AI calls gained a shared retry and fallback module.
  - Deployment moved to Day 1.
  - The chatbot became a stretch goal, and retrieval over documents was deferred.

  The team kept this repository's stack instead of the brief's Express, Socket.IO, and MongoDB proposal. Evidence for these choices is in [Similarity](#similarity) and [AI reliability](#ai-reliability). The 503 overload seen that day is one possible cause of the earlier unexplained merge failure. The merge route reported every error with the same message, so the cause can't be confirmed.

## References

- [Miro AI sticky-note capabilities](https://help.miro.com/hc/en-us/articles/28781881506834-Miro-AI-with-Sticky-notes)
- [React Flow](https://reactflow.dev/)
- [React Flow force layout example](https://reactflow.dev/examples/layout/force-layout)
- [React Flow Pro examples](https://reactflow.dev/examples/pro-examples)
- [D3 force simulations](https://d3js.org/d3-force/simulation)
- [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Liveblocks React setup](https://liveblocks.io/docs/get-started/react)
- [Liveblocks Storage guide](https://liveblocks.io/docs/guides/how-to-use-liveblocks-storage-with-react)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings)
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)
- [tldraw licensing](https://tldraw.dev/community/license)
