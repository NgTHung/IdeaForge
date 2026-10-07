---
id: "WORK-030"
title: "Generate with Featherless GLM-5.3-Flash"
status: "In Progress"
priority: "High"
type: "Refactor"
milestone: "day-2"
risk: "Medium"
impact: "Changes the provider behind every generation route; embeddings stay on Gemini."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-07"
---

## Summary

Merges, group names, and requested relationship explanations call Featherless's OpenAI-compatible chat completions API with zai-org/GLM-5.3-Flash instead of Gemini through AI Studio. Embeddings keep using Gemini. The shared module keeps one retry policy, error causes, and output validation for both providers.

## Acceptance Criteria

- [x] Every generation call goes through Featherless with a server-only FEATHERLESS_API_KEY and a configurable model that defaults to zai-org/GLM-5.3-Flash.
- [x] Embedding calls keep the existing Gemini model, key, fallback, and request shape.
- [x] Generation and embedding share one retry, fallback, timeout, and error-cause policy.
- [x] Structured output is validated against the existing Zod schemas.
- [x] User-facing text no longer credits Gemini for generated content.
- [ ] A live Featherless generation call returns a valid result.

## Verification

On 2026-10-07, `npm test` passed all 85 tests with mocked provider responses, and `npm run lint`, `npm run typecheck`, and `npm run build` passed. The tests cover the Featherless request shape, the default model, separate provider keys, retry and fallback counts, attempt timeouts, output validation, and the unchanged Gemini embedding requests.

No `FEATHERLESS_API_KEY` was available, so a live Featherless call has not run. The last criterion stays open until one returns a valid merge.
