---
id: "WORK-003"
title: "Display names and card authors"
status: "In Progress"
priority: "High"
type: "Feature"
milestone: "day-1"
impact: "Changes the Idea type, Liveblocks storage and presence types, and the guest join flow."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-07"
---

## Summary

Owner: SE2. Collaboration should show who contributed which idea, not only that several browsers are connected. Guests are currently named after their ID, such as Guest 1a2b.

## Acceptance Criteria

- [ ] Joining a shared board asks for a display name, and the browser remembers it for later visits.
- [ ] The board shows the names of everyone currently connected.
- [ ] Each new card stores its author's guest ID and display name, and the card shows the name.
- [ ] A kept merged card records the authors of its source cards and shows them as contributors.
- [ ] The local board works without a name prompt.

## Implementation note — 2026-10-07

Assistant-created cards use the accepting person's display name, and assistant source snapshots preserve each source author's name. The existing guest-name, active-member, card-author, and merge-contributor paths are present. This pass did not verify those flows in a browser, so the acceptance criteria remain open.
