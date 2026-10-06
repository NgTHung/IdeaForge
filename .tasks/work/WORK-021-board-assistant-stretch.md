---
id: "WORK-021"
title: "Board assistant (stretch)"
status: "To Do"
priority: "Low"
type: "Epic"
depends_on: ["WORK-008", "WORK-010", "WORK-011", "milestones:MILESTONE-003"]
impact: "Adds a Gemini chat route, connects the chat sidebar, and lets accepted AI actions change the board."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-06"
---

## Summary

Stretch. Start only after milestones:MILESTONE-003 is done. A chat assistant that answers from the whole board, cites the cards it uses, and proposes create, edit, link, and merge actions as canvas previews. The design is in docs/assistant.md; the child tasks are work:WORK-024 through work:WORK-028.

## Exit Criteria

- [ ] The assistant answers from the board's cards and goal and names the cards it refers to as citation chips that focus the card.
- [ ] It proposes create, edit, link, and merge actions as previews, and nothing changes until a person accepts one.
- [ ] Accepted actions go through the same mutations and staleness checks as manual actions.
- [ ] Ideas created with the assistant keep their source cards as parents with source snapshots.
- [ ] The assistant evaluation in docs/assistant.md has been run and its results are recorded in docs/roadmap.md.
