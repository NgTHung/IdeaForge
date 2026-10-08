---
id: "WORK-033"
title: "Render note and AI text as Markdown"
status: "In Progress"
priority: "Medium"
type: "Feature"
impact: "Changes note editing and user-facing AI text rendering while preserving stored source strings."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-08"
---

## Summary

People can format idea content and AI-generated explanations with Markdown. Structured AI endpoints keep their JSON envelope, and saved source text remains unchanged for collaboration and merge ancestry.

## Acceptance Criteria

- [ ] Idea text and user-facing AI text render supported Markdown consistently.
- [ ] Raw HTML is not rendered, and links use safe URL handling.
- [ ] AI prompts request Markdown for user-facing prose fields while keeping titles and labels plain text.
- [ ] Editing, collaboration, and merge snapshots preserve the original Markdown source.
- [ ] Existing plain-text content continues to display as before.
