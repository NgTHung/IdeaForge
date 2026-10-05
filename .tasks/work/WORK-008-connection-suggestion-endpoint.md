---
id: "WORK-008"
title: "Connection suggestion endpoint"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "day-2"
depends_on: ["WORK-005", "WORK-011"]
risk: "Medium"
impact: "Adds a Gemini route whose output becomes board links once accepted."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-05"
---

## Summary

Owner: AI1. For a selected card, propose up to three typed links to other cards on the board, or report that none are useful. The rules are under Relationships in docs/decisions.md.

## Acceptance Criteria

- [ ] A Zod-validated route accepts the board goal, the selected card, and the board's cards, and picks candidates with the similarity module: nearest neighbors plus a few cards from other groups.
- [ ] The response holds up to three suggestions, each with source and target card IDs, a type, the direction for extends, an explanation, and the condition for conflicts with.
- [ ] The model can return no useful relationship, or needs clarification with the question to ask.
- [ ] The route rejects output that references card IDs that weren't in the request.
- [ ] Suggestions come from a real Gemini call with structured output through the shared AI module.
