---
id: "WORK-013"
title: "Card deletion"
status: "To Do"
priority: "Medium"
type: "Feature"
milestone: "day-3"
depends_on: ["WORK-004"]
impact: "Removes cards and their links from board storage."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-05"
---

## Summary

Owner: SE2. People can remove cards without breaking links or merge ancestry.

## Acceptance Criteria

- [ ] You can delete a card on the local and shared boards after confirming, and the deletion syncs.
- [ ] Deleting a card removes the relationship links attached to it.
- [ ] A merged card whose parent was deleted keeps its source snapshot and shows the parent as deleted instead of a broken edge.
