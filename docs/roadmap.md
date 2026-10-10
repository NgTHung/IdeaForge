# Roadmap

What's built, what's verified, and the five-day plan to the Forgehack submission. It also defines how the team evaluates AI quality, the checks that must pass before feature freeze, and the demo. Individual tasks, owners, dependencies, and acceptance criteria live in `.tasks/`. Run `taskroot list` to see them and `taskroot ready --domain work` to find work you can start.

## Current status

Done:

- Landing screen at `/` with actions to create a shared board or join by URL or UUID.
- Guest lobby at `/board/<uuid>` that asks for a display name before connecting to Liveblocks and remembers the name in that browser.
- Shared canvas at `/board/<uuid>` with seeded Liveblocks Storage, live board mutations, saved room state, and a share-link button.
- Organize on the canvas with a chosen group count, separated rectangular notes, a score for each note pair, and optional placement of only newly saved notes. Group snapshots persist with shared boards.
- AI-suggested group names, with manual rename controls; labels save in the cluster snapshot and update matching canvas badges.
- Relationship and ancestry links use a shared router with 24px port spacing, 20px lane separation, 28px card clearance, endpoint-bounded orthogonal routes, rounded corners, isolated crossing bridges, labels, and directional arrowheads. The router uses a curve when no orthogonal route fits. Hovering or selecting a node or edge emphasizes related links, with an option to show only one node's links. Layout and drag placement keep cards 48px apart and bring connected notes closer.
- Selection of 2–8 notes, editable AI merge previews with per-source contributions and reasons for notes left out, and merged concept cards with source snapshots and focusable ancestry links.
- Shared-board header with active connection avatars and count; the member list shows connected names and Editor or Viewer access.
- Shared boards show other members' cursors as color-coded dots with their display names. Liveblocks Presence broadcasts board-space coordinates at most 20 times per second and clears the cursor when a member leaves the canvas or hides the tab.
- Account popover on the landing screen and shared boards, with the signed-in user's name and sign-out action.
- Authenticated board creation at `/boards/new` and a personal dashboard at `/dashboard`. MongoDB stores board metadata, ownership, and membership with a pointer to each Liveblocks room; signed-in link visitors join as editors, and UUID links keep the current public edit policy.
- Dashboard features the most recently metadata-edited board above the collection and retains it in the grid; owners can permanently delete their boards from the collection.
- Shared boards show active pencil strokes through Liveblocks Presence, and Liveblocks Storage saves completed strokes and whole-stroke erasures beneath ideas and links.
- Accounts, sessions, board metadata, and `/healthz` run in Next.js App Router handlers. Browser requests use the app origin, and the separate Express service is removed. MongoDB clients and account configuration initialize on demand.
- Suggested Links across the board. The panel starts minimized, and automatic checks are off until enabled. When enabled, checks wait two seconds after saved text or goal changes. Up to three suggestions use the same canvas line and label as saved links; people can change the type, request an AI explanation, accept, or dismiss them. Dismissals save with the board for every participant. Suggestions shortlist pairs locally and classify them with Jev, exclude linked, dismissed, and merge-lineage pairs, and become invalid when source text changes. MongoDB caches results and enforces shared request allowances. Manual refresh works while automatic checks are off.
- Merge endpoint with Zod validation and JSON output from GLM-5.3-Flash on Featherless
- Board assistant API route with request validation, card citations, and up to three proposed actions.
- Liveblocks guest authorization route
- Shared server-only AI module (Featherless generation, Gemini embeddings) with one retry, optional generation and embedding fallbacks, output validation, and cause-specific errors

In progress:

- `WORK-025` through `WORK-027` connect the assistant to the board and add guarded create, edit, link, and merge previews. Supporting work remains open in `WORK-003`, `WORK-004`, `WORK-010`, and `WORK-014`. A real assistant reply, citation focus, link preview and discard, create preview and acceptance, source provenance, and shared-board reload now work in an isolated browser session. Local-board chat, deleted citations, failure handling while editing, two-browser locks and preview isolation, stale actions, normal link acceptance, edit and merge acceptance, and a successful conflict-merge call still need verification. The human citation-quality evaluation in `WORK-028` is excluded from this implementation pass; `WORK-021` remains open.

Verified:

- On 2026-10-09, `work:WORK-036` added removable named upvotes to idea cards and the header dropdown. All 155 tests, lint, typecheck, and the production build passed. `npm run verify:idea-voting` verified older-room initialization, concurrent votes, offline names, reload persistence, stable voter IDs, and unchanged notes and merge snapshots with two live Liveblocks clients. Tailscale browser checks covered card and dropdown voting, voter lists, Escape focus restoration, dark mode, and disabled controls with a real read-only room token. The HTTP production-browser checks used seeded guest cookies; HTTPS guest entry and Gemini calls were not retested. Mobile resizing lost the collaborative browser connection, so mobile layout remains unverified.
- On 2026-10-09, live cursors passed lint, typecheck, and the production build. An isolated two-client Liveblocks check confirmed cursor positions reach the other client and clear after the sender sets its cursor to null. Browser rendering and alignment across different viewports were not checked.
- On 2026-10-09, free drawing passed lint, a focused TypeScript check, and an isolated production build. The regular typecheck could not write `.next/types/routes.d.ts` in the working copy (`EPERM`). The two-client Liveblocks check was attempted with configured credentials, but authorization returned HTTP 503, so room broadcast and reload persistence remain unverified against the live service.
- On 2026-10-09, PR #30 was reconciled with the Next.js backend migration. Dashboard deletion now uses the same-origin `DELETE /api/boards/[id]` handler and initializes Liveblocks only when an owner deletes a board. All 147 tests, lint, typecheck, and production build passed. Mocked deletion tests cover owner access, origin checks, room failures, already-missing rooms, and directory cleanup. Live MongoDB and Liveblocks deletion, live Gemini, and browser interactions were not exercised in this pass.

- On 2026-10-09, the most recently metadata-edited board is highlighted above the full collection and remains in the grid. The aggregate board-count label and creation-date tooltip are removed. Owned cards keep the confirmed delete action for the owner's board and its Liveblocks room and MongoDB records. Lint, typecheck, and production build pass. Live MongoDB and Liveblocks deletion were not exercised.
- On 2026-10-09, the dashboard now puts a compact greeting and Create board action above the collections. The featured card uses the newest metadata edit, is labeled “Recently edited,” and remains in the full board list. The UI uses existing board fields only, and the empty shared panel is compact. Four focused dashboard-data tests, lint, typecheck, and production build pass. Source review confirms the page-level blurred blobs are gone, the centered wrapper and children can shrink, and the grid changes from one to two, three, and four columns at 640px, 1024px, and 1280px. Rendered checks at 375, 768, 1024, 1366, 1920, and 200% zoom remain unverified because headless browsers did not return DOM for local pages in this environment.
- On 2026-10-08, the dashboard gained a dark workspace hero, a featured latest board, deterministic card accents, a create tile, a compact shared empty state, and staggered motion. Search, sorting, routing, and fetching are unchanged. Lint, typecheck, and production build pass. Source review confirms the CSS switches from one to two, three, and four columns at the configured breakpoints. Requested viewport rendering at 390, 768, 1280, and 1920 pixels remains unverified: Edge and Chrome headless returned no DOM for local fixture pages in this environment. Idea totals and collaborator profiles remain unavailable from dashboard data.
- On 2026-10-09, `work:BUG-003` reproduced the generic account 500 with missing settings and replaced it with a no-store 503 naming only invalid environment keys. Configuration logs contain those names, and unexpected failures log an allowlisted exception category without raw messages. All 139 tests, lint, typecheck, and a production build with account credentials cleared passed. A running production build returned 503 with `MONGODB_URI` and `BETTER_AUTH_SECRET` cleared; with configured local settings, `POST /api/auth/sign-in/social` returned 200 and a Google authorization URL whose callback was `http://localhost:3000/api/auth/callback/google`. Google consent and callback completion were not exercised. The reported Vercel preview failure remains unconfirmed: the Vercel connection denied project log and environment access with 403, direct preview requests reached a non-JSON access page, and the supplied log showed only the old generic message.

- On 2026-10-09, `work:WORK-035` moved the Express account and board API into Next.js. All 138 tests, lint, typecheck, and the production build passed. A build with `MONGODB_URI` and `BETTER_AUTH_SECRET` cleared also passed; starting that build with configured runtime credentials returned HTTP 200 from `/healthz`, `/api/auth/get-session`, and `/api/session`. HTTP checks confirmed anonymous dashboard, create, and join requests return 401, foreign-origin board mutations return 403, invalid context IDs return 400, and unsupported methods return 405. Handler tests use mocked MongoDB collections to cover ownership, membership, metadata reads and edits, repeated joins, index retries, failed-create cleanup, malformed and oversized bodies, and safe errors. Live Gemini embeddings and Liveblocks authorization each returned HTTP 200. Interactive Google sign-in, email verification, password reset, authenticated browser board creation, and two-browser synchronization were not verified in this migration; the collaborative browser could open a tab but navigation and snapshots failed. The migration has not been deployed.

- On 2026-10-08, idea text and user-facing AI prose now use a shared safe Markdown renderer. Raw HTML is ignored, generated prose schemas reject HTML tags, links pass through `react-markdown` URL handling, and AI prompts request Markdown while structured responses keep their JSON envelope. Lint, typecheck, and production build passed. No automated tests, browser interaction, or live AI generation ran.
- On 2026-10-08, `WORK-010` gained a concise read-first merge preview. The Featherless prompt targets shorter output in the source language, while the existing response schema remains unchanged. The preview and saved merge details keep reasoning and source snapshots in separate expandable sections. Lint, typecheck, and production build pass; the temporary local app returned HTTP 200. No automated tests or live Featherless response ran. Browser automation failed to initialize with OS error 3, so the 1280×720 and 390×844 visual checks remain open.
- On 2026-10-08, authenticated board creation and the personal dashboard were added. `npm test` passed 116 tests, including authenticated creation, ownership derived from the session, input limits, metadata title updates, and owned/shared filtering. Lint, typecheck, and production build passed. MongoDB and Liveblocks were not exercised against live services in this pass; room-link access remains the existing public edit policy.
- On 2026-10-08, shared-board Undo/Redo was wired to Liveblocks Storage history. `npm test` passed 112 tests, including shortcut handling for Ctrl/Cmd undo, redo, editable fields, and IME composition; lint, typecheck, and production build passed. Installed SDK docs and source confirm batched mutation history, local edits clearing redo, and remote operations leaving the local stack alone. `npm run verify:liveblocks-history` is available for isolated two-client checks, but Liveblocks authorization returned HTTP 503, so create/edit/drag/delete/merge/AI, reload, and conflict outcomes were not observed live. Read-only controls and board switching still need browser verification. Strict conflict rejection remains unsupported by the exposed native history API.
- On 2026-10-08, `WORK-010` was extended from two-note to 2–8-note merge proposals. Lint, typecheck, and the production build pass. The route validates bounded source text, selected relationships, and one returned contribution per source; the UI supports removable/reorderable selections and legacy provenance. No browser interaction, live Featherless request, automated tests, or shared-board persistence check ran in this pass.
- On 2026-10-06, before the canvas replaced the merge UI, its two board-model tests, lint, typecheck, and production build passed. A headless Chrome check at 1280×720 confirmed the board renders, a connection drag shows its preview and chooser, confirmation adds a link without moving its source, a pinned idea stays fixed, and direct dragging works with physics on.
- On 2026-10-07, after WORK-032 rebuilt PR #18 on `main`, 92 repository tests passed, including overlap resolver tests for card clearance, pinned cards, and fixed cards, and a link label placement test. Lint, typecheck, and the production build pass. A headless Chromium run against the production build on a new Liveblocks room confirmed orthogonal link paths, at least 48px between cards, two-idea selection with the Merge tool, and **Only this node's edges** hiding unrelated links. A card added by one guest appeared for a second guest, and reloading the second tab kept all six cards in both tabs.
- On 2026-10-06, average-linkage clustering tests cover request validation, deterministic groups, response score summaries, and a successful mocked endpoint call. Layout tests cover pinned and excluded notes and card separation. A local browser smoke test grouped the five sample ideas, displayed method and group summaries, paused Physics, and restored the prior positions with Undo layout.
- On 2026-10-07, 53 repository tests passed, including complete note-pair response validation, score-based rectangle spacing, deterministic new-note assignment, snapshot invalidation after edits and deletions, and mocked clustering endpoints. Lint, typecheck, and production build pass; lint reports only three unused-variable warnings in the bundled `.venv-clustering` scikit-learn file. Live localhost requests returned 3 of 3 note-pair scores from full clustering and 6 of 6 from incremental assignment. A browser check grouped the five sample ideas into two separated sets without bubble outlines; after saving one new note with auto placement enabled, only that new note moved and gained a Group 1 badge. Two-browser shared snapshot sync still needs verification.
- A Chromium smoke test covers selection, missing-key feedback, accepting a merge (using a mocked response), ancestry, editing, adding notes, and mobile width
- A live Gemini merge returned a valid proposal
- On 2026-10-06, 34 mocked tests cover AI generation, embeddings, retry and fallback attempt counts, SDK timeouts, output validation, safe errors, and merge-route contracts. Lint, typecheck, and production build pass.
- On 2026-10-06, live Gemini calls through the shared module returned a valid merge in 8.4 seconds and two 768-dimensional embeddings in 0.7 seconds. The production browser, reached through Tailscale, showed the missing-key message and allowed editing and adding notes after the failed request. A live browser merge could be kept, leaving both originals and two ancestry edges. The Gemini key and SDK were absent from client chunks, and the server-only import guard passed.
- On 2026-10-07, a live Gemini merge on the current shared canvas returned an editable proposal. Keeping it created one child and two ancestry edges, preserved both originals, and saved the source explanations. The child and edges survived a reload and appeared in a second browser on the same local server. Typecheck and production build passed. The deployed app has not been rechecked for this change.
- On 2026-10-07, eight mocked assistant-route tests cover request limits, alias translation, invalid-reference removal, and safe provider errors. `npm test` passed all 95 tests. Typecheck, production build, and `npm run lint` passed. ESLint ignores the nested `.assistant-route-validation` worktree and the local `.venv-clustering` environment. Three local POSTs for relevant, irrelevant, and action prompts returned 502 `provider_error` after 1,250 ms, 27 ms, and 26 ms. DNS resolved `api.featherless.ai`, but TCP 443 was unreachable, so live reply validation, citation quality, and prompt-injection behavior remain unverified.
- On 2026-10-07, the assistant implementation pass added browser-side request and response handling, citation focus, create/edit/link/merge previews, local action state, source provenance and ancestry, relationship editing and conflict conditions, and shared editing presence. `npm test` passed all 104 tests; lint, typecheck, and production build passed. These are code and mocked-test checks; an interactive browser run and two-browser Liveblocks verification were not available. The local assistant and conflict-merge requests previously returned 502 `provider_error` because Featherless TCP 443 was unreachable, so a successful live reply and condition-aware proposal remain unverified. WORK-028's human evaluation was excluded.
- On 2026-10-07, the running local app returned HTTP 200 for `/` and the open shared-board route. The focused assistant tests passed 15/15, and malformed input returned HTTP 400. A valid seeded-board `POST /api/assistant` returned HTTP 502 with the safe provider error because Featherless TCP 443 was unreachable. `POST /api/liveblocks-auth` for the open room returned HTTP 503, so that board could not connect to Liveblocks in this run. Computer Use and Node REPL browser automation failed to initialize with OS error 3, leaving chat interaction and a successful live answer unverified.
- On 2026-10-08, TCP 443 to `api.liveblocks.io` and `api.featherless.ai` succeeded from the normal Windows shell and failed from the restricted Codex shell. Starting Next outside that restricted shell restored access. The current shared-room `POST /api/liveblocks-auth` returned HTTP 200 with an authorization token. A valid `POST /api/assistant` returned HTTP 200 in 4.1 seconds from `zai-org/GLM-5.3-Flash`; it returned two paragraphs citing both requested cards and a `synergy` link action. Browser interaction and two-client storage synchronization remain unverified because browser automation failed to initialize.
- On 2026-10-08, the assistant branch fast-forwarded to `origin/main` at `d5df2ba` and resolved the new canvas routing and suggestion-panel changes. An isolated shared board connected through Liveblocks in headless Edge. A live Featherless chat reply showed four clickable citation chips and a link action. Clicking a chip selected and centered its card. Preview drew a dashed link, and Discard removed it. A second live reply offered a create action; Preview drew a ghost card and two dashed ancestry edges. Accepting an edited title saved an assistant-labeled idea with both source snapshots and generated text. The idea survived a reload and guest rejoin. A redundant link action was disabled in the browser, then the route was changed to remove duplicate saved-link actions. The rebuilt route returned HTTP 200 with two citations and no duplicate link action. All 110 tests, lint, typecheck, and production build passed. Two-browser synchronization and the remaining assistant action paths have not been verified.
- Liveblocks authorization returned a token and a secure guest cookie
- On 2026-10-06, the guest profile endpoint accepted a trimmed display name, set an HTTP-only cookie, and rejected an empty name. The board route serves the guest-entry client before mounting the Liveblocks room.
- On 2026-10-06, the Vercel production app at [idea-forge-wine.vercel.app](https://idea-forge-wine.vercel.app) served the local and shared boards over HTTPS. A real browser merge returned a valid proposal in 26.3 seconds; keeping it preserved both originals, their source snapshots, and two ancestry edges. A fresh shared board connected to Liveblocks with a secure HTTP-only guest cookie. Ten loaded client chunks contained no known provider keys, credential patterns, or Gemini SDK code.
- On 2026-10-06, two local browser sessions created and joined a shared board from the landing screen. A new idea appeared in both browsers and remained after both reloaded. On the deployed app, two browsers connected to one room, synchronized a new idea, a card title edit, and a card move, and retained those changes after both reloaded.
- On 2026-10-05, live tests measured embedding similarity and merge latency across Gemini models. The results are in [Similarity](decisions.md#similarity) and [AI reliability](decisions.md#ai-reliability).

Earlier two-tab checks verified suggestion acceptance and saved-text sync over Tailscale. The current local matching and Jev pipeline has separate verification below; live Jev quality and deployment checks remain outstanding.

Not yet verified: active member names across two deployed browsers, goal changes, and kept merges syncing and surviving reload on the deployed shared board. Link routing on a dense board, Organize and merge spacing in a browser, and manual Suggested Links refresh with live Jev are also unverified. Production retry, fallback, and forced timeout behavior remain unverified. The deployed commit configures the merge function for 95 seconds; its live merge completed within the first 30-second attempt.

The older browser checks above that mention merging or ancestry ran against the previous merge UI. The 2026-10-07 check above covers the current canvas on a local server.

Known gaps:

- Verifying four-person collaboration on the deployed app.
- Verifying shared-board Organize positions and group snapshots sync across browsers and survive reload.
- Verifying goal changes and kept merges across two deployed browsers and reloads.
- Recording idea and relationship creators and last editors.
- Strict conflict-safe undo. Liveblocks native history cannot reject one unsafe undo before moving its history position; it may not satisfy rules for same-field edits, later links or edits to a created idea, movement conflicts, or merge restoration.
- Invitation workflows and permission changes. Board UUID links remain public edit links; memberships currently support dashboard listing only.
- Editing or regenerating a proposal before keeping it.
- A policy for two people typing in one note.

Shared canvas undo and redo now use Liveblocks Storage history. Each client has a session-local history for the current room; it resets on reload and room change and is not shared across tabs or devices. The current implementation uses native history and does not claim strict conflict guards. Multi-client conflict behavior, deployed UI shortcuts, read-only controls, reload reset, room switching, and live redo behavior still need browser verification.

To regenerate a proposal today, discard it and merge again. Retry and fallback failures were tested with mocked provider responses; live overload and fallback behavior remain unverified. Liveblocks behavior was not retested for WORK-011.

On 2026-10-08, WORK-033 benchmarked live TypeSafe `jev-1.13.0` against Featherless Simple Jev `featherless-ai/Qwen3.8-27B-classifier` with `npm run bench:jev`. The cases were 24 human-labeled pairs and 19 agent-written stress cases, sent through the production classifier and suggestion code. With one pair per request, the two classifiers agreed with the human labels about equally (67% and 63% exact). With the production 24-pair batches, Featherless showed 46% and 54% of human-labeled links in two runs against TypeSafe's 69%, used about three times the input tokens, and was 4 to 8 times slower. Both classifiers missed most links placed late in a full batch. TypeSafe failed 3 of about 170 requests because `src/lib/jev.ts` rejects two-decimal probabilities that sum to 0.99. `Qwen3.6-35B-A3B-classifier` rejected every request with HTTP 400. The recommendation is to keep TypeSafe for now and re-run with smaller batches before switching. [The benchmark README](../eval/jev-bench/README.md) has the full results and caveats.

On 2026-10-07, WORK-031 saved suggestion dismissals with the board and excluded merge lineage from suggestion requests. All 87 automated tests, lint, typecheck, and the production build passed. A local production server over Tailscale used live Jev, MongoDB, and Liveblocks. Two guest tabs on one new room received the same three suggestions; the second tab's request reused the cached result. Dismissing a pair in one tab removed it from the other right away. Changing the board goal started a new live Jev pass, and both tabs showed three suggestions without the dismissed pair. The Liveblocks REST API showed the pair stored in the room's `dismissedConnections` map. Merge-lineage exclusion and the cooldown waiting status were covered only by unit tests and code review; no live merge or cooldown response ran.

On 2026-10-07, WORK-030 moved generation from Gemini to `zai-org/GLM-5.3-Flash` on Featherless and kept Gemini embeddings. All 85 automated tests, lint, typecheck, and the production build passed. Mocked tests cover the chat completions request, JSON-mode and schema prompt, reasoning-effort and token-limit settings, reasoning-block and Markdown-fence unwrapping, separate provider keys, and the unchanged retry, fallback, and timeout policy. No `FEATHERLESS_API_KEY` was available, so live Featherless generation, its JSON-mode behavior, its overload status codes, and latency at `low` reasoning effort remain unverified.

On 2026-10-07, WORK-029 replaced automatic Gemini suggestions with local matching and Jev classification. All 80 automated tests, lint, typecheck, and the production build passed. Mocked provider tests cover bounded batches, classification validation, caching, changed-source invalidation, explicit explanations, and no retry or fallback. Live MongoDB tests used an isolated collection: eight concurrent requests for one board allowed one call, separate boards shared the daily limit, a second store read the cache, expired entries were ignored, and explanation requests had a separate allowance. The collection was removed afterward.

The production browser at `http://100.102.144.120:3000` connected to Liveblocks and displayed the missing TypeSafe key message. An explicitly mocked Jev response produced a dashed preview with acceptance disabled until an explanation was entered. No explanation request ran automatically. Clicking **Explain with Gemini** made one live request; the configured `gemini-3.8-flash` returned HTTP 503 and the interface reported overload without retry or fallback. Live Jev classification and successful live explanation generation remain unverified. The deployed app has not been checked for this change.

Connection suggestions were verified on 2026-10-06 with 60 automated tests, lint, typecheck, and a production build. Live Gemini returned suggestions through the configured generation fallback after primary-model overloads. In the Tailscale browser, a real suggestion appeared automatically and became a normal link when accepted. Card movement and acceptance caused no further generation requests. Mocked browser responses covered editable explanations, direction reversal, dismissal, clarification, and failure feedback. Two tabs connected to a fresh Liveblocks room; accepting an edited suggestion synchronized the link and it survived reload. Editing a source in the second tab removed the first tab's stale preview and queued fresh suggestions. Mobile layout verification was interrupted by preview resize timeouts.

Candidate selection currently uses four nearest neighbors and three diverse candidates per card. These counts are provisional; the real-note evaluation in WORK-006 remains open.

## Team

Names aren't assigned yet. Each task in `.tasks/` names its owner by role.

| Role | Owns |
| --- | --- |
| SE1 | Canvas interactions: cards, links, suggestion and merge previews, Organize animation |
| SE2 | Deployment, sync, authorship, deletion, editing lock, release checks |
| AI1 | Embeddings, similarity, connection suggestions, Organize inputs |
| AI2 | Shared AI module, merge prompt, board conclusion, evaluation cases |

## Plan

Day 1 is the first of the five days remaining as of 2026-10-05. Each day ends with a milestone task in `.tasks/milestones/` whose exit criteria match the "Done when" column. Check one with `taskroot milestone day-1 --exit-checklist`.

| Day | Focus | Done when |
| --- | --- | --- |
| 1 | Deployment, sync, authors, typed links, similarity, shared AI module, evaluation cases | Two browsers on the deployed app share typed links and cards that show their authors |
| 2 | Connection suggestions, editable link-aware merges | Two users go from create to connect to combine on the deployed app |
| 3 | Organize, deletion, editing lock, board conclusion | The whole demo journey works on the deployed app |
| 4 | Session with an unfamiliar team, AI evaluation, release checks | Feature freeze: every release check passes |
| 5 | Demo board, backup video, README, submission | Submitted with time remaining |

Stretch work covers a board assistant that proposes actions as previews, specified in [Board assistant](assistant.md), and live cursors. Board assistant work may start when its technical prerequisites are ready. Live cursor work starts only after the Day 3 milestone is done.

Personalization in `work:WORK-039` is Done. Open Style to customize cursors, notes, relationships, theme, accent, background, and named cluster borders. Clear Enable animations to stop motion; reduced-motion preferences also disable it. Each activity effect has its own switch, and shared styles follow board write access. The task has Medium priority and no submission milestone.

Verification on 2026-10-09 passed all 163 tests, lint, typecheck, and the production build. Browser checks used the Tailscale address `100.102.144.120` with live Liveblocks rooms and real Organize, naming, and merge provider calls. Checks covered two-browser style sync, reloads, named cat and rainbow clusters, cursor alignment during pan and zoom, dragging bounds, read-only controls, merge snapshots, action effects, reduced motion, and a 390-pixel mobile viewport. A temporary HTTPS proxy verified clipboard success; HTTP verified clipboard failure. A deliberately aborted assistant request verified thinking cleanup and error feedback. Signed-in browser sessions, other browser engines, production deployment, and kept conclusion snapshots were not exercised; conclusion storage is absent from this checkout. The WORK-039 task records the detailed evidence.

Personalization follow-up `work:WORK-040` is Done. Style includes a Clouds canvas background and a single static RGB border with alternating colors along its outline. Existing rainbow selections render as RGB without changing their saved identifiers. The Growing ideas plant and Board mood toggle are removed; achievement stickers remain. Cursor settings explain that other participants see your styled cursor when you point inside the same board.

Verification on 2026-10-10 passed all 163 tests, lint, typecheck, and the production build. The T3 shared browser verified light and dark Clouds, reload persistence, existing and newly selected RGB borders on clusters and notes, matching settings previews, and static borders with animations disabled. Two live browser connections verified a named cat cursor through Liveblocks. Native reduced-motion emulation, signed-in sessions, other browser engines, and deployment were not rechecked. The existing reduced-motion hook and CSS use the same motion-off behavior. AI calls were not needed for this follow-up. A later clarification replaced whole-border color cycling with a masked multicolor outline shared by notes, clusters, and previews. Lint, typecheck, and build passed again, and the T3 browser screenshot confirmed several colors on one line.

If the schedule slips, cut in this order:

1. Board assistant.
2. Live cursors.
3. Organize animation. Keep the layout and drop the animation.
4. Board conclusion.

Protect live collaboration, explained connections, merging with ancestry, and persistence.

## AI evaluation

Prepare 20 to 30 note pairs. Two team members label each pair's relationship independently, and "no relationship" and "needs clarification" are valid labels. Include mixed Vietnamese and English, and cover these categories:

- Clearly useful combinations.
- Related ideas that don't benefit from merging.
- Unrelated pairs.
- Apparent contradictions that need clarification.
- Genuine conflicts under a stated condition.
- Ambiguous or underspecified notes.
- Useful combinations across different themes.
- Merges that risk losing a distinct contribution.

For each merge, check that:

- A meaningful part of each source is still visible.
- The concept describes a concrete mechanism instead of restating the notes.
- It serves the board goal.
- It admits tensions or a forced connection and lists the assumptions it adds.
- The suggested experiment is something the team could actually run.

Record these results:

- The agreement rate between suggested relationships and the human labels.
- Merges from the IdeaForge prompt compared with a plain "combine these notes" prompt on at least ten pairs. Judge them without knowing which prompt produced which.
- Raw and mean-centered similarity on at least 40 real notes, with the chosen embedding model, the small-board threshold, and the candidate counts.
- Latency of merge, suggestion, and similarity requests on the deployed app.

Don't claim measured impact without evidence.

## Release checks

Run these on the deployed app before the Day 4 feature freeze:

- Four people can contribute to the same board at once.
- Reloading restores saved work, and reconnecting shows the current board.
- Two people editing at the same time don't silently erase each other's changes.
- Accepted AI links reference cards that exist.
- A proposal generated from old card text can't overwrite newer work.
- Merging keeps the originals and their ancestry.
- Manual work stays usable when an AI request fails.
- Organize settles and leaves pinned cards in place.
- The full journey works on unfamiliar notes, not only the rehearsed board.

## Demo script

1. Start from a seeded board of about 30 cards on one goal, where the best pair to combine isn't obvious.
2. Two collaborators add cards live.
3. Click **Organize** to show the groups.
4. Wait for automatic connection suggestions after adding or editing ideas.
5. Open the explanation of a suggestion that links cards from different people, and accept it.
6. Merge the pair, walk through each contribution and the assumptions it adds, and keep the concept.
7. Show its authors and parent cards. Select the merged concept and a cluster, generate a conclusion, and export it as Markdown.
8. Reload to show the board persists.

Explain what changed in the team's thinking rather than listing technologies.

Collect this evidence for the submission:

- A recorded end-to-end session.
- Evaluation results and observed failures.
- Latency on the deployed app.
- Feedback from the unfamiliar team.
- A clear split between implemented and planned features.
