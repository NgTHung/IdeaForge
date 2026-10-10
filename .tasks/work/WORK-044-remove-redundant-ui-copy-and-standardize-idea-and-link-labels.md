---
id: "WORK-044"
title: "Remove redundant UI copy and standardize idea and link labels"
status: In Progress
priority: "Medium"
type: "Design"
risk: "Low"
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/design-cleanup.md"
last_updated: 2026-10-10
---

## Summary

Implement the first copy and vocabulary pass from the design cleanup. Simplify entry screens, account menu, assistant, dialogs, and idea cards. Keep board chrome consolidation, design tokens, component extraction, and sample seeding for later passes.

## Acceptance Criteria

- [ ] Entry screens remove redundant eyebrows, taglines, counters, and links; the guest lobby shows real board metadata.
- [ ] The account menu keeps identity, dashboard access, and sign out without placeholder Settings or duplicate Profile views.
- [ ] Board cards and panels remove redundant headings, empty-content filler, duplicate experiment copy, Markdown hints, and assistant reassurance text.
- [ ] Visible labels and accessible names consistently use idea, link, link type, group, Assistant, and Message.
- [ ] Lint, typecheck, and production build pass; browser evidence and unverified paths are recorded.
