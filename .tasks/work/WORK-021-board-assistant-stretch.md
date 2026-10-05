---
id: "WORK-021"
title: "Board assistant (stretch)"
status: "To Do"
priority: "Low"
type: "Feature"
depends_on: ["WORK-008", "WORK-010", "WORK-011"]
tags: ["enhancement", "needs-triage"]
last_updated: "2026-10-05"
---

## Summary

Stretch. Start only after milestones:MILESTONE-003 is done. A chat assistant that proposes create, edit, link, and merge actions as previews. A board this size fits in one prompt, so it uses the whole board as context and needs no retrieval.

## Acceptance Criteria

- [ ] The assistant answers from the board's cards and goal and names the cards it refers to.
- [ ] It proposes create, edit, link, and merge actions as previews, and nothing changes until a person accepts one.
- [ ] Accepted actions go through the same mutations and staleness checks as manual actions.
