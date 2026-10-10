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

Consolidate board controls and make the main flows direct. Keep one left toolbar with drawing tools and a Decorate menu, place Assistant, Suggested Links, and Conclusion under one star launcher above and outside it, and move the selected-idea actions to bottom center. Combine Select and Pan so clicking an idea selects it and dragging empty canvas pans. Show each idea's group, type label, full centered title, and votes by default, and show its full details on hover, focus, or selection. Pair Merge and Group vertically in a highlighted frame aligned with the other tools. Let participants edit the board name and description from one dialog, cap each participant at three upvotes across the board, and let Top ideas focus an idea when selected. Keep undo and redo beside zoom, remove the Share icon, and put icon-only Style beside the account control.

## Acceptance Criteria

- [x] The left toolbar has one Select and Pan control, add, connect, merge, group, pencil, eraser, and Decorate, with no separate Pan button, DRAW label, or Assistant button. Clicking an idea selects it; dragging the empty canvas pans.
- [x] Idea cards show the type label on the upper left, group name on the lower left, a full centered title, and votes by default. Labels stay on one line; the default title uses larger text and wraps at word boundaries. Hover, focus, or selection shows full details.
- [x] One round star launcher sits above and outside the toolbar, and opens Assistant, Suggested Links, and Conclusion with a symbol beside each name.
- [x] Merge and Group sit vertically in one compact highlighted frame, aligned with the other tools; the selected-idea toolbar sits at bottom center.
- [x] Clicking an active toolbar tool again returns to Select; clicking Group again closes Organize and returns to Select.
- [x] Decorate opens one menu with stickers, earned achievements, and the reaction and cursor-message actions; R and Enter shortcuts keep working.
- [x] Undo and redo sit with the zoom controls, and the header has no theme toggle.
- [x] Clicking the board name opens a dialog that saves the board name and project description for everyone on the board.
- [x] Each participant can keep at most three upvotes; Top ideas stays sorted by score and clicking an idea closes the list and zooms to it.
- [x] Share has no icon, and icon-only Style appears immediately before the account control.
- [x] The board description shows under the title only when it exists, and the link-visibility toggle lives in the selection bar.
- [x] Toolbar, zoom, history, and Assistant icons come from one SVG icon module.
- [x] Lint, typecheck, and production build pass; browser verification gaps are recorded.
- [ ] Browser checks cover the unified Select and Pan control, compact and expanded idea cards, AI launcher, vote limit, idea focus, metadata sync, bottom-center selection actions, and mobile layout.

## Verification

On 2026-10-10, lint, typecheck, and the production build passed for unified Select and Pan behavior and compact idea cards. Cards show one-line type and group labels, larger centered titles with word-boundary wrapping, and votes by default, then reveal their details on hover, focus, or selection. No browser session was available to check pointer interactions or card appearance. The `taskroot` command is not installed, so tracker validation remains open.

On 2026-10-10, lint, typecheck, and the production build passed for the follow-up controls and board metadata editor. Typecheck and build needed workspace escalation because Next.js could not write generated files under the default sandbox. No browser session was available for this pass, so menu interaction, board metadata synchronization, the vote cap, focus and zoom, bottom-center selection actions, and mobile layout still need a browser check. The `taskroot` command is not installed in this environment, so tracker validation and lifecycle completion remain open.

On 2026-10-10, lint, typecheck, the production build, and all 174 tests passed. A headless Chromium script against `next dev` joined a fresh Liveblocks room as a guest at 1280×800. The toolbar listed Select, Pan, Add idea, Connect, Merge, Organize, Pencil, Eraser, and Decorate. Undo and Redo sat with the zoom buttons, and the header showed Top ideas, members, Share, Assistant, and Style. The theme toggle, description button, React and Message chips, Achievements and Stickers chips, and DRAW label were absent. Decorate opened stickers, achievements, and reactions; Escape closed it and returned focus to Decorate. R opened the reaction wheel and Enter opened the cursor message, and the menu's React button opened the wheel. Selecting an idea showed Only its links in the selection bar, and it toggled `aria-pressed`. The Assistant opened from the header. A dark-mode screenshot showed the menu and toolbar with dark styling, and no page errors were logged.

The test room had no directory record, so only the hidden-description case was rendered; a board with a saved description still needs a browser check. Liveblocks authorization intermittently returned HTTP 503 in this environment. At 390px the header row already overflowed before this change and still does. Two-browser behavior, signed-in boards, and deployment were not checked.

