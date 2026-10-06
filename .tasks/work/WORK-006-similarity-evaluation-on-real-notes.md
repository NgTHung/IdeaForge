---
id: "WORK-006"
title: "Similarity evaluation on real notes"
status: "In Progress"
priority: "High"
type: "TestDebt"
milestone: "day-1"
tags: ["enhancement", "ready-for-human"]
last_updated: "2026-10-06"
---

## Summary

Owner: AI1. The 2026-10-05 test used nine invented notes. Check the similarity approach on a realistic board before anyone invests in Organize animation.

## Acceptance Criteria

- [ ] At least 40 real notes on one brainstorming goal are collected.
- [ ] Raw and mean-centered similarity are compared on those notes, and a team member judges whether each card's nearest neighbors are related.
- [ ] The small-board threshold and the number of nearest and cross-group candidates are chosen and recorded in docs/roadmap.md.

## Progress

- **2026-10-06:** Started on `chore/work-006-similarity-evaluation`. Per the user's request, created a 40-note synthetic dataset and ran one Gemini embedding batch with `gemini-embedding-001` at 768 dimensions. Top-two theme agreement was 47.5% for raw cosine and 55.0% for mean-centered cosine. The blinded review sheet contains 81 candidate pairs. This pilot does not satisfy the real-note or team-review criteria; the threshold and candidate counts remain provisional. See `docs/similarity-evaluation.md`.
- **2026-10-06:** Added a development-only `/similarity-lab` page with the 40-note pilot. Adding a note requests raw and mean-centered scores, shows its nearest neighbors, and compares existing candidate distances with the saved baseline. Verified one synthetic note in the live UI and added an automated regression test showing that raw cosine stays fixed while adding a note recalculates mean-centered distances. WORK-006 remains in progress until the team reviews real notes and records final settings.
- **2026-10-06:** Changed the lab to a board canvas. Notes render as draggable nodes grouped by theme. Selecting a node draws its five closest distance links; the side panel switches between raw and mean-centered distances and shows the closest notes. Verified both methods in the browser.
