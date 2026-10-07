---
id: "WORK-021"
title: "Board assistant (stretch)"
status: "In Progress"
priority: "Low"
type: "Epic"
depends_on: ["WORK-008", "WORK-010", "WORK-011"]
impact: "Adds the board assistant route, connects the chat sidebar, and lets accepted AI actions change the board."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-07"
---

## Summary

Stretch. A chat assistant that answers from the whole board, cites the cards it uses, and proposes create, edit, link, and merge actions as canvas previews. Work may start when its technical prerequisites are ready. The design is in docs/assistant.md; the child tasks are work:WORK-024 through work:WORK-028.

## Exit Criteria

- [ ] The assistant answers from the board's cards and goal and names the cards it refers to as citation chips that focus the card.
- [ ] It proposes create, edit, link, and merge actions as previews, and nothing changes until a person accepts one.
- [ ] Accepted actions go through the same mutations and staleness checks as manual actions.
- [ ] Ideas created with the assistant keep their source cards as parents with source snapshots.
- [ ] The assistant evaluation in docs/assistant.md has been run and its results are recorded in docs/roadmap.md.

## Implementation note — 2026-10-07

Assistant route integration and reviewable canvas actions are implemented in the current checkout, with the details and remaining gates in `docs/assistant-implementation-plan.md`. The user excluded the human evaluation tracked by WORK-028, so this epic stays In Progress and its evaluation exit criterion stays open.
