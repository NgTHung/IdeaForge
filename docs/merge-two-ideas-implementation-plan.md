# Merge two ideas on the canvas

This plan connects the current canvas to the Gemini merge route. You select two notes, review an editable concept, and create one new note that points back to both sources. The two source notes stay on the board. The layout follows the supplied reference: two source cards above a combined concept, joined by curved lines.

## Starting point

`src/features/board/board-app.tsx` holds only one selected idea or relationship at a time. It does not call `POST /api/merge`. That route already validates a goal and two nonempty source texts and returns a title, concept, source contributions, tension, and next experiment. The canvas `Idea` type has `parentIds`, but it has no source snapshots or merge proposal. The current board model also has no goal or author fields. `SharedBoardContent` writes board changes through a Liveblocks mutation.

The accepted [merge rules](decisions.md#merge-rules) require an editable preview, unchanged originals, source snapshots, and a staleness check before keeping a proposal. The [merge research](effective-idea-merging-research.md) also recommends showing the bridge between the sources and letting a person reject a weak combination.

## User flow

1. In Select mode, click a note, then Shift-click a second note. On touch, use **Add to merge** in the selected note bar, then tap the second note. Show a numbered `1` and `2` on the selected cards and a compact tray with their titles. A normal click on a different note starts a new selection. **Clear** and Escape remove both selections. Connection mode and note editing keep their current behavior.
2. Show **Merge ideas** in the tray only when two different saved notes have nonempty text. Keep it disabled during a request. The tray explains why a draft or empty note is ineligible. Never expose a bulk **Delete** action for a two-note selection.
3. Clicking **Merge ideas** sends the current board goal, both note IDs and text, and any existing typed relationship between them to `POST /api/merge`. The tray becomes a progress state. Selection and both notes remain available if the request fails. A second click cannot create a second request.
4. Show the returned proposal in a side panel, with both source cards visible on the canvas. The panel contains editable title and concept fields, a read-only explanation of what A contributes, what B contributes, the causal bridge, tension, assumptions, and next experiment. Provide **Regenerate**, **Create merged idea**, and **Discard**. A weak pair shows a clear reason or question, with **Regenerate** and **Discard**, rather than a confident concept.
5. **Create merged idea** adds exactly one child note. Keep the original source notes and their current positions. Put the child below the sources where space exists, draw two curved ancestry lines into it, focus the new note, and show a short **How this idea was made** action on its card. That action opens the source snapshots and explanation even after source notes are edited or deleted.

The first click generates a preview; **Create merged idea** commits it. This matches the project's accepted preview rule and lets a participant edit or reject Gemini's wording before it becomes board content.

## Canvas design

Use the existing card shape and color system. While a pair is selected, give the two source cards a warm seed tint and numbered badges. Give the kept child a restrained green concept tint and a `COMBINED CONCEPT` label. Use two thin green curved lines from the source cards' lower handles to the child's upper handles, with no relationship label or arrow. These lines mean ancestry; the existing `Works well together`, `Conflicts with`, and `Extends` edges continue to mean user-defined relationships.

Position the child near the horizontal midpoint of its parents, at least one card height and a gap below the lower parent. Search a small deterministic grid around that point for a free rectangle, using measured card bounds when available and `IDEA_CARD_SIZE` as the fallback. Never move pinned cards or rerun Organize for a merge. If the sources are far apart, still place the child near their midpoint and offer **Show merged idea** or fit the three cards into view. Pause local Physics before placement so it does not scatter the three-card shape. Allow the child to be dragged afterward; ancestry lines follow its position.

Keep the preview panel anchored on desktop so the source cards remain visible. Use a full-height sheet on narrow screens with source titles at its top. Avoid a modal that hides the pair. Provide visible keyboard focus, descriptive button labels, live progress and error text, and reduced-motion behavior. Keep enough contrast in both themes; color alone must not identify a merged note.

## Data and API contract

Extend the board model in `src/features/board/model.ts` with a persisted board `goal` and optional author metadata. Add merge metadata to a kept `Idea`: two ordered parent IDs; each parent's title, content, author, and ID as captured at generation; the goal and any typed relationship used; the generated proposal; the final edited title and concept; actual Gemini model; and generation time. Keep legacy `parentIds` readable for existing boards, and write a single canonical ancestry record for new merges. Preserve the snapshots when a source is edited or deleted. Render ancestry edges from that record rather than saving them as ordinary `Relationship` objects.

Make the board goal editable where the participant can see it, with a usable default for existing local and shared boards. Do not silently use the board title as the goal. Extend `src/lib/liveblocks.ts` and `src/features/board/shared-board.tsx` so the goal and merge metadata survive reload and synchronize. Add a migration/default path for older rooms that have neither field. Use the current guest display name for authorship where it is available; if authorship is not yet stored, show `Unknown contributor` instead of inventing a name.

Extend `src/lib/ideas.ts` and `src/app/api/merge/route.ts` to accept an optional `{ type, explanation }` relationship and return a structured outcome. A usable outcome includes a concise title and concept, both distinct contributions, a concrete bridge that explains why the parts work together, tension, assumptions, and one small experiment. A `needs_clarification` or `no_useful_merge` outcome includes a short reason or question and cannot be kept. In the Gemini instruction, treat the goal, notes, and relationship text as data; require one mechanism rather than a list of features; handle a conflict by stating the condition that resolves it; and avoid unsupported claims. Validate all inputs and outputs with Zod. Keep the provider key and Gemini call on the server. Update the shared AI helper to expose the model actually used when fallback occurs, then return that model and a generation timestamp with the proposal.

Map each source's `title` and `content` into one bounded text field for the route. Reject two identical IDs, blank notes, and notes over the route's 4,000-character limit before calling Gemini. Use the existing route timeout and safe error messages. Send only the selected pair, board goal, and their relevant relationship; board-wide note text is unnecessary for this merge.

## State and concurrency

Keep pair selection, pending request, preview edits, and errors in browser state. Capture a fingerprint of both source IDs, titles, contents, the goal, and the relationship when generating. If any captured value changes before the response arrives or before **Create merged idea**, mark the preview stale and require regeneration. A change to positions alone does not invalidate the proposal. Deleting a source closes the preview with an explanation.

Commit the child through one functional board update or one Liveblocks mutation after rechecking the captured values against the latest board. Allocate its ID once; guard the commit against duplicate clicks. Clear the pair selection after success and focus the child. In a grouped board, leave existing group positions untouched, add the child outside current assignments, and mark the cluster snapshot stale. The existing **Place new notes in an existing group** preference applies to manually added notes only; it must not move a merged child away from its visible ancestry layout.

## Implementation order

1. Add the board goal, merge metadata schema, legacy-room defaults, and a helper that creates a child without touching either source. Keep ancestry edges separate from typed relationships.
2. Extend the merge request/result schemas and Gemini instruction, including relationship context, bridge, assumptions, weak-pair outcome, and actual-model metadata.
3. Replace the single-note-only selection logic with a two-note pair in `board-app.tsx`. Add the tray and accessible touch selection path without breaking edit, delete, connect, drag, or Escape behavior.
4. Add the request and editable preview panel. Recheck source and goal fingerprints on response and at commit. Keep errors and regeneration in the panel.
5. Add child placement, concept styling, ancestry curves, and **How this idea was made**. Preserve the current Organize groups and pause local Physics for placement.
6. Connect local and Liveblocks persistence, then update the relevant work tracker and roadmap entries after the feature is verified.

## Acceptance checks

- Two distinct saved notes enable **Merge ideas** with mouse, keyboard, and touch; one note, an empty note, or a relationship selection does not.
- The request includes the board goal and any typed link between the pair. A valid Gemini response produces an editable preview. A weak or failed response creates no note.
- **Create merged idea** adds one child with two visible curved ancestry lines. The originals keep their text and positions. The child records source snapshots and the actual model used.
- Editing or deleting a source after generation prevents an outdated preview from being kept. Editing a source after a successful merge does not alter the stored snapshot.
- A new child can be moved, edited, and merged again. Existing user relationship links and Organize positions still behave as before.
- Local reload behavior matches the current local board contract. In a shared board, a second browser sees the child and ancestry, and reload restores both without duplicate children.
- Narrow-screen layout, both themes, keyboard focus, reduced motion, provider errors, and repeated clicks are handled visibly.

When implementing code, run the repository lint, typecheck, and build checks required by `AGENTS.md`. Verify a real Gemini call and a two-browser Liveblocks merge when credentials are available, and state which live checks could not run.
