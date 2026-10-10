---
id: "WORK-044"
title: "Remove redundant UI copy and standardize idea and link labels"
status: Done
priority: "Medium"
type: "Design"
risk: "Low"
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/design-cleanup.md"
last_updated: 2026-10-10
---

## Summary

Implement the first copy and vocabulary pass from the design cleanup. Simplify entry screens, account menu, assistant, dialogs, and idea cards. Show voters through the vote count and rank the header overview by existing upvotes. Keep board chrome consolidation, design tokens, component extraction, and sample seeding for later passes.

## Acceptance Criteria

- [x] Entry screens remove redundant eyebrows, taglines, counters, and links; the guest lobby shows real board metadata.
- [x] The account menu keeps identity, dashboard access, and sign out without placeholder Settings or duplicate Profile views.
- [x] Board cards and panels remove redundant headings, empty-content filler, duplicate experiment copy, Markdown hints, and assistant reassurance text.
- [x] Visible labels and accessible names consistently use idea, link, link type, group, Assistant, and Message.
- [x] Lint, typecheck, and production build pass; browser evidence and unverified paths are recorded.

## Verification

On 2026-10-10, lint, typecheck, and the production build passed. Eighteen focused tests passed in `idea-voting.test.mjs`, `merge-board.test.mjs`, and `board-social.test.mjs`. The tests cover voting identity and persistence, merge source snapshots, and social contracts.

The T3 browser used `100.102.144.120` to inspect the rebuilt production app. Checks covered the shorter landing page, sign-in and sign-up, real MongoDB board metadata in the guest lobby, the hidden name label, one sign-in link, and hidden short-name counters. A fresh Liveblocks room verified plain cards without kickers, blank content without filler, SVG pin markers, the edit dialog without a Markdown hint, positive vote counts opening named voters, and Top ideas ordering the voted idea first. Assistant and Style checks confirmed the shorter empty state, consistent accessible names, one privacy notice, and Color and Border labels.

Landing, login, and guest entry fit a 390px-wide same-origin iframe without horizontal overflow. Native preview resizing timed out. Signed-in account, dashboard, and board-creation flows, live AI generation, other browser engines, and deployment were not rechecked. Merge preview copy was reviewed in the source; no canned AI result was used.

## Remaining cleanup

`docs/design-cleanup.md` retains board control consolidation, shared design tokens and headers, component extraction, sample seeding, status consolidation, and the remaining flow changes. This pass changes visible copy and presentation; stored object identifiers and provider request contracts keep their existing names.
