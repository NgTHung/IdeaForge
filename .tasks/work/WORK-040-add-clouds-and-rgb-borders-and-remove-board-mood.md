---
id: "WORK-040"
title: "Add clouds and RGB borders and remove board mood"
status: In Progress
priority: "Medium"
type: "Feature"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Follow up on completed work:WORK-039 at the user request: add a Clouds canvas background, replace rainbow decoration with a glowing RGB border that cycles colors, and remove the Growing ideas plant. Verify remote cursors with two connections on the same board and explain when they appear.

## Acceptance Criteria

- [ ] Clouds is a personal canvas background choice that survives reload and remains readable in light and dark modes.
- [ ] RGB borders share one rendering style across note, cluster, and settings previews; existing rainbow styles use it and reduced motion or disabled animations stop cycling.
- [ ] Growing ideas and the board mood toggle and unused logic are removed without removing achievement stickers or resetting existing preferences.
- [ ] Two live connections verify remote named cursors on the same board; report any cursor failures and fix confirmed regressions in scope.
- [ ] Focused tests, lint, typecheck, build, and task validation pass; record browser evidence.
