---
id: "WORK-018"
title: "Run the release checks"
status: "To Do"
priority: "High"
type: "TestDebt"
milestone: "day-4"
depends_on: ["WORK-002", "WORK-009", "WORK-010", "WORK-012", "WORK-013", "WORK-014"]
tags: ["enhancement", "ready-for-human"]
last_updated: "2026-10-05"
---

## Summary

Owner: SE2. Run the release checks in docs/roadmap.md on the deployed app with four people before the feature freeze.

## Acceptance Criteria

- [ ] Four people contribute to the same board at once.
- [ ] Reloading restores saved work, and reconnecting shows the current board.
- [ ] Two people editing at the same time don't silently erase each other's changes.
- [ ] Accepted AI links reference cards that exist.
- [ ] A proposal generated from old card text can't overwrite newer work.
- [ ] Merging keeps the originals and their ancestry.
- [ ] Manual work stays usable when an AI request fails.
- [ ] Organize settles and leaves pinned cards in place.
- [ ] The full journey works on unfamiliar notes, not only the rehearsed board.
