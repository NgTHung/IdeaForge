---
id: "WORK-025"
title: "Connect the chat sidebar to the assistant"
status: "In Progress"
priority: "Low"
type: "Feature"
parent: "WORK-021"
depends_on: ["WORK-024"]
impact: "Replaces the placeholder chat with assistant requests and adds card focusing from the chat."
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/assistant.md"
last_updated: "2026-10-08"
---

## Summary

Owner: SE1. Replace the placeholder reply in src/features/board/chat-sidebar.tsx with calls to /api/assistant, and show each paragraph's citations as chips that focus the card on the canvas.

## Acceptance Criteria

- [ ] Sending a message posts the current board, selected card, and recent messages to /api/assistant on both the local and shared boards.
- [ ] Each reply paragraph shows its cited cards as chips labeled with the card title, and clicking a chip selects the card and pans the canvas to it.
- [ ] A chip whose card was deleted shows that the card is gone and does nothing when clicked.
- [ ] The chat shows a loading state, allows one request at a time, and shows the error message when a request fails, while manual board work keeps working.
- [ ] The sidebar labels replies as AI-generated, names the model, and no longer says the AI is not connected.
- [ ] Chat history stays in the browser and isn't written to Liveblocks.
- [ ] The browser keeps the card text it sent with each reply, for the staleness check in work:WORK-026 and work:WORK-027.

## Implementation note — 2026-10-07

The sidebar sends current board context to `/api/assistant`, validates its response, keeps completed transcript turns and request snapshots in component state, displays model-labeled paragraph citations, and focuses or disables chips for missing cards. Failed turns are excluded from later history. On 2026-10-08, a live shared-board browser session showed citations, focused a cited card, and displayed the model label. Loading and one-request-at-a-time behavior appeared during the request. Local-board sending, deleted citations, failure recovery while doing manual work, and whether chat history stays out of Liveblocks still need verification, so the acceptance criteria remain open.
