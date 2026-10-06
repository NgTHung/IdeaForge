---
id: "WORK-028"
title: "Evaluate the board assistant"
status: "To Do"
priority: "Low"
type: "TestDebt"
parent: "WORK-021"
depends_on: ["WORK-024", "WORK-007"]
impact: "Records citation accuracy, injection resistance, and latency for the assistant."
tags: ["enhancement", "ready-for-human"]
whitepaper: "docs/assistant.md"
last_updated: "2026-10-06"
---

## Summary

Owner: AI2. Measure whether the assistant cites cards correctly and stays within the board before it ships. The checks are under Evaluation in docs/assistant.md.

## Acceptance Criteria

- [ ] At least 15 messages against a seeded board are stored in the repository with the replies and a team member's judgment of each citation.
- [ ] The cases include a question no card answers, a card containing instructions, and mixed Vietnamese and English cards.
- [ ] Proposed links and merges are judged against the relationship and merge rules in docs/decisions.md.
- [ ] The citation accuracy, the observed failures, the model, and the reply latency on the deployed app are recorded in docs/roadmap.md.
