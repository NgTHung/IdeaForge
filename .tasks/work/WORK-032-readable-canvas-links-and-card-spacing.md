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

PR #18 added an orthogonal link router, a shared card-overlap resolver, a Merge tool, and simpler suggested-link review, but its commit held unresolved stash conflicts on an outdated base. Rebuild that work on main and fix three defects found in review: opening a shared board wrote a stale board snapshot back to Liveblocks, the overlap resolver could move pinned cards, and the resolver rebuilt a 2,401-point search grid for every overlapping card on each Physics frame.

## Acceptance Criteria

- [x] Relationship and ancestry links share one orthogonal router that avoids card bounds and draws a curve when no orthogonal route fits.
- [x] Organize, add, delete, merge, undo, and Physics keep cards 48px apart and never move a pinned card.
- [x] Opening a shared board resolves overlaps against the current Liveblocks board, so a concurrent edit is kept.
- [x] The overlap resolver reuses one precomputed search grid, so 50 stacked cards resolve in about 2 ms instead of 9 ms, with the same positions.
- [x] Link labels are placed within their own segment, so a clear link keeps a visible label.
- [ ] Suggested links start minimized with automatic checks off, manual refresh works while they are off, and a label can be accepted without an explanation; a conflict still needs a condition.
- [x] The Merge tool selects two ideas with successive clicks.
- [x] Tests cover the overlap resolver; tests, lint, typecheck, and build pass; decisions and roadmap record the change.
- [ ] Verify dense-board routing and shared-board layout sync in two browsers.

## Verification

On 2026-10-07, 92 repository tests, lint, typecheck, and the production build passed. New tests cover overlap clearance, pinned and fixed cards, the unchanged board returned when nothing overlaps, and label placement on a clear link. The pinned-card and label tests failed before their fixes. Over 300 random boards, the faster resolver picked the same positions as the PR version.

A headless Chromium run against the production build used a new Liveblocks room with two guests. It confirmed orthogonal link paths, at least 48px between cards, two-idea selection with the Merge tool, and **Only this node's edges** hiding unrelated links. A card added by one guest appeared for the other, and reloading the second tab kept all six cards in both tabs. The Express auth API was not running, so its session request failed; that request is outside this change.

The suggested-links criterion stays open because manual refresh with live Jev was not exercised; unit tests cover acceptance without an explanation and the conflict condition. Canvas previews render only while **Automatic** is on, so a manual refresh with it off fills the panel but not the canvas. The team should decide whether that is intended. Dense-board routing, Organize and merge spacing in a browser, and the race between opening a shared board and another participant's edit remain unverified.
