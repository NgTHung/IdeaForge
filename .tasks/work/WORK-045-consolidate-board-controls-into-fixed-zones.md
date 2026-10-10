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

- [x] The left toolbar is one group with select, pan, add, connect, merge, organize, pencil, eraser, and Decorate, with no DRAW label or separate Assistant button.
- [x] Decorate opens one menu with stickers, earned achievements, and the reaction and cursor-message actions; R and Enter shortcuts keep working.
- [x] Undo and redo sit with the zoom controls; the header has no theme toggle; the Assistant opens from the header.
- [ ] The board description shows under the title only when it exists, and the link-visibility toggle lives in the selection bar.
- [x] Toolbar, zoom, history, and Assistant icons come from one SVG icon module.
- [x] Lint, typecheck, and production build pass; browser evidence and unverified paths are recorded.

## Verification

On 2026-10-10, lint, typecheck, the production build, and all 174 tests passed. A headless Chromium script against `next dev` joined a fresh Liveblocks room as a guest at 1280×800. The toolbar listed Select, Pan, Add idea, Connect, Merge, Organize, Pencil, Eraser, and Decorate. Undo and Redo sat with the zoom buttons, and the header showed Top ideas, members, Share, Assistant, and Style. The theme toggle, description button, React and Message chips, Achievements and Stickers chips, and DRAW label were absent. Decorate opened stickers, achievements, and reactions; Escape closed it and returned focus to Decorate. R opened the reaction wheel and Enter opened the cursor message, and the menu's React button opened the wheel. Selecting an idea showed Only its links in the selection bar, and it toggled `aria-pressed`. The Assistant opened from the header. A dark-mode screenshot showed the menu and toolbar with dark styling, and no page errors were logged.

The test room had no directory record, so only the hidden-description case was rendered; a board with a saved description still needs a browser check. Liveblocks authorization intermittently returned HTTP 503 in this environment. At 390px the header row already overflowed before this change and still does. Two-browser behavior, signed-in boards, and deployment were not checked.

