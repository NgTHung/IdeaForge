---
id: "WORK-038"
title: "Generate descriptions for title-only notes"
status: "In Progress"
priority: "Medium"
type: "Feature"
risk: "Medium"
impact: "Adds server-side AI generation and conditional board edits when a participant saves a new note with only a useful title."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-09"
---

## Summary

When you save a new note with a useful title and no content, generate a concise description using the board goal and show it on the note. Keep the participant's note intact if generation fails or its input changes before the response arrives. Follow the implementation plan in `docs/title-only-note-description-plan.md`.

## Acceptance Criteria

- [x] Saving a new, non-placeholder note with a title and blank content starts one server-side model request; notes with manual content, existing-note edits, and the untouched placeholder skip generation.
- [x] The route accepts only bounded, validated title and board-goal input and returns either a concise grounded description or a clarification question; malformed input and provider errors return safe responses.
- [x] The route uses the shared Featherless generation module, keeps provider credentials server-side, and does not read or write board storage.
- [ ] A response updates the note only when it still exists with the submitted title, blank content, unchanged board goal, current request, and write access; manual edits and stale responses are preserved.
- [x] Generated description content stores model, time, title, goal, and generated-text provenance; older notes without provenance continue to load.
- [ ] Pending and error states are visible and accessible, retry is explicit, and reloading or receiving a shared-board update does not trigger another provider call. Pending and reload behavior were verified in a live browser; the error, retry, and remote-update paths remain to be checked in the browser.
- [ ] Automatic placement, when enabled, runs once against the final available note text and retains the existing grouping staleness and drag guards.
- [x] Focused tests cover route validation, provider errors, generation outcomes, stale-response guard behavior, and provenance updates; lint, typecheck, and production build pass.
- [x] The decision log and roadmap record the implementation and distinguish mocked checks from provider or shared-board behavior verified live.

## Implementation note

The `taskroot` CLI was unavailable in the implementation environment. This task was added using the repository's existing task format and must be checked with `taskroot validate` when the CLI is available.

The live browser saved a title-only note to a temporary shared board and received one real Featherless description. The text and model provenance survived reload, and a second note with manual content caused no provider request. Server-side Liveblocks storage held both notes and the provenance. The temporary test room was deleted. The repository's separate `verify-liveblocks-history.mjs` script failed in its existing delete/undo scenario because it later attempted to edit note `a` after deleting it; that failure is outside this feature's save path.
