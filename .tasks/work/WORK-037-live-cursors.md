---
id: "WORK-037"
title: "Show live board member cursors"
status: "In Progress"
priority: "Medium"
type: "Feature"
impact: "Adds throttled cursor positions to Liveblocks Presence and renders identified cursors over the shared canvas."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-09"
---

## Summary

People need to see where other board members are pointing. Share cursor positions in Liveblocks Presence and show each connected member as a colored dot with their display name.

## Acceptance Criteria

- [x] Moving over the shared canvas updates that member's cursor for other participants in real time.
- [x] Each connected member's cursor uses a stable color and shows their display name.
- [ ] Cursor locations stay aligned when participants use different canvas zoom or pan positions.
- [x] The cursor disappears when a member leaves the canvas or disconnects.
- [x] Cursor updates are throttled and do not write to persistent board storage.
