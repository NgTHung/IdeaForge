---
id: "WORK-017"
title: "Run the AI evaluation"
status: "To Do"
priority: "High"
type: "TestDebt"
milestone: "day-4"
depends_on: ["WORK-001", "WORK-007", "WORK-008", "WORK-010"]
tags: ["enhancement", "ready-for-human"]
last_updated: "2026-10-05"
---

## Summary

Owner: AI1 and AI2. Produce the numbers for the pitch and find weak suggestions to fix. The method is under AI evaluation in docs/roadmap.md.

## Acceptance Criteria

- [ ] The suggestion endpoint runs on every evaluation case, and its agreement rate with the human labels is recorded.
- [ ] Merges from the IdeaForge prompt and a plain combine-these-notes prompt are compared on at least ten pairs, judged without knowing which prompt produced which.
- [ ] Latency of merge, suggestion, and similarity requests is measured on the deployed app.
- [ ] Results and observed failures are recorded in docs/roadmap.md, with no claims beyond what was measured.
