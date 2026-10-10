---
id: "WORK-041"
title: "Add tactile notes and shared board social decorations"
status: Done
priority: "Medium"
type: "Feature"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Extend WORK-046 with visible achievement badges and placeable stickers, brief merge sparks, tactile pickup/drop and pushpin motion, a quick reaction wheel, temporary cursor chat opened with Enter, and additional cluster themes. Cursor messages and reactions expire; decorations are shared, saved, editable, and undoable under existing board write access. Preserve static RGB borders, original notes, and merge source snapshots.

## Implementation

Achievements use a persistent visible control with earned badges, rules, and placement actions. The collection remains available when achievement notifications are disabled. Starter stickers and earned badges place independent decorations on the canvas. Editors can drag them, move them with arrow keys, and remove them with a button or Delete. The optional Liveblocks decoration map initializes on the first placement in older rooms. Notes, relationships, drawings, and decorations reuse the same field and map writer; deliberate changes retain current-client undo history.

The reaction wheel supports six choices, arrow-key navigation, Enter, and Escape. Cursor chat opens with Enter on the canvas or its Chat button; Enter in text fields and focused interactive controls keeps its existing behavior. Liveblocks room events carry validated positions and short messages. Reactions expire after three seconds and chat after six seconds. Each browser keeps at most twenty active events and suppresses duplicate connection/event IDs. Messages render as plain text and have no saved history.

Merged notes show a gold spark badge. Successful keeps produce a brief twelve-particle burst. Dragging lifts and tilts the inner note surface and deepens its shadow. Dropping settles over 360 ms, and pinning moves the pushpin over 430 ms. These effects use the existing motion preference and reduced-motion state. New cluster presets reuse saved labels and bounds; RGB borders remain static.

## Verification

Verified on 2026-10-10 against the production build at the Tailscale address through the T3 shared browser. The demo uses the isolated WORK-046 room. HTTP checks seeded the existing guest cookies because normal production cookies are secure; no production authentication settings changed.

- All 170 tests passed, including seven new social and decoration tests. They cover payload limits, expiry and deduplication, immutable decoration changes, saved snapshots, theme validation, keyboard guards, and shared object identity and field removal. Lint, typecheck, build, and diff checks passed.
- `node scripts/verify-board-social.mjs` passed against real Liveblocks in an isolated room and deleted that test room afterward. It verified two-client named events, viewer read access, lazy decoration storage, placement and movement undo/redo, deletion, reconnect, and unchanged original notes.
- Two T3 browser tabs received named reactions and cursor messages and synchronized decorations and all four additional cluster presets. Enter opened and submitted cursor chat; chat expired. The wheel accepted arrow navigation and Enter. Enter in the note textarea added a newline without opening cursor chat.
- Saving a real note earned First spark. Its sticker placed on the shared canvas. A real provider merge across saved clusters earned Unexpected combo and produced twelve spark particles. The merge retained all three original notes and exact title/content source snapshots. Reload restored both earned badges, both placed decorations, themes, and the merged note without replaying merge or pin animations.
- T3 evaluation of mouse and pointer events checked drag transforms, shadows, the 360 ms settle, the 430 ms pushpin, saved sticker dragging, and arrow-key movement. Some T3 locator clicks missed elements inside transformed canvas containers, so those checks used DOM events or measured coordinates. Turning animations off removed all active animations and the note lift while leaving achievements visible. Dark and light desktop views rendered the saved themes and merge badge.
- Mobile resizing timed out in the T3 preview and temporarily disconnected its automation host; the new mobile layout was not exercised. A fresh reduced-motion device emulation, signed-in sessions, viewer browser controls, other browser engines, and production deployment were not exercised. Viewer permissions were checked through Liveblocks and guarded in both the UI and storage mutation. The effects share the existing reduced-motion state.

## Acceptance Criteria

- [x] Achievements remain discoverable with animation effects disabled; earned badges explain their rules and can be placed as board decorations.
- [x] Merged notes have a distinct visual treatment and successful keeps show brief sparks; dragging lifts and tilts notes with deeper shadows, dropping settles them, and pinning shows a pushpin motion. Motion controls and reduced motion are respected.
- [x] An accessible quick reaction wheel sends brief named reactions to collaborators; Enter opens cursor chat and submitting shows an expiring message near its sender. Editing controls keep their existing keyboard behavior.
- [x] Cluster styles include clouds, stars, flowers, and paper alongside existing presets; labels stay readable and styles sync and survive reload.
- [x] Sticker decorations can be placed, dragged, and removed; collaborators see saved decorations after reconnect, viewers cannot edit them, and undo works without altering notes or merge provenance.
- [x] Focused tests, lint, typecheck, and build pass; browser checks record live collaboration, persistence, keyboard behavior, and any unverified behavior.
