---
id: "WORK-042"
title: "Give note and cluster borders fuller decorative treatments"
status: Done
priority: "Medium"
type: "Feature"
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-10
---

## Summary

Replace the simple Clouds cluster outline with a puffy cloud silhouette, soft shading, small cloud accents, and static decorative details. Add the same cloud treatment to notes and Style previews. At the user's follow-up request, give cat, RGB, stars, flowers, and paper bolder outlines and distinctive cosmetic details too. Offer all decorative presets on notes and clusters, with matching previews. Preserve readable content, shared appearance persistence, accessible controls, and merge provenance.

## Acceptance Criteria

- [x] Cat, RGB, stars, flowers, and paper have stronger distinct treatments on notes, clusters, and previews; plain borders remain readable, and RGB keeps one static alternating multicolor line.

- [x] Cloud clusters have a visibly puffy silhouette and layered cosmetic details that follow member bounds; hiding the boundary hides the cloud decoration while retaining the name.
- [x] Notes offer Clouds in Style and use the same cloud rendering as clusters and previews without covering text, votes, pinning, selection, or editing controls.
- [x] Saved border appearances retain their colors, sync and survive reload, and leave note text, source snapshots, positions, pin state, and cluster membership intact.
- [x] Cloud cosmetics stay static and work in light and dark mode, motion-off mode, narrow layouts, and canvas pan and zoom without intercepting input.
- [x] Relevant appearance tests, lint, typecheck, build, and browser verification pass, with live checks and limitations recorded.

## Implementation

CloudFrame draws uneven puffs around the current note or cluster bounds. Gradient shading, an outer halo, cloud wisps, and sparkles give the outline depth. Notes, clusters, and Style previews share the renderer. Preview measurements use layout pixels through ResizeObserver so zoom does not stretch the puffs. The ornament layer ignores pointer input and is hidden from accessibility tools. Turning off a cluster boundary removes its ornament layer and keeps its heading.

BorderDecorations owns the other preset ornaments. Cats have larger ears with inner shading, whiskers, and paw prints. RGB uses one static alternating multicolor outline, 4px on notes and previews and 6px on clusters, plus small glints. Stars add constellations and star accents. Flowers add petals and leaves. Paper adds tape, a backing sheet, torn edges, and a folded corner. Plain styles use a stronger outline. Notes and clusters share the same validated preset choices, and the Style controls derive their options from those schemas. Older saved identifiers remain valid. No new motion or sound is added.

## Verification

On 2026-10-10, all 174 tests, lint, typecheck, the production build, and diff checks passed. Appearance tests cover the new note presets, JSON persistence, and unchanged text, merge snapshots, votes, and cluster state. The existing shared map writer still saves only changed appearance fields.

Two independently authenticated guests in the T3 production preview used real Liveblocks on the isolated demo board. The six decorative note styles appeared in the other connection and survived reload. Each cluster preset rendered with the matching preview and readable heading. Changing appearance preserved all displayed note titles, content, positions, and pin states. No AI call or mocked provider output was needed.

Browser checks covered light and dark themes, colors and default-color matching between a note and its preview, motion off, and static RGB pseudo-elements. RGB had animation-name none with animations enabled and disabled. Hiding the Clouds boundary removed the cloud frame while retaining the saved group name. A held drag changed the cloud cluster bounds and typed link path together. A cloud note retained its lift and 19px drop shadow while dragging; undo restored its position. Voting and opening the note editor still worked.

A 390px-wide same-origin board iframe checked Clouds, cat, stars, flowers, and paper previews. Their decoration layers ignored pointer input and the previews fit the available width. This used an iframe because prior T3 viewport resizing had failed. Physical devices, other browser engines, signed-in and viewer sessions, fresh reduced-motion emulation, and deployment were not checked. The user's existing next.config.ts change remains unstaged.

The rebuilt browser result is saved outside the repository at /home/bbq/.t3/userdata/browser-artifacts/browser-screenshot-100-102-144-120-mv1uzmjy-0a3d19ad.png.
