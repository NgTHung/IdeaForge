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

**Organize** moves cards on request using embedding similarity, saves the positions, and lets the other browsers animate to them. The local demo also keeps an optional Physics toggle for temporary movement; shared boards keep it disabled, and Organize pauses it before applying a layout. Pinned cards keep their positions. Canvas distance is an approximate cue, not a precise map of meaning.

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

- A board assistant that proposes create, edit, link, and merge actions as previews. A board this size fits in one prompt, so the assistant uses the whole board as context and needs no retrieval. The design is in [Board assistant](assistant.md).
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
| d3-force | Optional local Physics uses a small settling simulation; Organize uses deterministic average-linkage groups and a pairwise-score layout for rectangular notes | The physics collision force approximates rectangular cards with circles |
| Liveblocks Storage and Presence | Managed sync, reconnection, durable rooms, and who's online, with little infrastructure | External account and service dependency |
| Gemini via `@google/genai` | Merges, connection suggestions, and briefs with structured JSON output | Model access, quality, and availability vary; see [AI reliability](#ai-reliability) |
| `gemini-embedding-001` | Card similarity for Organize and suggestion candidates | Short cards on one goal score close together; see [Similarity](#similarity) |
| Zod | One typed contract validates requests and responses | A valid shape doesn't guarantee a good idea or real card IDs |
| Tailwind plus a small CSS layer | Fast layout and styling | Keep the style set small and coherent |
| npm with a lockfile | Reproducible installs | Dependency updates must be deliberate |
| MongoDB for accounts, Liveblocks for boards | MongoDB stores accounts and sessions; Liveblocks stores shared board data and presence. Embeddings are recomputed from card text. | The local demo doesn't persist |

React Flow's core is MIT-licensed. The team uses a small d3-force hook for optional local Physics, while Organize separates groups spatially and places rectangular notes using their pairwise similarity scores. tldraw would fit better if freeform drawing became central, but its production license-key requirement makes it a poorer fit for this scope.

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

The UI at `/` is the local canvas in `src/features/board/`. Its board data lives in React memory and resets on refresh. **Create shared board** opens a new seeded room at `/board/<uuid>`. The shared canvas stores its title, cards, and relationships in Liveblocks Storage. Both views use the same canvas component. Organize calls the similarity-clustering route; merge and connection-suggestion endpoints do not yet have canvas controls. The assistant sidebar still displays a placeholder response.

In the target architecture, `Board` renders the canvas and receives data and operations from one of two adapters: `LocalBoard` keeps in-memory state, and `SharedBoard` applies Liveblocks mutations. Each browser keeps its own selection, viewport, pending merge proposal, pending connection suggestions, and loading and error states. Room storage holds card text, authors, positions, pin state, the goal, links, and accepted ideas. Presence holds each participant's display name and the card they're editing.

Cards are stored as one `LiveObject` per card in a `LiveMap`, and mutations update individual fields. A text edit replaces the whole string, so while one person edits a card, other browsers show who it is and can't type in it. Rich-text CRDT editing is out of scope.

For a merge, suggestion, or brief, the browser sends the goal, the relevant card text, and any link between the selected cards to a route handler. The route validates the request with Zod and calls Gemini through the shared AI module. It then validates the structured output and checks that every returned card ID appeared in the request. The browser holds the result until someone accepts it. Accepting first checks that the source cards haven't changed since the request, then writes through the same Liveblocks mutations as manual edits. Accepting a merge creates the child note in one operation, and the original generated proposal is stored alongside the editable concept text.

For Organize, the browser sends eligible note text and the selected group count to `/api/similarity/clusters`. The server reuses the embedding cache and merges clusters by average pair score until the requested count remains. The response includes group membership, the actual embedding model, representative and neighbor scores, score distances, mean similarity between every group pair, and one `{ sourceId, targetId, similarity, distance }` entry for every unordered note pair. The browser arranges unpinned rectangular notes within spatially separated groups using those pair scores, then writes positions and a compact group snapshot in one board update. Group badges remain visible without bubble outlines. Pinned notes keep their coordinates. After a full Organize, **Place new notes in an existing group** can assign a newly saved note by its mean similarity to each existing group. The assignment endpoint returns the chosen group and a complete pair score table for the submitted notes; the browser moves only the new note. The preference belongs to the current browser. Shared boards persist group membership and invisible rectangular bounds through Liveblocks. Embeddings are derived from card text, cached for up to 2,000 text entries per process, and never stored as board data. Each result identifies the score method because rank scores and centered cosine scores have different meanings.

## Access and configuration

- Gemini and Liveblocks keys are server-only. Locally they're kept in git-ignored `.env.local`, and on the host they're set as server-side environment variables.
- An HTTP-only cookie identifies each guest. Guests enter a display name when they join, and the app shows the name without verifying it.
- `/api/liveblocks-auth` grants access only to the requested `ideaforge:<uuid>` room.
- Anyone with a board link can edit that board. Boards are shared demo rooms, not private workspaces.
- **New shared board** creates a fresh, seeded board. It doesn't copy the local board.
- AI requests have input size limits and a 30-second timeout but no app-level quota. Gemini's provider quotas apply. Per-user fairness controls are deferred.
- Vercel hosts the app at [idea-forge-wine.vercel.app](https://idea-forge-wine.vercel.app). The `idea-forge` project deploys the GitHub repository's `main` branch with Next.js and Node.js 24. Testing and the demo use this public HTTPS URL.
- The merge route exports `maxDuration = 95` to cover three 30-second AI attempts and the retry delay. Keep Fluid compute enabled when deploying; its duration limits support this budget. See [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).

## Log

- **2026-10-06: board assistant design recorded.** [Board assistant](assistant.md) specifies the stretch assistant. It sends the whole board on every message, labels cards with per-request aliases so the model can't garble IDs, and returns cited paragraphs with up to three create, edit, link, or merge actions. Actions are browser-only previews until someone accepts them through the manual mutations and staleness check. An accepted created idea keeps its cited cards as parents with source snapshots, like a kept merge. A merge action opens the existing merge flow instead of generating a concept itself. Retrieval stays out of scope until boards exceed the route's size limits. The epic is `work:WORK-021`, with tasks `work:WORK-024` through `work:WORK-028`, and work still starts only after the Day 3 milestone.
- **2026-10-06: local canvas replaces the merge UI.** The canvas from the `initial-ui` branch is now the app at `/`. It adds, edits, pins, deletes, and connects idea bubbles with typed relationships, using drag-to-connect and a mild d3-force simulation that people can turn off. That simulation is continuous layout physics, which the scope above deferred; it encodes no meaning. The previous `Board`, `LocalBoard`, and `SharedBoard` components, the `/board/[id]` route, and the Liveblocks client configuration were removed. The merge, similarity, and Liveblocks authorization routes, the shared AI module, and their tests remain. The canvas isn't connected to them yet, so AI merging and shared boards are unavailable in the UI until it is. The `initial-ui` branch also rewrote this document for a local-only product with no backend; that rewrite was not adopted, because the account, database, and shared AI decisions above came later.
- **2026-10-06: similarity cache keeps model provenance and has a fixed bound.** Embedding calls return the selected model. Similarity reuses cached vectors only when all cards in a board use one model; it embeds the full board together when cached and new vectors would differ. The process cache evicts least-recently used entries above 2,000 card texts.
- **2026-10-06: Vercel selected for hosting.** The existing production deployment uses the repository's Next.js app and Node.js 24. `GEMINI_API_KEY` and `LIVEBLOCKS_SECRET_KEY` are sensitive environment variables for production and preview. The public production URL serves the local canvas without Vercel authentication. Shared boards keep the existing guest access policy.
- **2026-10-06: shared AI call policy implemented.** Generation uses `GEMINI_MODEL` and optional `GEMINI_FALLBACK_MODEL`. Embeddings use `GEMINI_EMBEDDING_MODEL` and optional `GEMINI_EMBEDDING_FALLBACK_MODEL`, because generation models cannot serve as embedding fallbacks. Each attempt has a 30-second timeout. Overload, quota exhaustion, and timeout trigger one retry after one second, then one fallback attempt. SDK retries are disabled so the shared module owns the attempt count. The merge route allows 95 seconds, and the browser waits 96 seconds. Errors return a cause and a safe message. Server logs contain the model, attempt, cause, and HTTP status, without raw provider errors or card text.
- **2026-10-06: account and database architecture accepted.** The team will add a Node.js Express API with TypeScript and MongoDB. Owners must sign in, using Google or email and password, to create and manage boards. Guests and signed-in participants can edit through a valid sharing link. MongoDB will own account records, sessions, board metadata, ownership, memberships, and sharing records. Liveblocks will remain the authoritative store for board goals, cards, positions, relationship links, accepted merges, and source snapshots. Presence remains temporary. The rendered canvas and unsaved previews remain browser state. These decisions replace the earlier deferral of accounts and a separate database.
- **2026-10-06: Better Auth selected.** Better Auth will handle Google OAuth and email/password accounts, and store users and sessions in MongoDB. Email/password accounts must verify their email address. The Express API will send verification and password-reset mail through configured SMTP credentials. Google sign-in requires verified Google email addresses. Only explicitly configured frontend origins may use credentialed requests. In production, host the API and frontend on the same site so browser cookie rules allow authenticated requests. The existing guest authorization remains until board memberships and share-link grants are enforced by the API.
- **2026-10-06: shared canvas restored on Liveblocks.** The local canvas remains available at `/`. **Create shared board** opens a UUID room at `/board/<uuid>`, where Liveblocks Storage holds the board title, each idea, and each relationship. A new room receives the seed board once; later visits load the room's saved state. Board access continues to follow the existing guest link policy. The physics simulation stays local-only to avoid writing its continuous layout ticks to shared storage.
- **2026-10-06: canvas navigation and theme controls added.** The board controls float over a full-screen canvas. The title sits at the top left, and the sign-in, sharing, and theme controls sit at the top right. An icon-only tool dock on the left holds the AI helper button, which opens the chat closed by default. The disabled AI Organize, Merge ideas, and Generate brief placeholders and the canvas caption were removed. A selected relationship highlights the two ideas at its ends, pinned ideas show a label, and the zoom controls show the current zoom. People can switch between light and dark themes, and the browser stores the choice. The canvas keeps its fit-ideas and empty-board actions, in both local and shared boards.
- **2026-10-06: user-count clustering added to Organize.** **Organize** sends eligible note text and the selected group count to `/api/similarity/clusters`. The route reuses the existing embedding cache and score method, then applies deterministic average-linkage clustering. It returns the actual embedding model, group assignments, representative and nearest-note scores, and score distances. The canvas moves unpinned notes in one board update, leaves pinned notes in place, draws group labels, pauses local Physics, and supports undo until a note is dragged or its text or pin state changes. Group headers and score details stay in browser state; the shared board persists positions through Liveblocks. The accepted work item is `WORK-012`.
- **2026-10-07: incremental note placement and similarity bubbles added.** Full **Organize canvas** still creates or rebuilds every group. The add-note dialog remembers a browser-local **Place new notes in an existing group** switch. When enabled, saving a meaningful new note calls `/api/similarity/clusters/assign`, selects the existing group with the highest mean similarity, and moves only the new note. Edits and deletions of grouped notes mark the snapshot stale and require a full Organize. Full Organize now returns mean cross-group scores and places the groups into nonoverlapping similarity-based bubbles. Shared boards store the group snapshot, scores, and bubble geometry in Liveblocks. The browser rejects stale assignment responses. `WORK-012` tracks this work.
- **2026-10-07: rectangle group layout replaces visible bubbles.** The reference sketch shows separate sets of rectangular notes, labeled by group number, with open space between sets. Organize now returns the complete note-pair similarity table plus distance `1 - similarity`, and both endpoints report all unordered note pairs in the submitted set. The layout uses those scores for within-group spacing, leaves clear space between groups, and renders only group badges on notes. Stored bubble geometry remains as invisible rectangular bounds for compatibility with existing shared snapshots. Incremental placement uses the returned pair table and changes only the newly saved note's position and membership. Canvas distances approximate pair scores while preventing overlaps.
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
