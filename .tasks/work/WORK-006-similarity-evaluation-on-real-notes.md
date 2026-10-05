---
id: "WORK-006"
title: "Similarity evaluation on real notes"
status: "To Do"
priority: "High"
type: "TestDebt"
milestone: "day-1"
tags: ["enhancement", "ready-for-human"]
last_updated: "2026-10-05"
---

## Summary

Owner: AI1. The 2026-10-05 test used nine invented notes. Check the similarity approach on a realistic board before anyone invests in Organize animation.

## Acceptance Criteria

- [ ] At least 40 real notes on one brainstorming goal are collected, including some in Vietnamese.
- [ ] Raw and mean-centered similarity are compared on those notes, and a team member judges whether each card's nearest neighbors are related.
- [ ] gemini-embedding-001 and gemini-embedding-2 are compared on the same notes, and the chosen model is recorded in docs/decisions.md.
- [ ] The small-board threshold and the number of nearest and cross-group candidates are chosen and recorded in docs/roadmap.md.
