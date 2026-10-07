# Cluster and organize the board

This plan adds a user chosen group count to IdeaForge's canvas. It uses the embedding similarity already on `main`, returns each idea's group and score details, and places the idea cards into visible groups when you click `Organize`. The first acceptance target is the local board after `npm run dev`. The same canvas component also serves shared boards, so the layout path should support them without a second implementation.

Plan based on `main` at commit `1d8fd83` on 6 October 2026. This document describes work to implement; it does not claim the feature already works.

## Current starting point

`src/lib/similarity.ts` embeds 2 to 50 nonempty cards, caches vectors, and returns one symmetric score for every pair. It uses nearest-neighbor rank on small boards and mean-centered cosine on larger boards. `src/app/api/similarity/route.ts` exposes those scores and maps Gemini failures to safe API errors. Reuse that path so clustering uses the same score definition and does not call Gemini twice.

`src/features/board/board-app.tsx` lets you add and edit cards, pin cards, drag them, and fit the view. It uses `src/features/board/model.ts` for card data and a single `setBoard` path for local and shared boards. Physics runs on local boards and stays off for shared boards. The accepted product decision in `docs/decisions.md` calls for an on-demand `Organize` action, fixed pinned cards, and one position update. The implementation must pause Physics before applying cluster positions so the cards stay grouped.

There is no clustering API or working `Organize` control on `main`. Add this feature on `main` without depending on another branch or a Python service.

## User journey

You add at least two meaningful idea cards and choose `Organize` from the board toolbar. A small panel shows how many cards can be grouped and lets you select a whole number from 2 to the smaller of 10 and that count. The default is 2 groups for up to 5 eligible cards and 3 groups for larger boards. You can close the panel without moving anything.

When you confirm, the button shows `Grouping…` and remains disabled until the request finishes. A successful response moves unpinned cards into separated group regions, adds a header with each group number and card count, and fits the groups into view. Pinned cards keep their coordinates. A brief status message says how many cards were grouped. An `Undo layout` action restores the positions from immediately before this operation.

You can still drag any unpinned card, edit a card, add a card, and use the existing relationship links. A group means “close under the selected similarity method.” It does not assert that cards agree, should be linked, or should be merged. Adding, editing, or deleting card text marks the displayed grouping as out of date and offers `Organize again`. It does not move the board automatically.

The local canvas should need only `npm run dev` plus the existing server-side `GEMINI_API_KEY`. If that key is missing, the canvas still permits manual work and shows the existing missing-key error when you request grouping.

## API contract

Add `POST /api/similarity/clusters` as a Next.js route. Put the request and response schemas in a module safe for both server and client imports, such as `src/lib/cluster-contract.ts`. Keep the clustering calculation in a server-only module, such as `src/lib/clustering.ts`. The route validates input, calls the calculation once, and uses `aiErrorResponse` for Gemini errors.

The browser sends only eligible cards and the chosen group count:

~~~json
{
  "cards": [
    { "id": "idea-a", "text": "Study partners\nMatch students by topic and availability." },
    { "id": "idea-b", "text": "Daily challenges\nGive each study group a small daily task." }
  ],
  "clusterCount": 2
}
~~~

For a board card, derive the text from its title and content in one shared formatter. Exclude an unfinished default `New idea` card with empty content. Keep the existing 4,000-character similarity input limit: enforce a documented text budget when combining title and content, or raise that shared limit deliberately in both routes. Do not silently truncate content. Show the count of excluded empty cards in the panel. Reject a request with fewer than 2 or more than 50 eligible cards, duplicate IDs, a noninteger count, or a count outside `2..min(10, cards.length)` with HTTP 400.

Return group membership and small score summaries. Do not return embedding vectors or the full pairwise matrix:

~~~json
{
  "algorithm": "average_linkage",
  "scoreMethod": "mean_centered_cosine",
  "embeddingModel": "gemini-embedding-001",
  "clusterCount": 2,
  "noteCount": 4,
  "groups": [
    {
      "id": "group-1",
      "label": "Group 1",
      "noteIds": ["idea-a", "idea-b"],
      "size": 2,
      "representativeNoteId": "idea-a",
      "meanPairSimilarity": 0.68
    }
  ],
  "assignments": [
    {
      "noteId": "idea-a",
      "clusterId": "group-1",
      "similarityToRepresentative": 1,
      "distanceToRepresentative": 0,
      "closestMember": { "noteId": "idea-b", "similarity": 0.68 },
      "closestOutside": { "noteId": "idea-c", "clusterId": "group-2", "similarity": 0.39 }
    }
  ]
}
~~~

The example omits the remaining group and assignments for readability; a real response includes every requested card exactly once. `group-N` IDs identify groups within that result only. They may change after a card edit or a new request.

Define each score precisely:

| Field | Meaning |
| --- | --- |
| `scoreMethod` | The method returned by the existing similarity calculation: `nearest_neighbor_rank` or `mean_centered_cosine`. |
| `similarityToRepresentative` | The existing pair score to the group's representative card. It is 1 for the representative itself. |
| `distanceToRepresentative` | `1 - similarityToRepresentative`. This is a score distance, not a geometric canvas distance or a probability. |
| `meanPairSimilarity` | Mean score over distinct pairs within the group. Return `null` for a one-card group. |
| `closestMember` | Highest-scoring other card in the same group, or `null` for a one-card group. |
| `closestOutside` | Highest-scoring card in another group. It is a discovery cue, not a link recommendation. |

Extend the similarity calculation to carry the actual embedding model used, including a fallback model, into this response. Keep that model provenance from the same embedding batch. Validate the output before returning it: every input ID appears once in `assignments` and one `groups[].noteIds` list; all group IDs exist; group sizes match; scores are finite and within the method's range. The UI should parse the response with the shared schema.

## Clustering calculation

Use deterministic average-linkage agglomerative clustering over the existing pair scores. Start with one cluster per card. At each step, merge the two clusters with the highest mean score across every cross-cluster card pair. Stop when the user-requested count remains. Sort input cards by ID and break equal-score ties by the sorted member IDs, so the same board and count produce the same result.

Choose each group's representative as the member with the highest mean similarity to the other members; break ties by ID. Number groups after sorting by representative ID. Compute the response summaries from the same score table. This avoids another model call, a Python process, and a second definition of similarity. For the 50-card limit, keep the algorithm in a pure function that can be checked on known score tables.

The small-board rank scores and large-board centered-cosine scores have different numeric meanings. Return `scoreMethod` and label scores accordingly in details. Do not display a universal “confidence” percentage. Similarity cannot determine whether two cards agree; leave typed relationships under human control.

## Canvas layout and state

Create a pure `layoutClusters` function under `src/features/board/`. It takes the current cards, group assignments, measured card sizes when available, and pinned flags. It returns positions for unpinned idea IDs and display positions for group headers. Use the existing `IDEA_CARD_SIZE` as the fallback size. Put groups in a compact grid with a fixed gap between group regions and enough gap between cards for their labels and edges. Sort members by similarity to the representative, then ID, so repeated runs have stable placement. Treat pinned cards as occupied rectangles and shift a group region to a free slot when it would overlap one.

Keep headers and group colors as presentation state. Do not add header nodes to `Board.ideas` or create relationship edges from clustering. Use a text label as well as color on each group, including in dark mode. A pinned card can remain outside its group's region; keep its group badge so its membership is still visible.

In `BoardApp`, pause Physics before applying the new positions. Store the prior positions for `Undo layout`, then commit all unpinned positions through one `setBoard(current => …)` update. The shared adapter already routes that update through one Liveblocks mutation. Fit the new positions after React Flow renders them. A later explicit Physics action should initialize its particles from the new coordinates before moving cards; otherwise the current `usePhysics` particle cache can pull them back to old locations. The simplest product path is to leave Physics off after `Organize` and let users enable it deliberately.

Keep a request ID and a fingerprint of the submitted card IDs, text, and pin states. If a card changes or a newer request starts while the endpoint runs, ignore the old result and show “The board changed; organize again.” In the shared path, check that fingerprint again inside the board mutation before moving cards. A failed or stale request must leave every position unchanged. When a user drags a card after grouping, invalidate `Undo layout` if restoring old positions would overwrite that manual move.

For a shared board, positions should persist through the existing Liveblocks board update. If group headers must also survive reload, store the cluster result with the board and invalidate it on card edits. For the first local milestone, keep group headers in browser state and state clearly that local boards reset on refresh.

## Work order

1. Add the shared card-text formatter and clustering request/response schema. Expose the actual embedding model from `src/lib/similarity.ts` without changing its cache policy.
2. Add the pure average-linkage calculation and `POST /api/similarity/clusters` route. Reuse `calculateSimilarity` and `aiErrorResponse`.
3. Add the pure layout function and a group header node or overlay. Preserve pinned positions and existing relationship edges.
4. Add `Organize` to the board toolbar with its group-count panel. Add progress, error, stale-result, result, and undo states.
5. Connect the layout commit through `BoardApp`'s existing `setBoard` path. Stop Physics first and synchronize particles before any later restart.
6. Update `README.md` with the local flow and update `docs/decisions.md` when this clustering and layout approach is accepted. Keep `docs/roadmap.md` and the task tracker aligned with the implemented state.

## Acceptance checks for implementation

- After `npm run dev`, you can add and edit notes, pick a valid group count, click `Organize`, and see exactly that many labeled groups. No extra service needs to be started.
- Every eligible idea appears in exactly one group. Empty unfinished cards remain on the canvas and are counted as excluded. A one-card group shows no within-group mean or neighbor.
- The response contains an assignment, representative similarity, defined score distance, and closest cross-group card for each eligible idea. The returned method and embedding model reflect the actual calculation.
- Pinned cards never move. Unpinned cards do not overlap in the grouped layout. Existing manual links and parent edges remain attached to their cards.
- Physics stays paused after organization. The layout remains stable until a person drags a card, clicks `Organize` again, or deliberately turns Physics back on.
- Invalid counts, duplicate IDs, missing Gemini configuration, provider failures, and a board edit during a request show clear errors without moving cards.
- `Undo layout` restores the prior positions before any later manual move. Shared-board position changes arrive together through one mutation; local behavior needs no account.
- Run the repo's required `npm run lint`, `npm run typecheck`, and `npm run build` after code changes. Check the pure clustering and layout calculations on fixed examples, then check the add-note-to-organize flow in a browser.
