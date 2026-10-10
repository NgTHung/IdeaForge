---
id: "WORK-042"
title: "Give cloud notes and clusters a fuller decorative treatment"
status: In Progress
priority: "Medium"
type: "Feature"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Replace the simple Clouds cluster outline with a puffy cloud silhouette, soft shading, small cloud accents, and static decorative details. Add the same cloud treatment to notes and Style previews. Preserve readable content, shared appearance persistence, accessible controls, and merge provenance.

## Acceptance Criteria

- [ ] Cloud clusters have a visibly puffy silhouette and layered cosmetic details that follow member bounds; hiding the boundary hides the cloud decoration while retaining the name.
- [ ] Notes offer Clouds in Style and use the same cloud rendering as clusters and previews without covering text, votes, pinning, selection, or editing controls.
- [ ] Cloud appearances retain existing colors, sync and survive reload, and leave note text, source snapshots, positions, cluster membership, and other styles intact.
- [ ] Cloud cosmetics stay static and work in light and dark mode, motion-off mode, narrow layouts, and canvas pan and zoom without intercepting input.
- [ ] Relevant appearance tests, lint, typecheck, build, and browser verification pass, with live checks and limitations recorded.
