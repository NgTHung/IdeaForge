---
id: "WORK-039"
title: "Personalize the board with styles and playful animations"
status: "To Do"
priority: "Medium"
type: "Feature"
risk: "Medium"
impact: "Adds personal appearance preferences, named cluster decorations, and animations for board activity."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-09"
---

## Summary

Let participants personalize cursors, notes, relationship lines, and the board UI, and give clusters visible names, colors, and decorative borders. Include cat and rainbow presets so personalization covers shapes and patterns as well as color. This is planned stretch work; see the personalization entry in docs/decisions.md.

Add merge celebrations, upvote reactions, contributor entrances, AI thinking animations, undo time travel, team milestones, tiny achievement stickers, share-link delivery, and board mood. These effects respond to actual board actions and request states. Keep animations brief and optional, and let participants continue working while they play.

Cursor appearance, UI preferences, and animation choices belong to the participant and persist in the current browser. Note, relationship, and cluster styles belong to the board, follow its existing write access, and are visible to collaborators. Achievement stickers persist for the participant and board in the current browser. Keep the existing appearance as the default and provide a reset for each customization.

Extend the existing live cursors (work:WORK-037), typed relationships (work:WORK-004), readable canvas links (work:WORK-032), Markdown notes (work:WORK-033), Organize groups (work:WORK-012), merges (work:WORK-010), and named upvotes (work:WORK-036). Those tasks own their existing behavior and verification; this task adds appearance controls and activity effects without changing note content, relationship meaning, merge provenance, or clustering calculations. Reuse saved cluster labels and rename controls rather than adding another naming flow.

## Acceptance Criteria

- [ ] A Personalization control on the board opens labeled appearance settings with visible previews and a reset to the existing defaults.
- [ ] A participant can choose their cursor color and shape, including a cat preset. Other connected participants see that appearance with the existing display name; pointing stays aligned during pan and zoom, and cursor updates retain the existing throttle and disappearance behavior.
- [ ] An editor can customize a selected note's background color and border preset. Plain, cat, and rainbow presets render without covering Markdown text, author names, votes, editing controls, or selection and lock indicators.
- [ ] An editor can customize relationship line colors and stroke styles. The three relationship types keep readable labels, Extends keeps its direction arrow, and merge ancestry stays visually distinct.
- [ ] An editor can choose each cluster's color and an optional visible boundary with plain, cat, and rainbow border presets, and can hide the boundary to restore the current badge-only appearance.
- [ ] Each cluster shows its saved name on the canvas as a readable group heading near its boundary, including with cat and rainbow borders. Names remain visible when boundaries are hidden. Groups without a saved name show a numbered fallback such as Group 1.
- [ ] Cluster headings reuse the existing saved group label. Manual renames and valid AI naming results update headings and member badges together, sync across shared-board browsers, and survive reload. Long names remain accessible without covering notes or controls.
- [ ] Cluster boundaries follow the current group's note bounds during dragging, pan, zoom, and incremental placement. They leave notes and links clickable and preserve pinned positions, membership, pair scores, and layout spacing.
- [ ] Cluster styles survive renaming and incremental placement while the group identity remains the same. Full Organize creates fresh groups with defaults, so a style is never silently assigned to a different group.
- [ ] UI settings include the existing light/dark theme, an accent palette, and canvas background choices such as plain, dots, and grid. Changing these preferences affects only the current participant's UI.
- [ ] Merge celebration: successfully keeping a merge briefly shows its contributing notes coming together, such as two characters hugging or spinning, then reveals the saved concept. Generating or discarding a preview, a failed save, and loading an existing merge do not trigger a celebration; original notes and source snapshots stay intact.
- [ ] Upvote reactions: adding an upvote produces a brief heart, cheering cat, or happy frog beside the voted note. Removing a vote and loading saved votes do not trigger a reaction, and the animation leaves the vote count and voter list usable.
- [ ] Contributor entrances: a newly connected participant appears in a brief named entrance, such as a parachuting character. The initial member list does not replay entrances, rapid reconnects do not produce repeated arrivals, and multiple entrances do not obscure the canvas.
- [ ] AI thinking animation: a selectable hamster wheel, kneading cat, or idea cauldron accompanies an actual pending AI request. It ends on success, failure, cancellation, or request cleanup, preserves readable request status and errors, and never shows invented progress or a generated result.
- [ ] Undo time travel: a successful undo plays a brief rewind effect on the affected area when known, or on the undo control otherwise. An unavailable undo plays no success effect. The effect preserves the existing history behavior and finishes with the restored state visible.
- [ ] Team milestones: crossing 10 saved ideas or keeping the board's first merge produces a short confetti burst or duck parade. Each milestone celebrates at most once per browser's room session; loading an existing board, reconnecting, and undo/redo do not repeatedly celebrate the same milestone.
- [ ] Tiny achievement stickers: a participant earns First spark for saving their first idea on the board, Unexpected combo for keeping their first merge using notes from different clusters, and Idea gardener for saving five ideas. A compact sticker collection explains each rule, remembers earned stickers for that participant and board in the current browser, and avoids awarding duplicates on reload or redo.
- [ ] Share-link delivery: successfully copying the board link plays a brief pigeon-and-envelope delivery effect near the Share control. Clipboard failure shows the existing error feedback and plays no success animation.
- [ ] Board mood: a small plant grows as saved ideas are added and blooms after a kept merge. Its state derives from saved board activity so reload and reconnect restore the same appearance; it represents participation rather than an AI judgment of idea quality.
- [ ] Personalization settings include a global animation switch and choices for the listed effects. These choices, cursor appearance, and UI preferences survive reload in the current browser for guests and signed-in participants. Note, relationship, and cluster styles sync across two shared-board browsers and survive reload.
- [ ] Older boards with no style data render with the existing defaults. Viewers can change their personal cursor and UI preferences but cannot save changes to shared note, relationship, or cluster styles.
- [ ] Presets and cluster names remain readable in light and dark themes and at supported zoom levels. Controls work with a keyboard, labels convey meaning without color alone, and all effects respect reduced-motion preferences with static feedback. Effects leave pointer input, keyboard focus, note editing, and board navigation usable and do not add sound.
- [ ] Appearance changes leave note text, authorship, relationship types and explanations, merge source snapshots, and kept conclusion snapshots intact. Focused checks verify persistence, defaults, access, animation triggers and cleanup, milestone and sticker deduplication, and these invariants; lint, typecheck, and build pass. Record browser and live Liveblocks checks, including anything left unverified.
