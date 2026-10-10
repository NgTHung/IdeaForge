---
id: "WORK-043"
title: "Open the reaction wheel at the cursor"
status: In Progress
priority: "Medium"
type: "Feature"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Open quick reactions around the current pointer with R or the React button. Keep the wheel stationary while choosing and keep every option inside the visible board. Preserve temporary shared reactions and keyboard access.

## Acceptance Criteria

- [ ] R centers the wheel on the latest cursor location, and the React button opens it at the activation point with a useful keyboard fallback.
- [ ] The wheel stays stationary while selecting, fits near board edges and narrow screens, and uses screen coordinates through pan and zoom.
- [ ] Reaction selection, arrow keys, Escape, outside dismissal, chat exclusivity, and shortcut typing guards remain usable; shared reactions still reach collaborators.
- [ ] Focused tests, lint, typecheck, build, and collaborative browser checks pass, with limitations recorded.
