# Board assistant implementation plan

This plan completes the board assistant from the existing API route through chat and reviewable canvas actions. Use it with [the assistant design](assistant.md) and the linked work items when you implement each phase. Keep provider credentials on the server, keep previews in the requesting browser, and preserve source cards and snapshots when a person accepts an action. The human citation-quality evaluation in [WORK-028](../.tasks/work/WORK-028-evaluate-the-board-assistant.md) is outside this plan.

## Progress snapshot — 2026-10-07

Implementation is underway in the `codex/assistant-route` checkout. WORK-025 now connects the browser sidebar to the validated route, retains the transcript and request snapshots in component state, renders citations, and wires action cards. WORK-026 adds create previews, editable drafts, saved source provenance, and ancestry from `parentIds`. WORK-027 adds edit, link, and merge previews with latest-board checks; the link editor requires conflict conditions, and shared-board presence carries the card being edited. These tasks and their prerequisites remain In Progress until their acceptance criteria are verified. On 2026-10-08, a live assistant API request and Liveblocks authorization both succeeded after Next ran outside the restricted Codex shell. Browser interaction, two-browser lock/sync behavior, and a successful live conflict-merge response remain unverified. WORK-028 stays excluded, and WORK-021 stays open because its exit criteria include WORK-028.

## Starting point

[WORK-024](../.tasks/work/WORK-024-assistant-chat-route-with-card-citations.md) is Done. `POST /api/assistant` accepts a validated board snapshot, message, selected card, and recent text history. It returns `{ result, model, generatedAt }`; `result` has cited reply paragraphs and up to three create, edit, link, or merge actions. The server maps temporary card aliases back to real IDs. Mocked route tests, lint, typecheck, and build passed. Three live requests from the restricted Codex shell returned `502 provider_error` because that shell could not reach Featherless on TCP 443. On 2026-10-08, a live request succeeded after Next was started outside the restricted shell; interactive browser behavior and citation quality remain unverified.

`ChatSidebar` now posts current board context to the route and keeps its transcript local to the mounted board. `BoardApp` owns the board, selection, React Flow instance, merge controls, and local or shared board adapter. `SharedBoardContent` applies accepted changes against current Liveblocks Storage inside `useMutation`. `connection-preview.ts` provides the title/content snapshot check used by suggested links. `merge-board.ts` supplies shared related-idea placement. Saved ancestry now draws from `parentIds`, while merge source snapshots remain available for older boards.

The primary `codex/assistant-route` checkout is the source of truth for this work. The overlapping `feat/assistant-route` checkout is preserved. Keep unrelated changes, read [decisions.md](decisions.md) before changing product scope, architecture, or access policy, and log any such change there. Keep [roadmap.md](roadmap.md) and the task checklists aligned with work that has actually been verified.

## Task order and ownership

| Work | Tracker state | Owner and gate | Result |
| --- | --- | --- | --- |
| [WORK-025](../.tasks/work/WORK-025-connect-the-chat-sidebar-to-the-assistant.md) | In Progress | SE1; WORK-024 Done | Real chat on local and shared boards, citation chips, focus, and request snapshots. |
| [WORK-026](../.tasks/work/WORK-026-assistant-idea-previews-with-ancestry.md) | In Progress | SE1; WORK-025 and WORK-009 plus WORK-010 | Create preview, editable draft, saved provenance, and ancestry. |
| [WORK-027](../.tasks/work/WORK-027-assistant-edit-link-and-merge-previews.md) | In Progress | SE1; WORK-025 and WORK-009 plus WORK-010 and WORK-014 | Edit, link, and merge previews with guarded acceptance. |
| [WORK-028](../.tasks/work/WORK-028-evaluate-the-board-assistant.md) | To Do | Excluded | The 15-message human citation-quality evaluation stays open. |

[WORK-009](../.tasks/work/WORK-009-connection-suggestion-review-ui.md) and the shared AI module in [WORK-011](../.tasks/work/WORK-011-shared-ai-module-with-retry-fallback-and-error-causes.md) are Done. [WORK-010](../.tasks/work/WORK-010-editable-link-aware-merge-proposals.md), [WORK-003](../.tasks/work/WORK-003-display-names-and-card-authors.md), [WORK-004](../.tasks/work/WORK-004-typed-relationship-links.md), and [WORK-014](../.tasks/work/WORK-014-card-editing-lock.md) are In Progress. Code now carries author names and conflict conditions, supports editing relationships, and publishes editing presence; verify the remaining criteria, including cross-browser sync and lock behavior, before closing these prerequisites. WORK-025 can proceed while those gates are resolved. WORK-026 and WORK-027 must remain open until their own criteria and prerequisites are verified.

Read the linked `.tasks/work/` files as the current task record. Follow the repository's task workflow when you start implementation; this document does not change task status.

## Phase 1: Connect chat and citations (WORK-025)

### Board input and request lifecycle

Pass the live `Board`, board title, selected idea ID, and a focus callback from `BoardApp` to `ChatSidebar`. At send time, copy the current goal, cards, relationships, selected card, and recent text history into an `AssistantRequest`. Send `board.goal` when it has nonblank text; otherwise use the nonblank board title as the documented goal fallback. Map each card to `id`, `title`, `content`, and available `author`. Map each relationship to its source, target, type, explanation, and optional condition. Send only an existing selected idea ID; a selected relationship is not `selectedCardId`.

Use the limits in `src/lib/assistant.ts` before calling the route. The request allows 100 cards, 40,000 total card-text characters, 500 links, a 2,000-character new message, and up to 10 earlier messages. Preserve the more specific per-card and per-field limits from the schema. Show the route's 400 message if the board is too large; do not silently omit cards, because the answer is designed to use the whole board. Keep the compose text available when a failed request needs a retry.

Store chat turns in component state for the lifetime of the mounted board. Derive request history from the last 10 completed user and assistant text turns; do not send citations, actions, or old board snapshots as history. Copy the exact `id`, `title`, and `content` of cards sent with each request into that reply's browser-local record. Keep `model`, `generatedAt`, the paragraphs, actions, and their own snapshot with that reply. Do not write chat history or pending actions to Liveblocks or browser persistence. A reload may clear them.

Allow one in-flight request per chat. Disable duplicate sends while waiting, show an accessible loading state, and handle abort, network, non-JSON, and non-2xx responses without blocking manual board controls. Parse the successful envelope and `result` with the shared assistant contract in `src/lib/assistant.ts`; do not trust an unchecked `response.json()` object. Show the safe server error text, and label successful replies as AI-generated with their returned model. Remove the canned assistant message and the `AI not connected` label. A mocked or canned response used for a demo must carry an explicit mock label.

### Citation display and focus

Render each reply paragraph separately, followed by chips for that paragraph's `cites` IDs. Use the saved request snapshot for each chip's original title. Resolve the ID against the current board when the chip is clicked. If the card still exists, select it and call React Flow `fitView` or the existing viewport API so the card is visible. If it was deleted, show a gone state and make the chip inert. Keep earlier text and citations visible when another participant edits a card; the reply describes the older snapshot, while action acceptance will use the staleness check.

### Files and acceptance gate

Expect changes around `src/features/board/chat-sidebar.tsx`, `board-app.tsx`, `board.css`, and a small browser-side transcript or response parser module if shared logic warrants one. Keep the provider call inside `src/app/api/assistant/route.ts`; the browser sends only board data. WORK-025 is complete when local and shared boards both send current context, citations focus the right card, deleted-card chips do nothing, loading and errors are clear, replies name the model, and no chat state enters Liveblocks.

## Phase 2: Close create-preview prerequisites

Recheck [WORK-010](../.tasks/work/WORK-010-editable-link-aware-merge-proposals.md) against its last unchecked criterion. The merge request already includes a typed link when one exists, but the task records that a live conflict-pair check remains. Verify that a conflicts-with merge proposal addresses the saved condition. WORK-010 depends on WORK-004, so audit the manual link behavior, stored condition, direction, edit/delete controls, and shared sync in WORK-004 before marking its dependency ready. Use the existing [WORK-009](../.tasks/work/WORK-009-connection-suggestion-review-ui.md) snapshot and review behavior as the baseline for assistant acceptance.

This gate does not delay WORK-025. It gates WORK-026 and WORK-027 under their declared dependencies. Record any unverified provider or Liveblocks behavior in the task and roadmap instead of treating a mocked response as a live result.

## Phase 3: Create-idea previews and provenance (WORK-026)

### Preview state and canvas

Render each returned `create` action under its reply with **Preview**, **Accept**, and **Discard**. Keep the active preview, edited title/content, action ID, and reply snapshot in browser state. **Preview** creates a ghost React Flow node near the one to four `basedOn` cards and dashed ancestry edges from those cards. Pan to the sources and ghost. The ghost must be visually and semantically distinct from saved ideas, must not be draggable into a saved board change, and must not enter `Board.ideas` or Liveblocks Storage. **Discard** removes only the preview. If a second action is previewed, define one active canvas preview and retain the other actions in chat.

Extract the collision-aware placement in `merge-board.ts` into a helper usable by both two-source merges and one-to-four-source assistant ideas. Compute the preview location from current source positions; compute the saved position again from current board state when accepting. Moving a card can change placement without making its answer text stale. Preserve manual layout and pinned cards while choosing a free location.

### Saved idea data

Keep one source-snapshot shape for merges and assistant-created ideas: source ID, title, content, and author at generation time. Extend the `Idea` model with assistant provenance rather than forcing a one-to-four-source record into the two-source `MergeRecord`. The assistant record should include all source snapshots, the generated title and content, the current accepted title and content through normal `Idea` fields, returned model, returned generation time, and the accepting person's author name. Set `parentIds` to the distinct source IDs in the action. Preserve `merge` and its existing saved records for older boards; read them without migration loss. Add an assistant-created label and a source-detail view that shows the saved text and model even if the original card changes later.

Draw saved ancestry from `parentIds` for all ideas whose parent card still exists, instead of relying only on `idea.merge.sources`. Keep ancestry distinct from typed relationships and avoid duplicate edges. Existing merged ideas must retain their two edges after the refactor. A deleted parent does not erase its source snapshot from the saved child.

### Acceptance and stale input

Use the card text saved with the reply and `ideaSnapshotsMatch` to check every `basedOn` card. Validate the edited title/content and source count. Create a fresh idea ID and commit through the same local/shared board path as manual creation. In the shared path, perform the source check inside the `useMutation` updater against current Liveblocks Storage; a check against only the rendered board can race another editor. Refuse the write if any source is missing or its title/content differs. Preserve every source card. Mark the cluster snapshot stale in the same accepted update. Show an actionable stale message that offers a new assistant request. Clear the ghost only after acceptance succeeds.

WORK-026 is complete when one-to-four-source ghosts and dashed edges stay local to one browser, edited drafts save with the original generated text, parent edges and source snapshots survive reload on shared boards, stale or deleted sources prevent a write, and discard leaves board state unchanged.

## Phase 4: Close edit-preview prerequisites

Complete [WORK-014](../.tasks/work/WORK-014-card-editing-lock.md) before closing assistant edit work. It depends on the display-name and author work in [WORK-003](../.tasks/work/WORK-003-display-names-and-card-authors.md). Presence now carries the editing idea ID, and the canvas shows the editor name and refuses conflicting edits. Verify that the lock releases on editor exit or disconnect, and that moving, linking, and merging a locked card remain available. Reuse the same lock check for assistant edits.

Review link rules in [decisions.md](decisions.md#relationships) and the manual/link-suggestion implementations before WORK-027. A conflict link needs a nonblank condition, an extends link keeps source-to-target direction, and duplicate or same-card links are refused. Do not treat WORK-027 as ready until its declared WORK-010 and WORK-014 gates are satisfied.

## Phase 5: Edit, link, and merge actions (WORK-027)

### Shared action behavior

Every returned action has its own **Preview**, **Accept**, and **Discard** controls in chat. Show the model's `why` next to the action. Keep draft edits and previews in browser state, and let only one action own the canvas preview at a time. Before any acceptance, compare all named cards with the exact title/content snapshot sent for that reply. Repeat the check inside the latest-board mutation, so a second browser cannot edit a source between a visible precheck and a write. A missing or changed card disables acceptance and prompts a fresh request. Discard removes the preview and writes nothing.

### Edit

Show the saved current title/content beside the proposed values; unchanged fields remain as they are. Apply title/content through `updateIdea` so cluster staleness follows the manual path. Reject empty titles and values outside the card limits. Check the WORK-014 lock immediately before acceptance. After a successful edit, keep the original reply and snapshot in chat, clear its preview, and display the changed card. Do not let a later board render silently replace the saved before-text in the comparison view.

### Link

Draw a dashed provisional edge between the proposed source and target, labeled with its type. Let the person edit type and explanation and, where the chosen type requires it, the conflict condition. Offer a clear direction control for an extends link; the stored source must be the extending card. Reuse `canAcceptConnection` or extract its validation so assistant and suggestion links share the nonblank explanation, conflict condition, snapshot, and duplicate checks. Check again against the latest board and add through `createRelationship`. Keep assistant preview edges out of saved relationships until acceptance. Report an already existing link without hiding or overwriting it.

### Merge

Highlight both proposed cards and show the assistant's reason. On **Accept**, set the two selected merge IDs and open the existing merge tray with that pair. The ordinary merge request then uses the current goal and link context, and the person still reviews its generated proposal before keeping it. The assistant action itself never creates a merged idea. Recheck both card snapshots before opening the flow; the merge flow keeps its own fingerprint check before saving. **Discard** removes the highlight and leaves board data unchanged.

WORK-027 is complete when all three preview kinds display correctly, editable link fields follow relationship rules, the lock blocks assistant edits by another editor, stale or deleted cards block every action, merge acceptance enters the existing review flow, and preview/discard never write board data.

## Verification and evidence

For implementation work, add focused checks for the new behavior and run `npm run lint`, `npm run typecheck`, and `npm run build` after code changes, as `AGENTS.md` requires. Check request mapping and schema errors; paragraph-to-chip mapping; focus and deleted-card chips; one request at a time; local-only transcript and ghost state; one-to-four-source snapshots; existing merge ancestry after the refactor; stale/deleted acceptance; duplicate links and required conflict conditions; extends direction; lock refusal; and no board write on preview or discard. Verify the shared updater with two browsers and a reload when Liveblocks credentials are available. Inspect the saved Liveblocks record for provenance and source snapshots instead of relying only on what the canvas displays.

When Featherless egress is available, send a real assistant request for a relevant card, an irrelevant question, and an action proposal. Check that returned citation IDs refer to the cards sent on that turn and that the displayed text, model label, and action shape match the response. Record latency and provider failures as observed. This live functional check confirms the route and UI can work together; it is separate from the excluded 15-message human quality evaluation. Use the currently configured generation provider for the WORK-010 conflict-pair check, and name any provider or Liveblocks checks that could not run.

Update each task checklist only with evidence for its own acceptance criteria, then update [roadmap.md](roadmap.md). Keep the [WORK-021 assistant epic](../.tasks/work/WORK-021-board-assistant-stretch.md) open because its exit criteria include WORK-028. Do not mark the epic Done when WORK-025 through WORK-027 finish.
