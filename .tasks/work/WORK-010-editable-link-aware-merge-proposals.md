---
id: "WORK-010"
title: "Editable, link-aware merge proposals"
status: "In Progress"
priority: "High"
type: "Feature"
milestone: "day-2"
depends_on: ["WORK-004", "WORK-011"]
impact: "Changes the merge request and result schemas, the merge prompt, and the preview panel."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-08"
---

## Summary

Owner: AI2 for the prompt and schema, with SE1 for the preview UI. Merge previews support 2–8 notes, use links among the selected notes, and can't overwrite newer text. See Merge rules in docs/decisions.md.

## Acceptance Criteria

- [x] You can edit a proposal's title and concept before keeping it, **Regenerate** requests a new proposal, and the original generated proposal is stored with the kept card.
- [x] Merge 2–8 notes through one request; require one distinct contribution per selected source and preserve ordered source snapshots and selected links.
- [x] The merge request includes every typed link among selected notes, including direction and conflict conditions; the Featherless prompt handles those conditions or can return a noncommittable result.
- [ ] A live Featherless proposal successfully addresses selected conflict conditions. Prior live checks were blocked when provider TCP 443 was unreachable; verify the current N-way path when the provider is available.
- [x] The canvas keeps merge mode active while selecting notes, lets people remove and reorder sources, explains selection/text limits, and creates one child with source-count and focusable ancestry.
- [x] The proposal lists the assumptions the concept introduces, alongside each source's contribution and the tension.
- [x] A proposal can't be kept if any source card's text, selected relationship, or board goal changed since generation; the UI offers regeneration.
- [x] The kept card's source snapshot stores the goal, the model, and the generation time.
- [x] New merge prompts target concise concepts and per-source contributions in the notes' language; the preview leads with the concept and first experiment while expandable sections retain all reasoning and source snapshots.

## Implementation note — 2026-10-07

The two-note flow was extended on 2026-10-08 to accept 2–8 selected notes. The route validates unique source IDs and typed endpoint pairs, total and per-note text limits, and exact per-source contribution IDs. New merge records use version 2 and preserve all selected source snapshots and typed links; a display normalizer keeps version-1 records readable. The canvas adds removable, reorderable chips, a change-sources action, source count, and focusable ancestry. Lint, typecheck, and build status are recorded in `docs/roadmap.md` after this pass. A live Featherless merge and shared-room N-way persistence have not been verified.

Previously, the merge request carried a linked conflict's explanation, direction, and condition, and the provider prompt instructed it to address that condition. A live conflict-pair request returned `502 provider_error` while Featherless TCP 443 was unreachable, so the live criterion remains open.

On 2026-10-08, the preview changed to a compact read-first view with an explicit edit mode, a visible conflict reminder, expandable reasoning, and a pinned action footer. Saved merge details collapse source snapshots and generated reasoning separately. The prompt asks Featherless for short outputs in the source language while preserving the existing response and storage contracts. The temporary local server returned HTTP 200. Browser automation failed to initialize with OS error 3, so the target viewport checks and live provider response lengths remain unverified.
