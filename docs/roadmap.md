# Roadmap

## Current status

Done:

- Local canvas with example notes, editing, dragging, multi-select, and a board goal
- Merge endpoint with Zod validation and Gemini structured output
- Proposal preview, keep/discard, editable merged notes, parent edges, and source snapshots
- Shared boards with guest authorization, note and goal sync, and a collaborator count

Verified:

- Lint, typecheck, and production build pass
- A Chromium smoke test covers selection, missing-key feedback, accepting a merge (using a mocked response), ancestry, editing, adding notes, and mobile width
- A live Gemini merge returned a valid proposal
- Liveblocks authorization returned a token and a secure guest cookie

Not yet verified: two browsers syncing the same board.

Known gaps: undo, deletion, local persistence, cursor avatars, editing or regenerating a proposal before keeping it, and a policy for two people typing in one note. To regenerate today, discard the proposal and merge again.

## Plan

Days are counted from the team's start.

| Days | Focus | Done when |
| --- | --- | --- |
| 1–2 | Canvas and shared rooms | Two browsers can create, edit, move, and see the same notes, and accepted notes survive a reconnect |
| 3–4 | Merge quality and controls | Both inputs shape each result, edit/regenerate/discard/accept are clear, and repeated merges keep ancestry |
| 5 | Reliability | Undo, simultaneous editing, failures, timeouts, and AI usage limits are handled |
| 6–7 | Usability, evidence, demo | A student team completes a session, the build passes, and the README and demo explain the problem and outcome |

## Next work

In priority order:

1. Verify two-browser collaboration and compare Gemini models.
2. Test editing, selection, repeated merges, dragging, and reconnection in a browser.
3. Place new notes and merged children so they stay visible at any pan and zoom.
4. Add local persistence, shared undo, deletion, and a simultaneous-edit policy.
5. Add proposal editing and a regenerate button. Store the goal, model, and timestamp with source snapshots.
6. Consider per-user AI limits.
7. Polish keyboard and mobile use. Leave deferred features out until the items above are done.

## Merge-quality evaluation

Try at least ten pairs: complementary, unrelated, duplicate, contradictory, and vague notes, plus mixed Vietnamese and English. For each result, check that:

- A meaningful part of each source is still visible.
- The concept describes a concrete mechanism instead of restating the notes.
- It serves the board goal.
- It admits tensions or a forced connection.
- The suggested experiment is something the team could actually run.

Compare a few results against a plain "combine these notes" prompt to see whether the goal and structured explanation help. Don't claim measured impact without evidence.

## Demo script

Two collaborators add different observations about student study habits. Select both, merge, walk through each note's contribution, and keep the concept. Add a third insight and merge again. Show the ancestry and preserved sources, and end with the suggested experiment.
