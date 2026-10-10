---
id: "WORK-043"
title: "Open the reaction wheel at the cursor"
status: Done
priority: "Medium"
type: "Feature"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Open quick reactions around the current pointer with R or the React button. Keep the wheel stationary while choosing and keep every option inside the visible board. Preserve temporary shared reactions and keyboard access.

## Acceptance Criteria

- [x] R centers the wheel on the latest cursor location, and the React button opens it at the activation point with a useful keyboard fallback.
- [x] The wheel stays stationary while selecting, fits near board edges and narrow screens, and uses screen coordinates through pan and zoom.
- [x] Reaction selection, arrow keys, Escape, outside dismissal, chat exclusivity, and shortcut typing guards remain usable; shared reactions still reach collaborators.
- [x] Focused tests, lint, typecheck, build, and collaborative browser checks pass, with limitations recorded.

## Verification

On 2026-10-10, the eleven existing canvas-interaction and board-social tests passed. Lint, typecheck, production build, and diff checks passed. The wheel snapshots its opening point in workspace coordinates, outside the zoomed canvas. CSS clamps its center using the wheel size and an eight-pixel margin, including after resizing. Workspace pointer capture reuses the existing screen-position ref without rerendering on movement. The wheel retains its own focus and outside-dismissal checks after leaving the toolbar container.

The rebuilt production app was checked through the T3 shared browser on the isolated WORK-039 demo board. R opened a 182px wheel centered at screen point (760, 530); moving the pointer toward an option left its bounds unchanged. Zooming to 86.4% and panning by (120, 60) kept the same opening point and screen size. All six choices remained visible at all four desktop corners. Clicking React opened at its activation point, shifted inward at the bottom edge. Pointer selection and arrow-key selection with Enter sent reactions and closed the wheel. Escape restored trigger focus. Outside pointerdown dismissed it. R in the board-title input or chat input did not open it, and opening reactions closed chat.

A 390 by 844 same-origin board iframe verified keyboard activation before any pointer movement, a useful trigger-centered fallback, and edge clamping with all options visible. The iframe was removed afterward. Two guest connections verified that a named clap reaction from WORK-039 demo reached the other browser through real Liveblocks events. Local HTTP checks seeded the existing guest cookies because production cookies use Secure; no authentication configuration changed. No Gemini or other generation call was needed. Physical devices, other browser engines, signed-in sessions, and deployment were not checked. The user's existing next.config.ts edit remains unstaged.

The browser preview shows the open wheel. Screenshot: `/home/bbq/.t3/userdata/browser-artifacts/browser-screenshot-100-102-144-120-mv1vcvp4-c3d03400.png`.
