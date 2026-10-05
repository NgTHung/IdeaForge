---
id: "WORK-002"
title: "Verify two-browser sync on the deployed app"
status: "To Do"
priority: "High"
type: "TestDebt"
milestone: "day-1"
depends_on: ["WORK-001"]
tags: ["enhancement", "ready-for-human"]
last_updated: "2026-10-05"
---

## Summary

Owner: SE2. Two-browser sync is the one shared-board behavior that has never been verified.

## Acceptance Criteria

- [ ] Two browsers on the deployed URL see each other's new cards, text edits, moves, and goal changes without reloading.
- [ ] A kept merged card survives a reload and a reconnect in both browsers.
- [ ] The result is recorded under Verified in docs/roadmap.md, and any failure is filed as a BUG task.
