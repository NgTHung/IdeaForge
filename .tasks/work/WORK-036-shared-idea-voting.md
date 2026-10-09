---
id: "WORK-036"
title: "Shared idea voting"
status: "In Progress"
priority: "Medium"
type: "Feature"
impact: "Adds persistent participant votes to shared board storage and a voting dropdown beside the active members control."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-09"
---

## Summary

Participants need a quick way to rank ideas together. Add one upvote or downvote per participant and idea, with a score shown in a dropdown in the shared board header.

## Acceptance Criteria

- [ ] The shared board header has a voting dropdown immediately before the active members control.
- [ ] The dropdown lists each idea title, upvote and downvote controls, and the current score.
- [ ] Each participant can set, change, or remove one vote on each idea.
- [ ] Votes sync between participants and survive reloads without changing idea content or merge source snapshots.
- [ ] Voting controls follow the board's write access.
