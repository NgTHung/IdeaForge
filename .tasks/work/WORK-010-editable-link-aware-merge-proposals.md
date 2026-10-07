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
last_updated: "2026-10-07"
---

## Summary

Owner: AI2 for the prompt and schema, with SE1 for the preview UI. Merge previews become editable, use the link between the two cards, and can't overwrite newer text. See Merge rules in docs/decisions.md.

## Acceptance Criteria

- [x] You can edit a proposal's title and concept before keeping it, **Regenerate** requests a new proposal, and the original generated proposal is stored with the kept card.
- [ ] When the two selected cards are linked, the merge request includes the link type and explanation, and merging a conflicts-with pair proposes a concept that addresses the stated condition.
- [x] The proposal lists the assumptions the concept introduces, alongside each source's contribution and the tension.
- [x] A proposal can't be kept if either source card's text changed since generation, and the UI offers to regenerate it, using the same staleness check as suggested links.
- [x] The kept card's source snapshot stores the goal, the model, and the generation time.

## Implementation note — 2026-10-07

The merge request includes a linked conflict's explanation, direction, and condition; the provider prompt instructs it to address that condition. Mocked route tests verify those fields and prompt rules. A live conflict-pair request returned `502 provider_error` while Featherless TCP 443 was unreachable, so the criterion requiring a successful proposal that addresses the condition stays unchecked.

The canvas and API send a typed link when one exists and instruct Gemini to address a conflict. A live conflict-pair check remains before that criterion is marked complete.
