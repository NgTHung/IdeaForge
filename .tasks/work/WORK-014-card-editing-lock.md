---
id: "WORK-014"
title: "Card editing lock"
status: "To Do"
priority: "Medium"
type: "Feature"
milestone: "day-3"
depends_on: ["WORK-003"]
impact: "Adds the edited card to Liveblocks presence."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-05"
---

## Summary

Owner: SE2. A text edit replaces a card's whole text, so two people typing in one card overwrite each other. While someone edits a card, the board shows who it is and keeps others from typing in it.

## Acceptance Criteria

- [ ] While someone edits a card, other browsers show that person's display name on the card and can't type in it.
- [ ] The lock ends when the editor leaves the card or disconnects.
- [ ] Moving, linking, and merging a locked card still work.
