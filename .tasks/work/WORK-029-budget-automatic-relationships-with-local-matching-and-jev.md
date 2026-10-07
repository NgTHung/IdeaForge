---
id: "WORK-029"
title: "Budget automatic relationships with local matching and Jev"
status: Done
priority: "High"
type: "Feature"
last_updated: 2026-10-07
---

## Summary

Remove Gemini calls from automatic relationship discovery. Use local candidate matching and Jev for bounded classification, then generate an explanation only when a participant requests it. Reuse cached results and enforce shared request allowances to control cost.

## Acceptance Criteria

- [x] Automatic connection analysis uses local candidate matching and bounded Jev classification batches, with no Gemini or embedding calls and no Gemini fallback.
- [x] Jev results are validated, preserve extends direction, rank at most three useful suggestions, and support no relationship and uncertain outcomes without invented explanations.
- [x] A shared durable cache reuses unchanged pair judgments across requests and collaborators; atomic cooldowns and daily request allowances bound Jev and explanation attempts.
- [x] Gemini explains only an explicitly requested pair; results are cached and rejected after source, goal, type, or direction changes.
- [x] The review UI distinguishes classification from explanation, preserves manual explanations and conflict conditions, and keeps stale-source checks and human acceptance.
- [x] Missing credentials, budget exhaustion, provider errors, and invalid output have actionable messages; mocked tests and repository checks pass, and live verification limits are recorded.

## Verification

All 80 tests, lint, typecheck, and the production build passed on 2026-10-07. Provider tests use labeled mocked responses. A live MongoDB test in a temporary collection verified concurrent cooldowns, shared daily limits, cache reuse, expiry, and separate explanation limits; the collection was dropped afterward.

The production browser over Tailscale connected to Liveblocks and showed the missing TypeSafe key message. A mocked Jev preview rendered before an explanation existed, with acceptance disabled and zero Gemini requests. Writing an explanation enabled acceptance; changing type and reversing direction preserved that manual text. One explicitly requested live Gemini explanation returned HTTP 503, with one server attempt and actionable UI feedback. No fallback ran. Live Jev classification is unverified because TYPESAFE_API_KEY is absent, and successful live explanation generation remains unverified. No deployment was performed.
