---
id: "WORK-039"
title: "Personalize the board with styles and playful animations"
status: Done
priority: "Medium"
type: "Feature"
risk: "Medium"
impact: "Adds personal appearance preferences, named cluster decorations, and animations for board activity."
tags: ["enhancement", "ready-for-agent"]
last_updated: 2026-10-09
---

## Summary

Let participants personalize cursors, notes, relationship lines, and the board UI, and give clusters visible names, colors, and decorative borders. Include cat and rainbow presets so personalization covers shapes and patterns as well as color. This is stretch work; see the personalization entries in docs/decisions.md.

Add merge celebrations, upvote reactions, contributor entrances, AI thinking animations, undo time travel, team milestones, tiny achievement stickers, share-link delivery, and board mood. These effects respond to actual board actions and request states. Keep animations brief and optional, and let participants continue working while they play.

Cursor appearance, UI preferences, and animation choices belong to the participant and persist in the current browser. Note, relationship, and cluster styles belong to the board, follow its existing write access, and are visible to collaborators. Achievement stickers persist for the participant and board in the current browser. Keep the existing appearance as the default and provide a reset for each customization.

Extend the existing live cursors (work:WORK-037), typed relationships (work:WORK-004), readable canvas links (work:WORK-032), Markdown notes (work:WORK-033), Organize groups (work:WORK-012), merges (work:WORK-010), and named upvotes (work:WORK-036). Those tasks own their existing behavior and verification; this task adds appearance controls and activity effects without changing note content, relationship meaning, merge provenance, or clustering calculations. Reuse saved cluster labels and rename controls rather than adding another naming flow.

## Acceptance Criteria

- [x] A Personalization control on the board opens labeled appearance settings with visible previews and a reset to the existing defaults.
- [x] A participant can choose their cursor color and shape, including a cat preset. Other connected participants see that appearance with the existing display name; pointing stays aligned during pan and zoom, and cursor updates retain the existing throttle and disappearance behavior.
- [x] An editor can customize a selected note's background color and border preset. Plain, cat, and rainbow presets render without covering Markdown text, author names, votes, editing controls, or selection and lock indicators.
- [x] An editor can customize relationship line colors and stroke styles. The three relationship types keep readable labels, Extends keeps its direction arrow, and merge ancestry stays visually distinct.
- [x] An editor can choose each cluster's color and an optional visible boundary with plain, cat, and rainbow border presets, and can hide the boundary to restore the current badge-only appearance.
- [x] Each cluster shows its saved name on the canvas as a readable group heading near its boundary, including with cat and rainbow borders. Names remain visible when boundaries are hidden. Groups without a saved name show a numbered fallback such as Group 1.
- [x] Cluster headings reuse the existing saved group label. Manual renames and valid AI naming results update headings and member badges together, sync across shared-board browsers, and survive reload. Long names remain accessible without covering notes or controls.
- [x] Cluster boundaries follow the current group's note bounds during dragging, pan, zoom, and incremental placement. They leave notes and links clickable and preserve pinned positions, membership, pair scores, and layout spacing.
- [x] Cluster styles survive renaming and incremental placement while the group identity remains the same. Full Organize creates fresh groups with defaults, so a style is never silently assigned to a different group.
- [x] UI settings include the existing light/dark theme, an accent palette, and canvas background choices such as plain, dots, and grid. Changing these preferences affects only the current participant's UI.
- [x] Merge celebration: successfully keeping a merge briefly shows its contributing notes coming together, such as two characters hugging or spinning, then reveals the saved concept. Generating or discarding a preview, a failed save, and loading an existing merge do not trigger a celebration; original notes and source snapshots stay intact.
- [x] Upvote reactions: adding an upvote produces a brief heart, cheering cat, or happy frog beside the voted note. Removing a vote and loading saved votes do not trigger a reaction, and the animation leaves the vote count and voter list usable.
- [x] Contributor entrances: a newly connected participant appears in a brief named entrance, such as a parachuting character. The initial member list does not replay entrances, rapid reconnects do not produce repeated arrivals, and multiple entrances do not obscure the canvas.
- [x] AI thinking animation: a selectable hamster wheel, kneading cat, or idea cauldron accompanies an actual pending AI request. It ends on success, failure, cancellation, or request cleanup, preserves readable request status and errors, and never shows invented progress or a generated result.
- [x] Undo time travel: a successful undo plays a brief rewind effect on the affected area when known, or on the undo control otherwise. An unavailable undo plays no success effect. The effect preserves the existing history behavior and finishes with the restored state visible.
- [x] Team milestones: crossing 10 saved ideas or keeping the board's first merge produces a short confetti burst or duck parade. Each milestone celebrates at most once per browser's room session; loading an existing board, reconnecting, and undo/redo do not repeatedly celebrate the same milestone.
- [x] Tiny achievement stickers: a participant earns First spark for saving their first idea on the board, Unexpected combo for keeping their first merge using notes from different clusters, and Idea gardener for saving five ideas. A compact sticker collection explains each rule, remembers earned stickers for that participant and board in the current browser, and avoids awarding duplicates on reload or redo.
- [x] Share-link delivery: successfully copying the board link plays a brief pigeon-and-envelope delivery effect near the Share control. Clipboard failure shows the existing error feedback and plays no success animation.
- [x] Board mood: a small plant grows as saved ideas are added and blooms after a kept merge. Its state derives from saved board activity so reload and reconnect restore the same appearance; it represents participation rather than an AI judgment of idea quality.
- [x] Personalization settings include a global animation switch and choices for the listed effects. These choices, cursor appearance, and UI preferences survive reload in the current browser for guests and signed-in participants. Note, relationship, and cluster styles sync across two shared-board browsers and survive reload.
- [x] Older boards with no style data render with the existing defaults. Viewers can change their personal cursor and UI preferences but cannot save changes to shared note, relationship, or cluster styles.
- [x] Presets and cluster names remain readable in light and dark themes and at supported zoom levels. Controls work with a keyboard, labels convey meaning without color alone, and all effects respect reduced-motion preferences with static feedback. Effects leave pointer input, keyboard focus, note editing, and board navigation usable and do not add sound.
- [x] Appearance changes leave note text, authorship, relationship types and explanations, merge source snapshots, and kept conclusion snapshots intact. Focused checks verify persistence, defaults, access, animation triggers and cleanup, milestone and sticker deduplication, and these invariants; lint, typecheck, and build pass. Record browser and live Liveblocks checks, including anything left unverified.

## Implementation

The board header opens Style. Personal preferences use one validated browser-storage record with legacy theme migration. Optional appearance fields on notes, relationships, and cluster groups use the existing Liveblocks field writer and undo history. Cursor styles use Presence and keep the existing position throttle and exit cleanup. Cluster decorations reuse saved labels and current note measurements without changing the clustering input or layout. Full names remain available in Style and the existing member badges when a heading needs clipping.

Activity feedback follows successful actions and pending requests. Notifications expire after 2.6 seconds, show at most four at once, and leave pointer input available. The global animation switch disables CSS motion, local physics, and viewport animation. Reduced-motion preferences select the same static feedback. Individual switches control the nine effects. Sticker ledgers are scoped to participant and board; milestone crossings are deduplicated against the loaded board and prior crossings in the mounted room session.

## Verification

Verified on 2026-10-09 against the production build through Tailscale `100.102.144.120`. The T3 preview host reported unavailable, so checks used headless Chromium with Playwright. Isolated Liveblocks rooms used real service credentials. HTTP guest tests seeded the existing guest cookies because the app issues secure cookies; the normal display-name form and room authorization still ran. Successful clipboard copying used a temporary HTTPS proxy with a local certificate and browser certificate bypass. No production configuration changed for these checks.

- All 163 repository tests passed, including eight personalization tests and an expanded incremental cluster assignment test. They cover malformed preferences, defaults, animation persistence, immutable style changes, source snapshots, names and scores, invalid targets, rename and incremental style preservation, achievement rules, mood, and milestone deduplication across undo/redo and initial loading. Existing clustering tests verify fresh groups from full Organize.
- `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`, and `taskroot validate` passed. An obsolete generated Next development validator referencing an absent route was removed before the clean checks; no source route was removed.
- Two independent shared-board browsers verified personal preference isolation and synchronized note, relationship, and cluster styles. Cat cursor shape, color, and display name stayed aligned across different viewport sizes, zoom, and pan. Existing cursor throttling and disappearance logic remains unchanged.
- Real Organize and naming calls produced visible saved group names. Manual renaming updated headings and member badges in both browsers and survived reload. Cat and rainbow boundaries rendered in light and dark themes, followed a dragged member, and left notes and relationship paths clickable. Extends retained its arrow after color and dotted-stroke changes. Boundary hiding retained headings; note, relationship, and cluster resets saved their defaults.
- A real cross-cluster merge preview showed pending AI feedback. Keeping it produced the cat celebration, first-merge milestone, Unexpected combo sticker, and blooming plant. Stored originals and contributing source snapshots matched the original source content. Loading the kept merge did not celebrate again.
- Saved participant-created notes earned First spark and Idea gardener and crossed the ten-idea milestone. Sticker rules and duplicate suppression also passed focused tests. Frog upvotes, successful undo feedback, and a named third-participant entrance worked. The existing loaded roster did not replay entrances.
- Clipboard success copied the actual board URL and showed pigeon delivery. Clipboard failure kept the existing fallback and produced no success effect. A deliberately aborted assistant request showed the hamster while pending, then removed it and kept readable error feedback; this was a simulated transport failure, not mocked AI output.
- Read-only service-issued Liveblocks authorization disabled shared style controls while personal cursor and animation settings remained available. Global motion-off and emulated reduced motion removed note animation. A 390 × 844 viewport kept Style inside the screen and above the toolbar; toggles worked and Escape restored trigger focus. Personal preference reset restored defaults. Reload retained the animation switch, cat cursor preference, and earned First spark sticker without replaying achievement or milestone notices.

Signed-in sessions, other browser engines, and deployed-site behavior were not separately exercised. Guest and signed-in boards use the same preference and shared-style implementation. Kept conclusion snapshots could not be exercised because this checkout has no conclusion storage; appearance updates leave unrelated board fields unchanged. Provider keys remained server-side, and the new effects generated no AI output and added no sound.
