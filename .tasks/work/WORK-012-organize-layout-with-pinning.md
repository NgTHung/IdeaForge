---
id: "WORK-012"
title: "Organize layout with pinning"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "day-3"
depends_on: ["WORK-005"]
risk: "High"
impact: "Rewrites every unpinned card position on a shared board."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-05"
---

## Summary

Owner: SE1 with AI1. Organize lays out the board once from similarity, and cards don't move otherwise. See Organize in docs/decisions.md. Check the results of work:WORK-006 first if they're available.

## Acceptance Criteria

- [ ] Clicking **Organize** fetches similarity for the board's cards and runs a d3-force layout to completion in the clicking browser.
- [ ] More similar cards end up closer together, and cards don't overlap after the layout.
- [ ] All new positions are written in one Liveblocks batch, and other browsers animate to them.
- [ ] Pinned cards keep their positions, and pin state is visible on the card and syncs.
- [ ] No card moves except through Organize or dragging.
- [ ] Organize on a 50-card board finishes without freezing the page.
