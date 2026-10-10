---
id: "WORK-049"
title: "Embed a sandbox board on the landing page"
status: Done
priority: "Medium"
type: "Feature"
risk: "Medium"
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/decisions.md"
last_updated: 2026-10-10
---

## Summary

Let visitors try the canvas on the landing page without an account or a Liveblocks room. A /try route runs the board in local sandbox mode with the sample ideas, and the landing page embeds it in an iframe that starts only after a click so page scrolling keeps working. The sandbox keeps idea editing, links, Organize, and Merge, and hides features that need a shared room or that the landing demo does not need.

## Acceptance Criteria

- [x] /try renders the local board with the sample ideas, saves nothing, and hides Share, Assistant, Conclusion, Suggested Links, and the account menu.
- [x] Links that leave the sandbox, such as the logo and Create board, open in the top window.
- [x] The landing page embeds /try under How it works behind a click-to-start overlay, links to it full screen, and keeps Open demo board as the shared option.
- [x] On narrow screens the landing page links to /try instead of embedding it.
- [x] docs/decisions.md records the sandbox scope; lint, typecheck, and production build pass; browser evidence and unverified paths are recorded.

## Verification

On 2026-10-10, lint, typecheck, and the production build passed. Headless Chromium ran against the production build at 1280×800.

Before the overlay was pressed, a mouse wheel over the embed scrolled the landing page. After **Click to try the board**, the sandbox showed the five sample ideas and no Share, Assistant, Conclusion, Suggested Links, or account controls. The logo and **Create board** links target `_top`, and **Create board** opened `/login?returnTo=%2Fboards%2Fnew` in the top window. The first frame height, 575px, let the toolbar overlap the title card, so the frame now uses `clamp(660px, 82vh, 780px)`.

A live GLM-5.3-Flash merge of Shared study rooms and Progress check-ins returned a preview in 3.9 s inside the iframe. Creating it added Accountability Study Rooms and kept both originals. At 390px the page showed the **Open the sandbox** link, requested no `/try` iframe, and had no horizontal overflow.

Organize in the sandbox, keyboard-only use of the overlay, touch devices, Safari and Firefox, and the deployed app were not checked.
