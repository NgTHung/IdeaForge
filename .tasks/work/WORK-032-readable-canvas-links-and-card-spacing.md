---
id: "WORK-032"
title: "Readable canvas links and card spacing"
status: "In Progress"
priority: "Medium"
type: "Feature"
milestone: "day-3"
depends_on: ["WORK-012"]
risk: "Medium"
impact: "Rewrites card positions on add, delete, merge, undo, and Organize; changes how every canvas link renders."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-07"
---

## Summary

PR #18 added an orthogonal link router, a shared card-overlap resolver, a Merge tool, and simpler suggested-link review, but its commit held unresolved stash conflicts on an outdated base. Rebuild that work on main and fix three defects found in review: opening a shared board wrote a stale board snapshot back to Liveblocks, the overlap resolver could move pinned cards, and Physics ran a full grid search on every animation frame.

## Acceptance Criteria

- [ ] Relationship and ancestry links share one orthogonal router that avoids card bounds and draws a curve when no orthogonal route fits.
- [ ] Organize, add, delete, merge, undo, and Physics keep cards 48px apart and never move a pinned card.
- [ ] Opening a shared board resolves overlaps against the current Liveblocks board, so a concurrent edit is kept.
- [ ] Physics runs the overlap resolver only on frames where two cards are too close.
- [ ] Suggested links start minimized with automatic checks off, manual refresh works while they are off, and a label can be accepted without an explanation; a conflict still needs a condition.
- [ ] The Merge tool selects two ideas with successive clicks.
- [ ] Tests cover the overlap resolver; tests, lint, typecheck, and build pass; decisions and roadmap record the change.
- [ ] Verify dense-board routing and shared-board layout sync in two browsers.
