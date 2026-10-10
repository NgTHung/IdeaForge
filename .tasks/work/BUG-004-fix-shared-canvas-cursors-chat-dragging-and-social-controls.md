---
id: "BUG-004"
title: "Fix shared canvas cursors, chat, dragging, and social controls"
status: Done
priority: "High"
type: "Bug"
tags: ["bug", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Fix the interaction problems reported after WORK-041: cursor messages must follow their sender, active remote cursors must be visible, social controls must not overlap zoom or selection controls, R must open the reaction wheel, routed links must follow live note positions, and pinning must prevent manual dragging as well as automatic layout movement. Keep shared access, temporary message expiry, and merge provenance intact.

## Acceptance Criteria

- [x] Temporary chat follows local and remote cursor positions through movement, pan, and zoom, and still expires.
- [x] Active collaborators show a named cursor at the correct board position; cursor cleanup and Liveblocks presence work across independent connections.
- [x] React and Chat remain usable without overlapping zoom or selection controls; R opens the wheel without hijacking typing, modifiers, or dialogs.
- [x] Relationship and ancestry paths use live drag positions and stay attached before, during, and after a drag.
- [x] Pinned notes cannot be dragged or moved through a stale drag commit; unpinning restores movement and original notes and snapshots remain intact.
- [x] Focused regression tests, lint, typecheck, build, and live browser checks pass, with limitations recorded.

## Verification

On 2026-10-10, all 174 tests, lint, typecheck, and the production build passed. Four new regression tests cover typed and ancestry endpoints during dragging, stale pinned drag commits, chat positions, and shortcut exclusions. The live social script verified independent Liveblocks connections, cursor movement and exit, chat delivery and positions, remote pin synchronization, saved decorations, undo/redo, reconnect, and unchanged source text.

The rebuilt production preview used two guests on the existing isolated demo board. A named cursor remained 28 by 30 screen pixels at different zoom levels. Its displayed position matched the receiver's pan and zoom transform within 0.02 pixels. Capturing pointer movement still published Presence when a note stopped event propagation. Leaving the canvas cleared the cursor, and navigating the sender away removed it from the receiver.

Chat followed a 130 by 50 pixel cursor movement in both browsers, stayed beside the local cursor through zoom and pan, and expired after six seconds. R opened the reaction wheel and did not open it while typing in chat. Regression tests cover modifiers, composition, repeated keys, and blocked dialogs. The social buttons had a 13 pixel gap above zoom controls on desktop and a 390px-wide embedded board. Selection controls stayed above both rows.

The typed link changed during a held drag and stayed attached after release. Unpinning the merged note restored movement; its three ancestry paths followed the drag. Pinning it again removed its draggable state, and a simulated drag left its saved position unchanged. Source snapshots and note text remained intact.

The 390px check used a same-origin board iframe because T3 viewport resizing had failed earlier. Signed-in sessions, physical separate devices, other browser engines, and deployment were not exercised. No new Gemini or generation call was needed for these fixes. The user's existing next.config.ts change was left unstaged.
