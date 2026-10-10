---
id: "WORK-050"
title: "Show an expandable QR code after copying a board link"
status: Done
priority: "Medium"
type: "Feature"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Show a QR code for the same board URL when a participant copies the link from Share. Clicking the code opens a larger, keyboard-accessible view.

## Acceptance Criteria

- [x] Copy link displays a scannable QR code encoding the exact copied board URL, including clipboard failure feedback.
- [x] Clicking the QR code opens a larger view; close, Escape, and outside click return to the share menu with keyboard focus restored.
- [x] The QR code and enlarged view fit mobile screens and remain readable in light and dark themes.
- [x] Lint, typecheck, build, and browser checks pass.

## Verification

On 2026-10-10, lint, typecheck, the production build, and all 195 existing tests passed. The T3 preview confirmed the QR after Copy link and its larger view. After the preview disconnected, local headless Chromium joined the same live Liveblocks guest room and checked the production build.

Real clipboard copying succeeded on localhost. An independent QR decoder read both rendered SVG sizes and matched the copied URL, including its query and fragment. A deliberately rejected clipboard write kept the QR visible with failure feedback. Reopening Share cleared the previous QR. Enter and Space opened the large view. Tab kept focus inside it. Escape, the close button, and a backdrop click each closed only the large view and restored focus to its trigger. Capturing keyboard events prevents the board's document shortcuts from dismissing Share or changing canvas selection during this interaction.

The share menu and enlarged dialog fit a 390px dark viewport and a 320px light viewport. The dark dialog retained black QR modules on white. No browser page errors occurred. Physical phone scanning, other browser engines, signed-in sessions, and deployment were not checked. No live AI calls were needed.
