---
id: "WORK-034"
title: "Merges report the notes that don't fit"
status: Done
priority: "High"
type: "Feature"
parent: "WORK-010"
depends_on: ["BUG-002"]
risk: "Medium"
impact: "Changes the merge contract: a useful merge can leave out selected notes, and only contributing notes become parents."
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-08
---

## Summary

On 2026-10-08, GLM left selected notes out of 15 to 20 of 30 eight-note merges, and the repair forced them back in. The user chose to let a merge report the notes that don't fit instead. The model gives contributions for the notes that share one mechanism and lists every other note with a short reason. Keeping the merge records only the contributing notes as parents and source snapshots.

## Acceptance Criteria

- [x] The merge proposal schema accepts an optional excluded list of source IDs with reasons, and every selected ID appears exactly once across contributions and excluded, with at least two contributions.
- [x] The route and the browser share one coverage check, and the route repairs coverage problems through the shared AI module.
- [x] The prompt asks the model to include every note that adds a real contribution and to explain each one it leaves out.
- [x] The merge preview lists left-out notes with their reasons, and the saved merge details show them too.
- [x] Keeping a merge stores only contributing notes as parents, source snapshots, and relationships, and the original notes stay unchanged.
- [x] Mocked tests cover partial merges, coverage failures, and the saved record; a live eight-note merge run records how often notes are left out and how often a repair is still needed.

## Verification

On 2026-10-08, `npm test` passed all 130 tests, and `npm run lint`, `npm run typecheck`, and `npm run build` passed. Mocked tests cover a route response that leaves out a note, coverage repair, the shared coverage check, a repeated ID across both lists, an excluded item with a copied `contribution` key, and a kept partial merge whose parents, source snapshots, and relationships contain only the contributing notes.

A first live run of 30 eight-note merges with `zai-org/GLM-5.3-Flash` returned 29 useful proposals, but 24 needed a repair, mostly because GLM added `contribution` keys to excluded items. After excluded items stripped unknown keys, a second run returned 27 useful proposals, each leaving out 2 to 5 notes. 6 needed a repair and 5 of those succeeded. Two requests failed after three attempts timed out while Featherless streamed HTTP 200 responses, with a 91-second maximum against a 13-second median. The preview and details panels were not checked in a browser, and the quality of the exclusion reasons still needs human evaluation in WORK-017.
