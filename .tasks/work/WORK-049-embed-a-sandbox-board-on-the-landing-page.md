---
id: "WORK-049"
title: "Embed a sandbox board on the landing page"
status: In Progress
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

- [ ] /try renders the local board with the sample ideas, saves nothing, and hides Share, Assistant, Conclusion, Suggested Links, and the account menu.
- [ ] Links that leave the sandbox, such as the logo and Create board, open in the top window.
- [ ] The landing page embeds /try under How it works behind a click-to-start overlay, links to it full screen, and keeps Open demo board as the shared option.
- [ ] On narrow screens the landing page links to /try instead of embedding it.
- [ ] docs/decisions.md records the sandbox scope; lint, typecheck, and production build pass; browser evidence and unverified paths are recorded.
