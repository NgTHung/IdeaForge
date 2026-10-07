---
id: "WORK-024"
title: "Assistant chat route with card citations"
status: "Done"
priority: "Low"
type: "Feature"
parent: "WORK-021"
depends_on: ["WORK-011"]
risk: "Medium"
impact: "Adds a Featherless route whose output cites board cards and proposes board changes."
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/assistant.md"
last_updated: "2026-10-08"
---

## Summary

Owner: AI2. Add POST /api/assistant, which answers a chat message from the whole board and returns cited paragraphs and up to three proposed actions. See Context, Card aliases, Response shape, and Prompt rules in docs/assistant.md.

## Acceptance Criteria

- [x] A Zod-validated request accepts the goal, cards, relationships, selected card, the new message, and up to 10 earlier messages, and rejects requests over the documented limits with a 400 response.
- [x] The route sends cards to the model as c1, c2, and so on, and returns real card IDs to the browser.
- [x] The response holds one to eight paragraphs with citations and up to three create, edit, link, or merge actions, validated through generateJsonWithModel in src/lib/ai.ts.
- [x] Citations and actions that name aliases missing from the request, link or merge actions on one card, and create actions with no valid source card are removed, and removal counts are logged without card text.
- [x] The system instruction treats board content and earlier messages as data, requires citations, and allows the answer that no card is relevant.
- [x] Errors use aiErrorResponse, and the route exports maxDuration = 95 like the merge route.
- [x] Mocked-provider tests cover request limits, alias translation, removal of unknown references, and error responses.
- [x] A live Featherless call returns a valid reply with citations, or the task records why live verification could not run.

## Verification

On 2026-10-07, eight mocked assistant-route tests covered request limits, alias translation for all four action kinds, invalid-reference removal, empty boards, and provider errors. `npm test` passed all 95 tests. Typecheck, production build, and `npm run lint` passed. ESLint ignores the nested `.assistant-route-validation` worktree and the local `.venv-clustering` environment.

Three local POST requests for relevant, irrelevant, and action prompts returned 502 `provider_error` after 1,250 ms, 27 ms, and 26 ms. DNS resolved `api.featherless.ai`, but TCP 443 was unreachable. Live reply validation, citation quality, prompt-injection handling, action quality, and provider latency remain unverified because this environment could not connect to Featherless.

On 2026-10-08, after starting the local app from the normal Windows shell, a live request returned HTTP 200 from `zai-org/GLM-5.3-Flash` with a cited answer. The browser test and another live request returned cited answers. A duplicate-link action filter now removes relationships already saved on the board. All 110 repository tests, lint, typecheck, and the production build passed. Citation quality and prompt-injection behavior still need human evaluation in WORK-028.
