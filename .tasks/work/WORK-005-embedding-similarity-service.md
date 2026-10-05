---
id: "WORK-005"
title: "Embedding similarity service"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "day-1"
depends_on: ["WORK-011"]
impact: "Adds a server module and route that send card text to Gemini embeddings."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-05"
---

## Summary

Owner: AI1. One server module computes card similarity for Organize and connection suggestions. Raw cosine scores between short cards on one goal fall in a narrow range (0.66 to 0.93 in the 2026-10-05 test), so the module compares mean-centered vectors. See Similarity in docs/decisions.md.

## Acceptance Criteria

- [ ] A Zod-validated route accepts the board's cards as IDs and text and returns pairwise similarity scores, with limits on card count and text length.
- [ ] The server embeds card text with gemini-embedding-001 at 768 dimensions through the shared AI module, and an environment variable can change the model.
- [ ] Scores are computed after subtracting the board's mean embedding, and boards below a configurable card count fall back to nearest-neighbor ranks.
- [ ] The route is a thin wrapper, and other server routes can import the similarity module directly.
- [ ] Unchanged card text isn't embedded again within one server process.
