---
id: "WORK-038"
title: "Conclude the board from selected ideas and clusters"
status: In Progress
priority: "High"
type: "Feature"
impact: "Adds a conclusion route through the shared AI module, an editable conclusion preview, and one stored conclusion per board."
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-09
---

## Summary

After a brainstorm, the team needs a way to wrap up the board. Participants select the ideas and clusters that matter, the AI drafts a conclusion from them, and the team edits and keeps it. It replaces the concept brief from WORK-015: selecting one merged note gives a brief of that concept. Votes from WORK-036 stay a social signal and don't make the selection. See Votes and board conclusion in docs/decisions.md.

## Acceptance Criteria

- [x] A participant with write access can select any mix of ideas, including merged notes, and clusters from the current Organize result. Upvote counts appear beside ideas as context only.
- [x] **Generate conclusion** sends the board goal and the selected content to a route that calls the generation model through the shared AI module and validates the structured output. A selected cluster sends its name and its notes. The request also sends the typed links between selected notes, with their direction, explanations, and conflict conditions.
- [x] A selected merged note sends its stored merge record with its text: the bridge, tension, assumptions, next experiment, and parent source snapshots. A conclusion of one merged note then lists that note's assumptions and next experiment, as the deferred concept brief did.
- [x] The draft covers the main themes, the key ideas with their authors, open questions, and next steps. It uses only the selected board content.
- [x] Each theme, key idea, and open question cites the card IDs it draws on. The route rejects a cited ID that wasn't in the request and, through the shared AI module's repair step, asks the model once for a corrected reply.
- [x] When the selection contains a "conflicts with" link, the draft addresses the stated condition or lists it as an open question.
- [x] The draft is a preview. People can edit it or regenerate it, and only **Keep** saves it. A draft can't be kept if a selected note changed after generation.
- [x] Each board has one conclusion. Keeping a new one replaces the old one after the person confirms.
- [x] The kept conclusion stores the edited text, the original generated draft, a snapshot of each selected idea and cluster as used, and who kept it and when. Running Organize again or editing a note doesn't change the snapshot.
- [x] The conclusion syncs between participants and survives reloads. Read-only participants can read it but can't generate, edit, or replace it.
- [x] Concluding doesn't change idea text, merge source snapshots, clusters, or votes.
- [x] A failed AI request shows its cause and leaves the current conclusion unchanged.
- [ ] Any participant, including read-only ones, can copy the kept conclusion as Markdown or download it as a `.md` file. The export includes the board title and goal, the conclusion text, each selected idea and cluster with its authors, and who kept it and when.

## Rationale

On 2026-10-09 the team decided that votes stay social and that the board's conclusion is a separate feature. A conclusion covers only what the team selects, so it differs from the deferred zoom-out summaries.

## Verification

On 2026-10-09, `npm test` passed all 167 tests, and `npm run lint`, `npm run typecheck`, and `npm run build` passed. `tests/conclusion.test.mjs` covers cluster and idea selection, merge records, the stale-draft fingerprint, request limits, citation and conflict checks, Markdown, export, snapshot independence, and the route's repair and failure paths with a mocked provider.

`npm run verify:board-conclusion` passed against live Liveblocks, covering an older room, a second client, a read-only client whose write was rejected, whole replacement, reload, and unchanged ideas and votes. `scripts/probe-board-conclusion.mjs` ran the route 10 times against `zai-org/GLM-5.3-Flash` with no failures or repairs; two of eight multi-cluster drafts misplaced a timing detail, and one wrote a card ID in prose.

A browser session on the dev server covered selection with upvote counts, a live draft, editing, keeping, reload, replacement, a simulated provider failure, the `.md` download, and dark mode. Copying needs a secure context, so the copy criterion stays open until it is checked over HTTPS. The stale-draft block, read-only controls, and two-browser sync were verified in tests and the Liveblocks script but not in a browser.

