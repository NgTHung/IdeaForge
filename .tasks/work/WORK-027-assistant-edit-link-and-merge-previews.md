---
id: "WORK-027"
title: "Assistant edit, link, and merge previews"
status: "In Progress"
priority: "Low"
type: "Feature"
parent: "WORK-021"
depends_on: ["WORK-025", "WORK-009", "WORK-010", "WORK-014"]
impact: "Lets accepted assistant actions edit cards, add relationships, and start merges."
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/assistant.md"
last_updated: "2026-10-08"
---

## Summary

Owner: SE1. Show the assistant's edit, link, and merge actions as previews and apply them through the existing board and merge flows. See Previews on the canvas and Staleness in docs/assistant.md.

## Acceptance Criteria

- [ ] An edit preview shows the proposed title and content next to the current ones, and accepting replaces them through the same mutation as a manual edit.
- [ ] An edit can't be accepted while another person is editing that card, using the lock from work:WORK-014.
- [ ] A link preview shows a dashed edge with its type and explanation, you can change both before accepting, and accepting adds the relationship through the same mutation as a manual link.
- [ ] A merge action highlights both cards, and accepting opens the merge flow from work:WORK-010 with that pair selected.
- [ ] Every action is blocked when a card it names changed or was deleted since the request, using the staleness check from work:WORK-009.
- [ ] Discarding an action leaves the board unchanged.

## Implementation note — 2026-10-07

Edit, link, and merge actions have browser-local preview controls. Acceptance checks current source snapshots inside the latest board mutation; edits also check the shared editing lock. Link drafts support type, explanation, conflict condition, and extends direction changes. Merge acceptance opens the existing selected-pair flow. Stale actions provide a one-click retry with the original question and current board. On 2026-10-08, a live shared-board test previewed and discarded a dashed link without changing the board; the duplicate saved-link action was disabled. Normal link acceptance, edit and merge acceptance, stale-action rejection, and two-browser lock behavior remain unverified, so the acceptance criteria remain open.
