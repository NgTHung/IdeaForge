# Roadmap

What's built, what's verified, and the five-day plan to the Forgehack submission. It also defines how the team evaluates AI quality, the checks that must pass before feature freeze, and the demo. Individual tasks, owners, dependencies, and acceptance criteria live in `.tasks/`. Run `taskroot list` to see them and `taskroot ready --domain work` to find work you can start.

## Current status

Done:

- Landing screen at `/` with actions to create a shared board or join by URL or UUID.
- Guest lobby at `/board/<uuid>` that asks for a display name before connecting to Liveblocks and remembers the name in that browser.
- Shared canvas at `/board/<uuid>` with seeded Liveblocks Storage, live board mutations, saved room state, and a share-link button.
- Organize on the canvas with a chosen group count, separated rectangular notes, a score for each note pair, and optional placement of only newly saved notes. Group snapshots persist with shared boards.
- Gemini suggested group names, with manual rename controls; labels save in the cluster snapshot and update matching canvas badges.
- Shared-board header with active connection avatars and count; the member list shows connected names and Editor or Viewer access.
- Account popover on the landing screen and shared boards, with the signed-in user's name and sign-out action.
- Merge endpoint with Zod validation and Gemini structured output
- Liveblocks guest authorization route
- Shared server-only Gemini module with one retry, optional generation and embedding fallbacks, output validation, and cause-specific errors

Verified:

- On 2026-10-06, before the canvas replaced the merge UI, its two board-model tests, lint, typecheck, and production build passed. A headless Chrome check at 1280×720 confirmed the board renders, a connection drag shows its preview and chooser, confirmation adds a link without moving its source, a pinned idea stays fixed, and direct dragging works with physics on.
- Lint, typecheck, and production build pass
- On 2026-10-06, average-linkage clustering tests cover request validation, deterministic groups, response score summaries, and a successful mocked endpoint call. Layout tests cover pinned and excluded notes and card separation. A local browser smoke test grouped the five sample ideas, displayed method and group summaries, paused Physics, and restored the prior positions with Undo layout.
- On 2026-10-07, 53 repository tests passed, including complete note-pair response validation, score-based rectangle spacing, deterministic new-note assignment, snapshot invalidation after edits and deletions, and mocked clustering endpoints. Lint, typecheck, and production build pass; lint reports only three unused-variable warnings in the bundled `.venv-clustering` scikit-learn file. Live localhost requests returned 3 of 3 note-pair scores from full clustering and 6 of 6 from incremental assignment. A browser check grouped the five sample ideas into two separated sets without bubble outlines; after saving one new note with auto placement enabled, only that new note moved and gained a Group 1 badge. Two-browser shared snapshot sync still needs verification.
- A Chromium smoke test covers selection, missing-key feedback, accepting a merge (using a mocked response), ancestry, editing, adding notes, and mobile width
- A live Gemini merge returned a valid proposal
- On 2026-10-06, 34 mocked tests cover AI generation, embeddings, retry and fallback attempt counts, SDK timeouts, output validation, safe errors, and merge-route contracts. Lint, typecheck, and production build pass.
- On 2026-10-06, live Gemini calls through the shared module returned a valid merge in 8.4 seconds and two 768-dimensional embeddings in 0.7 seconds. The production browser, reached through Tailscale, showed the missing-key message and allowed editing and adding notes after the failed request. A live browser merge could be kept, leaving both originals and two ancestry edges. The Gemini key and SDK were absent from client chunks, and the server-only import guard passed.
- Liveblocks authorization returned a token and a secure guest cookie
- On 2026-10-06, the guest profile endpoint accepted a trimmed display name, set an HTTP-only cookie, and rejected an empty name. The board route serves the guest-entry client before mounting the Liveblocks room.
- On 2026-10-06, the Vercel production app at [idea-forge-wine.vercel.app](https://idea-forge-wine.vercel.app) served the local and shared boards over HTTPS. A real browser merge returned a valid proposal in 26.3 seconds; keeping it preserved both originals, their source snapshots, and two ancestry edges. A fresh shared board connected to Liveblocks with a secure HTTP-only guest cookie. Ten loaded client chunks contained no known provider keys, credential patterns, or Gemini SDK code.
- On 2026-10-06, two local browser sessions created and joined a shared board from the landing screen. A new idea appeared in both browsers and remained after both reloaded. On the deployed app, two browsers connected to one room, synchronized a new idea, a card title edit, and a card move, and retained those changes after both reloaded.
- On 2026-10-05, live tests measured embedding similarity and merge latency across Gemini models. The results are in [Similarity](decisions.md#similarity) and [AI reliability](decisions.md#ai-reliability).

Not yet verified: active member names across two deployed browsers, goal changes, and kept merges syncing and surviving reload on the deployed shared board. The current canvas does not expose board-goal editing or the merge flow. Production retry, fallback, and forced timeout behavior remain unverified. The deployed commit configures the merge function for 95 seconds; its live merge completed within the first 30-second attempt.

The browser checks above that mention merging or ancestry ran against the previous merge UI. The current landing screen links to the shared board at `/board/<uuid>`. Merge proposals and ancestry are not connected to the current canvas.

Known gaps:

- Connecting the canvas to the merge and connection-suggestion routes.
- Verifying shared-board Organize positions and group snapshots sync across browsers and survive reload.
- Verifying goal changes and kept merges across two deployed browsers and reloads.
- Recording idea and relationship creators and last editors.
- Reverting a participant's latest operation when no later edit has changed its affected values.
- Persisting the MongoDB board directory record with its owner and Liveblocks room ID. Separate membership and share-grant collections are out of scope for the hackathon.
- Editing or regenerating a proposal before keeping it.
- A policy for two people typing in one note.

To regenerate a proposal today, discard it and merge again. Retry and fallback failures were tested with mocked provider responses; live overload and fallback behavior remain unverified. Liveblocks behavior was not retested for WORK-011.

## Team

Names aren't assigned yet. Each task in `.tasks/` names its owner by role.

| Role | Owns |
| --- | --- |
| SE1 | Canvas interactions: cards, links, suggestion and merge previews, Organize animation |
| SE2 | Deployment, sync, authorship, deletion, editing lock, release checks |
| AI1 | Embeddings, similarity, connection suggestions, Organize inputs |
| AI2 | Shared AI module, merge prompt, concept brief, evaluation cases |

## Plan

Day 1 is the first of the five days remaining as of 2026-10-05. Each day ends with a milestone task in `.tasks/milestones/` whose exit criteria match the "Done when" column. Check one with `taskroot milestone day-1 --exit-checklist`.

| Day | Focus | Done when |
| --- | --- | --- |
| 1 | Deployment, sync, authors, typed links, similarity, shared AI module, evaluation cases | Two browsers on the deployed app share typed links and cards that show their authors |
| 2 | Connection suggestions, editable link-aware merges | Two users go from create to connect to combine on the deployed app |
| 3 | Organize, deletion, editing lock, concept brief | The whole demo journey works on the deployed app |
| 4 | Session with an unfamiliar team, AI evaluation, release checks | Feature freeze: every release check passes |
| 5 | Demo board, backup video, README, submission | Submitted with time remaining |

Stretch work starts only after the Day 3 milestone is done. It covers a board assistant that proposes actions as previews, specified in [Board assistant](assistant.md), and live cursors.

If the schedule slips, cut in this order:

1. Board assistant.
2. Live cursors.
3. Organize animation. Keep the layout and drop the animation.
4. Concept brief.

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
4. Select a card and click **Suggest connections**.
5. Open the explanation of a suggestion that links cards from different people, and accept it.
6. Merge the pair, walk through each contribution and the assumptions it adds, and keep the concept.
7. Show its authors and parent cards, and generate the concept brief.
8. Reload to show the board persists.

Explain what changed in the team's thinking rather than listing technologies.

Collect this evidence for the submission:

- A recorded end-to-end session.
- Evaluation results and observed failures.
- Latency on the deployed app.
- Feedback from the unfamiliar team.
- A clear split between implemented and planned features.
