---
id: "WORK-015"
title: "Concept brief generation"
status: Deferred
priority: "Medium"
type: "Feature"
milestone: "day-3"
depends_on: ["WORK-003", "WORK-011"]
impact: "Adds a Gemini route and a brief panel."
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-09
---

## Summary

Owner: AI2. A short brief turns a merged concept into something the team takes away from a session. See Concept brief in docs/decisions.md.

## Acceptance Criteria

- [ ] **Generate brief** on a merged card produces a brief with the concept, the contributing cards and their authors, the assumptions and open questions, and the next experiment.
- [ ] The brief uses only board content and doesn't present anything as a decision the team agreed on.
- [ ] The brief comes from a real Gemini call with validated structured output through the shared AI module.
- [ ] You can copy the brief as Markdown.

## Rationale

Replaced by the board conclusion in WORK-038; a conclusion with one merged note selected covers the brief.
