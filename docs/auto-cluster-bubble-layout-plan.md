# Incremental auto placement and bubble layout

> Superseded layout detail (2026-10-07): the reference sketch calls for spatially separated rectangular notes with group badges and pairwise similarity spacing. The visible bubble regions below are historical planning notes. See the latest Organize decision in `docs/decisions.md`.

This plan gives the add-note editor a switch that places a newly saved note into one existing group. Automatic placement moves only that new note. You still use **Organize canvas** to create groups, change their count, or rebuild the whole layout. The plan also replaces the current grid with labeled bubble regions whose note distribution and spacing reflect similarity.

## Current behavior and intended change

The current `src/features/board/board-app.tsx` creates a `New idea` placeholder before opening the editor. **Organize canvas** calls `POST /api/similarity/clusters`, assigns all eligible notes, and moves every unpinned note into a grid from `src/features/board/cluster-layout.ts`. Its group labels and result exist only in browser state. The response has note-to-representative scores but no score between groups.

Keep full clustering as an explicit action. Add an **Auto place new notes** switch to the add-note editor. The switch controls future notes created by this browser and defaults off; remember the choice for the next add-note dialog. It does not reassign edited notes, deleted notes, or existing group members. When the switch is on and you save a new meaningful note, assign that note to one existing group and move that note into free space near its most related group member. Existing note coordinates, group identities, and group centers remain fixed. Turning the switch off means the next new note stays where you placed it. The switch is a creation preference, not a shared board setting.

This changes the current on-demand Organize decision in `docs/decisions.md`. Record the accepted behavior there when implementation begins. Preserve the current uncommitted work in the `main` working tree.

## Add-note experience

Show the switch beside the new note's title and content fields, with the explanation **Place this and future new notes into an existing group**. Keep the full group-count control in the Organize panel. The switch is disabled when the board has no current groups; show **Organize the canvas first to create groups**. Turning it on never runs a full clustering request. When you save a new note, save its text immediately, show **Finding a group…**, and place only that note after the assignment returns. If you cancel the editor or leave the placeholder empty, make no assignment request. A keyboard-operable checkbox and an announced status message cover the same flow without a pointer.

The current creation path stores a placeholder before Save. Either defer board insertion until Save or track the draft ID so a canceled or empty placeholder never triggers auto placement. If the note is pinned when saved, keep its position and add only a group badge. If the new note is dragged while its request is pending, keep the user's position and cancel the automatic move. A failed request leaves the new note where it is, shows the safe API error, and offers **Retry placement** for that note. The other groups remain usable.

When you press **Organize canvas**, the existing full clustering endpoint may change all unpinned positions and all memberships. That is the only action that changes the group count or moves existing notes as a group. Keep its current Undo behavior. Automatic placement should offer **Undo placement** only for the new note, as long as that note has not been moved or edited since the placement.

## Incremental assignment API

Add `POST /api/similarity/clusters/assign` with a shared Zod request and response contract. Send the new note, the current eligible members of each existing group, and a revision or fingerprint of the group snapshot. Reject duplicate or unknown IDs, empty groups, an already assigned new note, and the existing 50-note or 4,000-character limit violations. The route uses the existing `calculateSimilarity` path once for the new note and group members, then calculates the mean score from the new note to every member in each group. Choose the group with the highest mean; break equal scores by stable group ID. This keeps the current group membership intact and avoids a second clustering run.

Return the chosen `clusterId`, each group's mean similarity, the closest member within the chosen group, the chosen score, `scoreMethod`, and `embeddingModel`. These values let the UI explain why the note joined that group. Do not label the score as confidence or probability. The existing small-board rank scores and larger-board centered cosine scores are relative to the submitted board. If the board crosses the method threshold after adding a note, show the method used for this assignment; do not rewrite the older groups' displayed scores until a manual Organize.

The browser must validate the response and confirm that the chosen ID belongs to the submitted snapshot. Give the request a sequence number and an `AbortController`. Before committing, check the new note's current text and drag state and the current group revision. A stale result writes no position or membership. For a shared board, perform this check inside the same Liveblocks mutation that writes the new note's position and membership. Trigger the request only from the participant who saved the new note, never from a generic board-change effect, so position sync does not start another request.

## Bubble layout for manual Organize

Extend `POST /api/similarity/clusters` with one `groupPairs` entry per unordered pair of groups: group IDs and the mean similarity across all cross-group note pairs. Compute it from the score table already used by `src/lib/cluster-algorithm.ts`; do not call Gemini again. Add validation for complete unique pairs and finite scores in `src/lib/cluster-contract.ts`.

Replace the grid function in `src/features/board/cluster-layout.ts` with a deterministic two-stage layout. Within each group, place its representative near the center. Put other notes on preferred rings using `similarityToRepresentative`: stronger matches prefer inner rings. Use `closestMember` to prefer nearby angles for closely related notes. Separate the measured rectangular cards with a fixed collision pass, expanding rings where needed. Draw a soft circular or rounded region around the final card bounds, with a visible label and count. A one-note group gets a small labeled region.

Place the group regions using `groupPairs`. Normalize the observed pair scores within the current result. More similar groups receive a shorter target clear gap; less similar groups receive a longer one. Give collision separation priority over those target gaps, and cap the maximum gap so the board remains usable. A fixed number of deterministic placement iterations keeps repeated results stable. Save each resulting group center as its anchor for later single-note placement. Canvas distance is an approximate cue: pairwise similarity cannot generally be represented exactly in two dimensions. Show **Nearby groups have more similar notes** as a short legend, with the score method available in group details.

Draw regions behind cards with translucent fills, outlines, group labels, and matching note badges. Keep regions without pointer events so dragging and selecting cards still work. Preserve existing relationship edges. Respect dark mode, keyboard focus, narrow screens, and reduced motion. Keep pinned and excluded notes fixed; a distant pinned member keeps its badge outside the region rather than stretching the region across the board. Pause local Physics after a full Organize and after an automatic placement so it cannot undo the layout.

## Place one new note without moving groups

Add a pure `placeNewNote` function. It receives the chosen group, the returned score details, the latest card sizes and positions, the group's saved anchor, and all fixed obstacles. Search deterministic candidate slots around the chosen group's closest member. Prefer a free slot inside the bubble, then adjacent slots near its rim. Use the new note's relative similarity to prefer an inner or outer slot, but never overlap another card or bubble. Return only the new note's position plus an expanded radius for its chosen bubble. Keep that bubble's center at its saved anchor. Do not return positions for any other note or change another group's geometry.

If no candidate can fit without a collision, keep the note at its saved position and show **No free space near this group. Use Organize canvas to rebuild the layout.** Its membership can still appear as a badge, but do not claim the note sits inside the bubble. This exceptional path keeps the promise that automatic placement never moves old notes. Do not auto-fit or reset pan and zoom; reveal the new note only if it would otherwise be offscreen.

## Persist group membership

Incremental placement needs a stable existing group snapshot. Store a compact snapshot with group IDs, member IDs, representative IDs, anchor centers, score method, group-pair scores from the last full Organize, and a revision tied to the assigned members' IDs and text. Save it in the board model and `src/features/board/shared-board.tsx` when manual Organize succeeds. A newly saved unassigned note does not invalidate that revision. Append its assignment and update the revision in the same mutation as its placement. Rebuild bubble radii from saved positions, anchors, and membership after reload; never store embedding vectors. Group-pair scores describe the last full Organize and are marked as such until the next full run. Older shared rooms without a snapshot have no groups until someone uses **Organize canvas**. Local boards still reset on refresh as described in the README.

Update board model helpers to preserve the new snapshot field, including `deleteIdea`, which currently constructs a new object from only ideas and relationships. Editing or deleting an existing member makes the affected snapshot out of date. Keep its visible group badge with a stale indicator and ask for manual Organize; do not silently regroup other notes. A new note saved with auto placement off remains ungrouped and must be handled by the next manual Organize. If a shared board changes during assignment, reject the stale result and offer Retry placement from the current snapshot.

## Implementation order

1. Define and validate the compact group snapshot and incremental assignment request and response. Add the assignment route using existing similarity calculation and stable tie-breaking.
2. Add `groupPairs` to the full clustering response. Replace the grid with pure bubble packing and score-based group placement.
3. Add pure `placeNewNote` search that returns only the new note position and chosen bubble geometry. Keep every other coordinate fixed.
4. Render bubble backgrounds, group labels, badges, score details, and stale or ungrouped states in the canvas.
5. Add the creation preference in the add-note editor. Trigger assignment only after saving a new meaningful note; handle cancellation, retry, drag, and Undo placement.
6. Persist group snapshots through the local board model and shared Liveblocks adapter. Guard shared commits against stale snapshots and update the README, decisions, roadmap, and `WORK-012` follow-up.

## Acceptance checks

- Use **Organize canvas** once to create groups. Turn on **Auto place new notes**, save another note, and confirm exactly one note moves into one existing group. Every older note, group center, and other bubble stays at the same coordinate.
- Turn the switch off, add a note, and confirm that note stays at its placed coordinate with no assignment call. Editing or deleting a note also makes no automatic assignment call.
- The selected group has the highest mean new-note-to-member score in the API response. Equal scores use a stable group ID tie-break. The UI shows the actual score method without calling it confidence.
- The new note does not overlap a card or another bubble. If no slot fits, the note stays put and the UI explains how to rebuild the layout. Pinned and excluded notes never move.
- A failed or stale request, a drag during a request, and two participants saving new notes at nearly the same time cannot move an existing note or overwrite a newer group snapshot.
- Manual Organize still groups all eligible notes into the chosen count, produces labeled similarity-based bubbles, preserves existing links, pauses Physics, and supports Undo layout.
- Reload a shared board and confirm its group membership and bubble labels remain visible. A second browser sees the new note's single position and membership update. Check local add-note flow, dark mode, narrow screens, keyboard use, and reduced motion. After implementation, run `npm run lint`, `npm run typecheck`, and `npm run build`, then inspect the flow in a browser.
