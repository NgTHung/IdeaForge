---
id: "WORK-036"
title: "Shared idea voting"
status: "In Progress"
priority: "Medium"
type: "Feature"
impact: "Adds persistent named upvotes to shared boards, idea cards, and the voting dropdown."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-09"
---

## Summary

Participants need a light way to show which ideas they like. Votes are a social signal and never select what the board concludes; WORK-038 covers the conclusion. Each participant can give an idea one removable upvote. Show the score on the idea card and in the header dropdown, and let people see who upvoted. Save voter display names so they remain visible after voters leave. Existing downvotes do not count.

## Acceptance Criteria

- [ ] The shared board header has a voting dropdown immediately before the active members control.
- [ ] The dropdown lists each idea title, an upvote control, the current score, and the people who upvoted.
- [ ] Each idea card shows its upvote score and lets people see who upvoted, including voters who have left the board.
- [ ] Each participant can add or remove one upvote on each idea. No downvote control remains, and existing downvotes do not affect scores.
- [ ] Votes sync between participants and survive reloads without changing idea content or merge source snapshots.
- [ ] Voting controls follow the board's write access.
