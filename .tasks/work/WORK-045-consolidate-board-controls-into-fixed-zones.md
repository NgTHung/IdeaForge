---
id: "WORK-045"
title: "Consolidate board controls into fixed zones"
status: In Progress
priority: "Medium"
type: "Design"
risk: "Low"
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/design-cleanup.md"
last_updated: 2026-10-10
---

## Summary

Implement the first board-layout pass from the design cleanup target layout. Move controls without changing what they do: one left toolbar with drawing tools and a Decorate menu, undo and redo beside zoom, the Assistant launcher in the header, the board description under the title, and the link-visibility toggle in the selection bar. Remove the header theme toggle and the separate React, Message, Achievements, and Stickers chips. Replace glyph and emoji tool icons with one SVG set. Selection-bar merging, AI panel consolidation, the shared notice area, and the Style panel split stay for later passes.

## Acceptance Criteria

- [ ] The left toolbar is one group with select, pan, add, connect, merge, organize, pencil, eraser, and Decorate, with no DRAW label or separate Assistant button.
- [ ] Decorate opens one menu with stickers, earned achievements, and the reaction and cursor-message actions; R and Enter shortcuts keep working.
- [ ] Undo and redo sit with the zoom controls; the header has no theme toggle; the Assistant opens from the header.
- [ ] The board description shows under the title only when it exists, and the link-visibility toggle lives in the selection bar.
- [ ] Toolbar, zoom, history, and Assistant icons come from one SVG icon module.
- [ ] Lint, typecheck, and production build pass; browser evidence and unverified paths are recorded.
