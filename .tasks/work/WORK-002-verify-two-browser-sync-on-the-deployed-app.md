---
id: "WORK-002"
title: "Verify two-browser sync on the deployed app"
status: "In Progress"
priority: "High"
type: "TestDebt"
milestone: "day-1"
depends_on: ["WORK-001"]
tags: ["enhancement", "ready-for-human"]
last_updated: "2026-10-06"
---

## Summary

Owner: SE2. Restore the shared canvas on Liveblocks, then verify two-browser sync on the deployed app. The current local canvas stores its board only in React memory.

## Acceptance Criteria

- [ ] A shared board opens at a stable room URL, loads saved room state, and writes board changes to Liveblocks Storage.
- [ ] Two browsers on the deployed URL see each other's new cards, text edits, moves, and goal changes without reloading.
- [ ] A kept merged card survives a reload and a reconnect in both browsers.
- [ ] The result is recorded under Verified in docs/roadmap.md, and any failure is filed as a BUG task.
