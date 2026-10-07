---
id: "WORK-024"
title: "Assistant chat route with card citations"
status: "To Do"
priority: "Low"
type: "Feature"
parent: "WORK-021"
depends_on: ["WORK-011"]
risk: "Medium"
impact: "Adds a Gemini route whose output names board cards and proposes board changes."
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/assistant.md"
last_updated: "2026-10-07"
---

## Summary

Owner: AI2. Add POST /api/assistant, which answers a chat message from the whole board and returns cited paragraphs and up to three proposed actions. See Context, Card aliases, Response shape, and Prompt rules in docs/assistant.md.

## Acceptance Criteria

- [ ] A Zod-validated request accepts the goal, cards, relationships, selected card, the new message, and up to 10 earlier messages, and rejects requests over the size limits in docs/assistant.md with a 400 response.
- [ ] The route sends cards to the model as c1, c2, and so on, and returns real card IDs to the browser.
- [ ] The response holds one to eight paragraphs with citations, and up to three create, edit, link, or merge actions, validated with Zod through generateJson in src/lib/ai.ts.
- [ ] Citations and actions that name aliases missing from the request, link or merge actions on one card, and create actions with no valid source card are removed, and the count is logged without card text.
- [ ] The system instruction treats board content and messages as data, requires citations, and allows the answer that no card is relevant.
- [ ] Errors use aiErrorResponse, and the route exports maxDuration = 95 like the merge route.
- [ ] Mocked-provider tests cover request limits, alias translation, removal of unknown references, and error responses.
- [ ] A live Gemini call returns a valid reply with citations, or the task notes that the key was unavailable.
