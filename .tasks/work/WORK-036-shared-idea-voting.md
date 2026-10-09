---
id: "WORK-036"
title: "Shared idea voting"
status: Done
priority: "Medium"
type: "Feature"
impact: "Adds persistent named upvotes to shared boards, idea cards, and the voting dropdown."
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-09
---

## Summary

Participants need a light way to show which ideas they like. Votes are a social signal and never select what the board concludes; WORK-038 covers the conclusion. Each participant can give an idea one removable upvote. Show the score on the idea card and in the header dropdown, and let people see who upvoted. Save voter display names so they remain visible after voters leave. Existing downvotes do not count.

## Acceptance Criteria

- [x] The shared board header has a voting dropdown immediately before the active members control.
- [x] The dropdown lists each idea title, an upvote control, the current score, and the people who upvoted.
- [x] Each idea card shows its upvote score and lets people see who upvoted, including voters who have left the board.
- [x] Each participant can add or remove one upvote on each idea. No downvote control remains, and existing downvotes do not affect scores.
- [x] Votes sync between participants and survive reloads without changing idea content or merge source snapshots.
- [x] Voting controls follow the board's write access.

## Verification

All 155 tests, lint, typecheck, and the production build passed. Unit tests cover independent toggles, legacy downvotes, distinct voter IDs, saved names, deleted ideas, unchanged merge snapshots, and vote-map updates. `npm run verify:idea-voting` passed against Liveblocks with two clients, including concurrent votes, reload persistence, and names after disconnect.

The production browser over Tailscale verified card and header toggles, scores and names, Escape focus restoration, dark mode, and disabled voting with a real read-only Liveblocks token. These HTTP checks seeded guest cookies because production cookies require HTTPS. HTTPS guest entry and Gemini calls were not retested. Mobile layout remains unverified after the collaborative browser disconnected during resizing.
