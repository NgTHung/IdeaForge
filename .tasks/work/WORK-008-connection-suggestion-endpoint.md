---
id: "WORK-008"
title: "Connection suggestion endpoint"
status: Done
priority: "High"
type: "Feature"
milestone: "day-2"
depends_on: ["WORK-005", "WORK-011"]
risk: "Medium"
impact: "Adds a Gemini route whose output becomes board links once accepted."
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-06
---

## Summary

Owner: AI1. For the whole board, propose up to three typed links between cards, or report that none are useful. The rules are under Relationships in docs/decisions.md.

## Acceptance Criteria

- [x] A Zod-validated route accepts the board goal, cards, and existing links, and picks candidate pairs with the similarity module: four nearest neighbors plus up to three diverse cards per card. Existing linked pairs are excluded.
- [x] The response holds up to three suggestions, each with source and target card IDs, a type, the direction for extends, an explanation, and the condition for conflicts with.
- [x] The model can return no useful relationship, or needs clarification with the question to ask.
- [x] The route rejects output that references card IDs that weren't in the request.
- [x] Suggestions come from a real Gemini call with structured output through the shared AI module.

## Verification

55 mocked tests, lint, typecheck, and production build passed on 2026-10-06. A live request using the configured embedding-2 model returned a valid conflict suggestion in 9.3 seconds, after two generation overloads and a successful configured fallback. Embedding inputs now use separate Content objects so embedding-2 returns one vector per card.
