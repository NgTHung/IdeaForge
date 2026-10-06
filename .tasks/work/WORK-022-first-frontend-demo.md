---
id: "WORK-022"
title: "Make the canvas prototype the main app"
status: "In Progress"
priority: "Medium"
type: "Feature"
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-06"
---

## Summary

Make the local canvas the main IdeaForge app at `/`. Remove the prior merge implementation and its unused dependencies. Keep board code together under one feature folder. Connect ideas by dragging in Connect mode, then choose a relationship. Tune physics for slower, softer motion.

## Acceptance Criteria

- [x] `/` opens the local canvas, with one board feature folder and no old merge UI or `/board/[id]` route. When this merged into `main` on 2026-10-06, the merge, similarity, and Liveblocks authorization API routes were kept for the shared AI and account work; see the decisions log.
- [x] Dependencies and documentation describe the app that still runs.
- [x] In Connect mode, dragging from one idea into another opens the relationship chooser without moving either idea.
- [x] Physics settles more slowly with softer, bubble-like motion while pinning and direct dragging still work.
- [x] Focused tests, lint, typecheck, build, and a browser render check pass.
