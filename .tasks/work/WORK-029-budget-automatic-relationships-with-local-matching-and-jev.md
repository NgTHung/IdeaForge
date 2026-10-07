---
id: "WORK-029"
title: "Budget automatic relationships with local matching and Jev"
status: In Progress
priority: "High"
type: "Feature"
last_updated: 2026-10-07
---

## Summary

Describe why this work exists.

## Acceptance Criteria

- [ ] Automatic connection analysis uses local candidate matching and bounded Jev classification batches, with no Gemini or embedding calls and no Gemini fallback.
- [ ] Jev results are validated, preserve extends direction, rank at most three useful suggestions, and support no relationship and uncertain outcomes without invented explanations.
- [ ] A shared durable cache reuses unchanged pair judgments across requests and collaborators; atomic cooldowns and daily request allowances bound Jev and explanation attempts.
- [ ] Gemini explains only an explicitly requested pair; results are cached and rejected after source, goal, type, or direction changes.
- [ ] The review UI distinguishes classification from explanation, preserves manual explanations and conflict conditions, and keeps stale-source checks and human acceptance.
- [ ] Missing credentials, budget exhaustion, provider errors, and invalid output have actionable messages; mocked tests and repository checks pass, and live verification limits are recorded.
