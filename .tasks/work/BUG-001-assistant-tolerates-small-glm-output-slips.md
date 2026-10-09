---
id: "BUG-001"
title: "Assistant tolerates small GLM output slips"
status: Done
priority: "High"
type: "Bug"
parent: "WORK-021"
depends_on: ["WORK-024"]
risk: "Medium"
impact: "Changes how the assistant and shared AI module read model output; greetings and action requests stop failing on minor format slips."
tags: ["bug", "ready-for-agent"]
whitepaper: "docs/assistant.md"
last_updated: 2026-10-08
---

## Summary

Featherless ignores json_object, json_schema, guided_json, and forced tool calls, so GLM-5.3-Flash output is constrained only by the prompt. On 2026-10-08, 5 of 16 live greetings and 8 of 18 action-heavy assistant prompts returned invalid_output. Causes were plain prose with no JSON, prose before the JSON, missing cites, an extra top-level key, more than three actions or five citations, and one unescaped quote. Accept these small slips instead of discarding the whole reply.

## Acceptance Criteria

- [x] The shared AI module parses one JSON object surrounded by prose or a Markdown fence.
- [x] An assistant reply with no JSON object becomes uncited paragraphs with no actions.
- [x] The assistant defaults missing cites to an empty list, keeps the first five citations per paragraph and the first three valid actions, ignores unknown keys, and drops invalid actions instead of rejecting the reply.
- [x] Dropped action counts are logged without card text.
- [x] Mocked-provider tests cover each tolerated slip and confirm that broken JSON still returns invalid_output.
- [x] Live greeting and action-heavy assistant prompts are rerun, and the failure rates are recorded.

## Verification

On 2026-10-08, `npm test` passed all 121 tests, and `npm run lint`, `npm run typecheck`, and `npm run build` passed. Mocked-provider tests cover JSON surrounded by prose, a plain-text greeting with a reasoning block, missing and excess citations, an unknown top-level key, an invalid action, a fourth valid action, the logged counts, and broken JSON that still returns `invalid_output`.

Live Featherless calls with `zai-org/GLM-5.3-Flash` then returned 8 of 8 greetings and 17 of 18 action-heavy prompts, against 11 of 16 and 10 of 18 before the change. The remaining failure was an unescaped quote inside a JSON string. Reply and action quality still need human evaluation in WORK-028.
