---
id: "BUG-002"
title: "Repair rejected AI output once with feedback"
status: Done
priority: "High"
type: "Bug"
parent: "WORK-021"
depends_on: ["WORK-011", "BUG-001"]
risk: "Medium"
impact: "Every generation route can spend one of its three attempts on a corrected reply; merges and naming repair missing IDs."
tags: ["bug", "ready-for-agent"]
last_updated: 2026-10-08
---

## Summary

GLM-5.3-Flash on Featherless often returns output that fails validation: merges leave out selected sources, and replies occasionally contain unescaped quotes. Instead of failing at once, send the model its rejected reply and the specific problem, and ask once for a corrected JSON object within the existing attempt and time budget.

## Acceptance Criteria

- [x] A reply that fails JSON parsing, its schema, or a caller check is sent back once with the problem, and a second rejection returns invalid_output.
- [x] Merge source coverage, group-name coverage, and the explanation condition rule run as caller checks.
- [x] The repair uses one of the existing three attempts, single-attempt callers get no repair, and the request time limit is unchanged.
- [x] Problem text and model output are not logged or returned to the browser.
- [x] Mocked-provider tests cover repair success, repeated rejection, caller checks, single-attempt callers, and a repair that reaches the fallback.
- [x] Live merges and assistant prompts are rerun, and repair rates, outcomes, and latency are recorded.

## Verification

On 2026-10-08, `npm test` passed all 126 tests, and `npm run lint`, `npm run typecheck`, and `npm run build` passed. New mocked tests cover a successful repair and its messages, repeated rejection, a caller check, a single-attempt caller, an overloaded repair that reaches the fallback, and a merge whose contributions name a wrong source.

Live calls with `zai-org/GLM-5.3-Flash` ran 30 merges of eight distinct notes twice. In the first run, 15 replies needed repair and all 15 succeeded; 2 other merges failed after one HTTP 200 response without a repair, and that cause was not reproduced. In the second run, 20 replies needed repair, 18 succeeded, and 28 of 30 merges returned a proposal, with an 11.7-second median and a 33.5-second maximum. The two failed repairs returned an invalid `status` and an unterminated string. All 18 action-heavy assistant prompts succeeded without needing a repair.
