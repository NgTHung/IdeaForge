---
id: "WORK-031"
title: "Keep dismissed and merged pairs out of relationship suggestions"
status: "In Progress"
priority: "High"
type: "Bug"
milestone: "day-2"
risk: "Low"
impact: "Adds shared dismissal records to board storage; suggestion requests exclude dismissed and merge-lineage pairs."
tags: ["bug", "ready-for-agent"]
last_updated: "2026-10-07"
---

## Summary

Dismissed suggestions return on the next automatic pass because dismissal only removes a browser-local preview with a random ID. Merged ideas get suggestions to their own sources because requests exclude saved links but not merge lineage. Collaborators who hit the board cooldown see an error instead of waiting for the shared result.

## Acceptance Criteria

- [x] Dismissing a suggestion records the idea pair on the board, so later passes, reloads, and other participants do not show that pair again.
- [x] Suggestion requests and previews exclude saved links, dismissed pairs, ancestor and descendant merge pairs, and the sources of one merge.
- [ ] A cooldown response shows a waiting status and retries, not an error.
- [x] Tests cover dismissal and lineage exclusion; tests, lint, typecheck, and build pass; decisions and roadmap record the change.

## Verification

All 87 tests, lint, typecheck, and the production build passed on 2026-10-07. Unit tests cover dismissal in either direction, dismissal across new preview IDs, and exclusion of parent, ancestor, and co-source pairs.

A local production server over Tailscale ran with live Jev, MongoDB, and Liveblocks. Two guest tabs on a new room showed the same three suggestions. A dismissal in one tab removed the pair from both. A goal change started a new live Jev pass that left out the dismissed pair, and the Liveblocks REST API confirmed the stored dismissal. A live merge and a live cooldown response were not exercised.
