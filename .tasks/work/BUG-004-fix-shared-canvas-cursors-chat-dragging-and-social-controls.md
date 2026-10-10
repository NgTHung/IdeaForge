---
id: "BUG-004"
title: "Fix shared canvas cursors, chat, dragging, and social controls"
status: In Progress
priority: "High"
type: "Bug"
tags: ["bug", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Fix the interaction problems reported after WORK-041: cursor messages must follow their sender, active remote cursors must be visible, social controls must not overlap zoom or selection controls, R must open the reaction wheel, routed links must follow live note positions, and pinning must prevent manual dragging as well as automatic layout movement. Keep shared access, temporary message expiry, and merge provenance intact.

## Acceptance Criteria

- [ ] Temporary chat follows local and remote cursor positions through movement, pan, and zoom, and still expires.
- [ ] Active collaborators show a named cursor at the correct board position; cursor cleanup and Liveblocks presence work across independent connections.
- [ ] React and Chat remain usable without overlapping zoom or selection controls; R opens the wheel without hijacking typing, modifiers, or dialogs.
- [ ] Relationship and ancestry paths use live drag positions and stay attached before, during, and after a drag.
- [ ] Pinned notes cannot be dragged or moved through a stale drag commit; unpinning restores movement and original notes and snapshots remain intact.
- [ ] Focused regression tests, lint, typecheck, build, and live browser checks pass, with limitations recorded.
