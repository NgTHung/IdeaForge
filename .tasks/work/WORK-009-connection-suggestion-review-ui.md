---
id: "WORK-009"
title: "Connection suggestion review UI"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "day-2"
depends_on: ["WORK-004", "WORK-008"]
impact: "Adds per-browser provisional links and a staleness check shared with merge proposals."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-05"
---

## Summary

Owner: SE1. Show AI connection suggestions as provisional links that a person accepts, edits, or dismisses.

## Acceptance Criteria

- [ ] **Suggest connections** on a selected card shows a loading state, then the suggestions as dashed links with their explanations.
- [ ] Accepting creates a normal link through the same mutation as a manual link, and you can change the type or explanation before accepting.
- [ ] Dismissing removes the suggestion without changing the board.
- [ ] A needs-clarification result shows its question and creates no link.
- [ ] Suggestions stay in the requesting browser until accepted.
- [ ] A suggestion can't be accepted if either card's text changed since the request, and the UI offers to regenerate it, using the same staleness check as merge proposals.
- [ ] When the request fails, the error is shown and manual editing keeps working.
