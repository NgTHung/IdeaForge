---
id: "WORK-004"
title: "Typed relationship links"
status: "In Progress"
priority: "High"
type: "Feature"
milestone: "day-1"
impact: "Adds links to board storage and new edge types to the canvas."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-07"
---

## Summary

Owner: SE1. People connect two cards with a link that says how the ideas relate. The vocabulary and rules are under Relationships in docs/decisions.md.

## Acceptance Criteria

- [ ] Dragging from one card to another creates a link after you choose works well together, conflicts with, or extends.
- [ ] Each link stores its type, an explanation, and its author, and a conflicts-with link asks for the condition under which the ideas conflict.
- [ ] An extends link shows an arrow from the extending card to the extended card, and the other types show no direction.
- [ ] Each type has a distinct color and label, and ancestry edges stay visually distinct from relationship links.
- [ ] You can edit a link's type and explanation, and delete the link.
- [ ] Links sync between browsers on a shared board and survive a reload.

## Implementation note — 2026-10-07

The relationship form now captures a required explanation, author, and conflict condition; selected links can be edited or deleted. The model validates endpoints, duplicates, explanations, and conflict conditions, and removes obsolete conditions when a conflict changes type. Model tests cover these rules. The two-browser sync and reload criterion remains unverified.
