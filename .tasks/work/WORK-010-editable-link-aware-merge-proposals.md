---
id: "WORK-010"
title: "Editable, link-aware merge proposals"
status: "To Do"
priority: "High"
type: "Feature"
milestone: "day-2"
depends_on: ["WORK-004", "WORK-011"]
impact: "Changes the merge request and result schemas, the merge prompt, and the preview panel."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-05"
---

## Summary

Owner: AI2 for the prompt and schema, with SE1 for the preview UI. Merge previews become editable, use the link between the two cards, and can't overwrite newer text. See Merge rules in docs/decisions.md.

## Acceptance Criteria

- [ ] You can edit a proposal's title and concept before keeping it, **Regenerate** requests a new proposal, and the original generated proposal is stored with the kept card.
- [ ] When the two selected cards are linked, the merge request includes the link type and explanation, and merging a conflicts-with pair proposes a concept that addresses the stated condition.
- [ ] The proposal lists the assumptions the concept introduces, alongside each source's contribution and the tension.
- [ ] A proposal can't be kept if either source card's text changed since generation, and the UI offers to regenerate it, using the same staleness check as suggested links.
- [ ] The kept card's source snapshot stores the goal, the model, and the generation time.
