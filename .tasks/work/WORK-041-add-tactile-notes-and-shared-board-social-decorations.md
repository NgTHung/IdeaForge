---
id: "WORK-041"
title: "Add tactile notes and shared board social decorations"
status: In Progress
priority: "Medium"
type: "Feature"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Extend WORK-039 with visible achievement badges and placeable stickers, brief merge sparks, tactile pickup/drop and pushpin motion, a quick reaction wheel, temporary cursor chat opened with Enter, and additional cluster themes. Cursor messages and reactions expire; decorations are shared, saved, editable, and undoable under existing board write access. Preserve static RGB borders, original notes, and merge source snapshots.

## Acceptance Criteria

- [ ] Achievements remain discoverable with animation effects disabled; earned badges explain their rules and can be placed as board decorations.
- [ ] Merged notes have a distinct visual treatment and successful keeps show brief sparks; dragging lifts and tilts notes with deeper shadows, dropping settles them, and pinning shows a pushpin motion. Motion controls and reduced motion are respected.
- [ ] An accessible quick reaction wheel sends brief named reactions to collaborators; Enter opens cursor chat and submitting shows an expiring message near its sender. Editing controls keep their existing keyboard behavior.
- [ ] Cluster styles include clouds, stars, flowers, and paper alongside existing presets; labels stay readable and styles sync and survive reload.
- [ ] Sticker decorations can be placed, dragged, and removed; collaborators see saved decorations after reconnect, viewers cannot edit them, and undo works without altering notes or merge provenance.
- [ ] Focused tests, lint, typecheck, and build pass; browser checks record live collaboration, persistence, keyboard behavior, and any unverified behavior.
