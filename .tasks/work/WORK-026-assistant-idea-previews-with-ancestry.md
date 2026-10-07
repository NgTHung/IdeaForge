---
id: "WORK-026"
title: "Assistant idea previews with ancestry"
status: "In Progress"
priority: "Low"
type: "Feature"
parent: "WORK-021"
depends_on: ["WORK-025", "WORK-009", "WORK-010"]
risk: "Medium"
impact: "Adds ghost ideas to the canvas and creates ideas with parents and source snapshots."
tags: ["enhancement", "ready-for-agent"]
whitepaper: "docs/assistant.md"
last_updated: "2026-10-08"
---

## Summary

Owner: SE1. Show the assistant's create actions as ghost ideas on the canvas, and turn an accepted one into a real idea with ancestry. See Previews on the canvas and Staleness in docs/assistant.md.

## Acceptance Criteria

- [ ] A create action in the chat has Preview, Accept, and Discard buttons, and Preview shows a dashed ghost idea near its source cards, with dashed edges to them, and pans to it.
- [ ] You can edit the ghost idea's title and content before accepting.
- [ ] Accepting adds the idea through the same mutation as a manual idea, with parentIds set to its source cards and a source snapshot of each, in the format work:WORK-010 uses for kept merges.
- [ ] The accepted idea keeps the generated title and content next to the editable ones, and is labeled as created with the assistant.
- [ ] Accepting is blocked when a source card changed or was deleted since the request, and the chat offers to ask again, using the staleness check from work:WORK-009.
- [ ] Discarding removes the ghost without changing the board, and previews stay in the requesting browser.

## Implementation note — 2026-10-07

Create actions have editable local previews, dashed ancestry, source snapshots, accepting-author attribution, generated-text/model/time provenance, parent links, stale-source checks, and latest-board mutation checks. On 2026-10-08, a live shared-board browser test showed a ghost idea with two ancestry edges; accepting an edited title created an assistant-labeled card with both source snapshots and generated text. The card survived reload and guest rejoin. The test did not cover content editing, stale-source rejection, preview isolation across browsers, or discard, so the acceptance criteria remain open.
