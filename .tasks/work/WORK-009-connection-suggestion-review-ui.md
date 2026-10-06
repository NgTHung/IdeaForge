---
id: "WORK-009"
title: "Connection suggestion review UI"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "day-2"
depends_on: ["WORK-008"]
impact: "Adds per-browser provisional links and a staleness check shared with merge proposals."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-06"
---

## Summary

Owner: SE1. Show AI connection suggestions as provisional links that a person accepts, edits, or dismisses.

The existing createRelationship mutation and Liveblocks adapter support acceptance. The remaining manual-link editing and author work in WORK-004 is outside this task.

## Acceptance Criteria

- [ ] Suggestions run automatically across the board after two seconds without saved text or goal changes, show a loading state, and render up to three dashed links with explanations. Movement alone triggers no requests.
- [ ] Accepting creates a normal link through the same mutation as a manual link, and you can change the type or explanation before accepting.
- [ ] Dismissing removes the suggestion without changing the board.
- [ ] A needs-clarification result shows its question and creates no link.
- [ ] Suggestions stay in the requesting browser until accepted.
- [ ] A suggestion can't be accepted if either card's text changed since the request, and the UI offers to regenerate it, using a reusable source-snapshot check inside the board mutation.
- [ ] When the request fails, the error is shown and manual editing keeps working.

- [ ] You can pause automatic suggestions and retry a failed request. Obsolete responses are ignored, and accepting or dismissing a suggestion does not trigger another request.
