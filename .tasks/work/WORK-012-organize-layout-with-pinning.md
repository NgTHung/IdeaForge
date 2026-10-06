---
id: "WORK-012"
title: "Organize layout with pinning"
status: "In Progress"
priority: "High"
type: "Feature"
milestone: "day-3"
depends_on: ["WORK-005"]
risk: "High"
impact: "Rewrites every unpinned card position on a shared board."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-07"
---

## Summary

Owner: SE1 with AI1. Organize lets a person choose a group count and lays out notes from the existing embedding similarity. The endpoint uses deterministic average linkage and returns group membership and score details. The add-note preference can assign only a new note into an existing group. See Organize in docs/decisions.md, docs/cluster-organize-plan.md, and docs/auto-cluster-bubble-layout-plan.md.

## Acceptance Criteria

- [x] Clicking **Organize** sends eligible note text and the selected group count to `POST /api/similarity/clusters`.
- [x] The server returns exactly the requested number of deterministic average-linkage groups, the actual embedding model, representative similarity and distance, closest group member, and closest outside note.
- [x] Similarity score method and group summaries appear in the Organize panel, with note group labels on the canvas.
- [x] The layout keeps pinned notes in place, avoids overlaps between placed notes, pauses Physics, and offers undo until a note is dragged or its text or pin state changes.
- [x] Shared board positions use one Liveblocks board update; local boards work from npm run dev with GEMINI_API_KEY set.
- [x] Verify the local sample-board grouping, result summary, Physics pause, and undo in a browser.
- [ ] Verify shared-board position persistence and sync in two browsers.
- [x] Run repository lint, typecheck, and build checks.
- [x] Full Organize returns one similarity and distance for every unordered note pair, plus group-pair means, and places rectangular notes in separated groups without bubble outlines.
- [x] Incremental assignment returns the complete pair score table for its submitted notes and positions only the new note from those scores.
- [x] The add-note preference calls `POST /api/similarity/clusters/assign` and changes only the new note's membership and position.
- [x] Shared boards persist group snapshots and reject an assignment from an older snapshot revision.
- [x] Verify the add-note control, separated rectangle layout, and single-note placement in the local browser.
- [ ] Verify group snapshot persistence and incremental placement across two shared-board browsers.
