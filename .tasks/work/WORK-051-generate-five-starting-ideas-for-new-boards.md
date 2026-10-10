---
id: "WORK-051"
title: "Generate five starting ideas for new boards"
status: Done
priority: "High"
type: "Feature"
risk: "Medium"
impact: "Adds server generation and shared initial notes to newly created boards."
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/auto-generate-board-ideas-plan.md"
last_updated: 2026-10-10
---

## Summary

New boards should open immediately and receive five editable AI notes that explore distinct approaches to the saved board title and description. The generation flow must leave existing boards and manual notes intact. The implementation follows `docs/auto-generate-board-ideas-plan.md` and the 2026-10-10 decision log entry.

## Acceptance Criteria

- [x] New directory-backed boards start without demo notes and automatically request five ideas after opening.
- [x] The server validates the saved board and owner, generates a wider candidate pool through the configured text provider, and selects five distinct approaches.
- [x] The five ideas enter Liveblocks together as editable notes with visible AI provenance; repeated or concurrent requests do not duplicate them.
- [x] Provider failure leaves the board usable and offers a retry. A changed board title cannot save stale results.
- [x] Focused checks, lint, typecheck, and build pass. Live provider and collaboration checks are reported when credentials are available.

## Verification

On 2026-10-10, 18 focused board-directory and starter-idea checks passed. The checks cover candidate selection, a two-call generation pipeline, note provenance, one room commit, a concurrent MongoDB claim, and a stale board title. `npm run lint`, `npm run typecheck`, and `npm run build` passed. Live Featherless calls covered campus food waste, first-year study groups, apartment neighbors, and a Vietnamese dining-hall board. The first Vietnamese set repeated an incentive mechanism; a prompt revision separated rewards and contests into one family, and the next run returned demand planning, serving changes, redistribution, composting, and messaging. Two attempts timed out once and succeeded on retry. `scripts/verify-starter-ideas-server.mjs` created and removed a temporary development-board record while checking a real MongoDB claim, provider output, and completion. `scripts/verify-starter-ideas.mjs` created and removed an isolated Liveblocks room while checking five shared notes, duplicate prevention, edit sync, and reconnect across clients.

The signed-in board-creation UI was not exercised in a browser. The local browser tool failed during sandbox setup, so loading and retry notices were checked through code, types, and the production build. The `taskroot` executable was absent from PATH; this task file was updated directly and taskroot validation could not run.
