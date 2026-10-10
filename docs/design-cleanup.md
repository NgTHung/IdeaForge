# Design cleanup

This note lists the UI clutter that remains and how to remove it. It started from a review of every screen on 2026-10-10 and was rechecked against the source and a live board after `work:WORK-044` shipped. Each item names the file so you can act on it directly. Delete an item once it ships or is rejected.

## Done

`work:WORK-044` finished the copy and vocabulary pass on 2026-10-10. Eyebrow labels that repeated headings, taglines, and reassurance text are gone from every screen. Visible labels and accessible names use idea, link, link type, group, Assistant, and Message. The account menu keeps identity, the dashboard link, and sign out. Entry screens are shorter: the landing page states what IdeaForge does, the guest lobby shows the real board title and description, and character counters appear only near the limit. Idea cards lost the "IDEA" kicker, the "Who?" button, empty-content filler, and the pin emoji; merged ideas keep one ✦ marker, and merge provenance lives in the selection bar. The header voting list is now **Top ideas**, ranked by upvotes, which `docs/decisions.md` records.

## Main problems

Four problems remain. The first causes most of the clutter you see on the board.

1. The board still shows about 15 floating controls at once: the title, a description button, six header controls (**Top ideas**, members, **Share**, account, **Style**, theme toggle), Achievements, Stickers, the Assistant button, three stacked tool groups, React, Message, zoom, Suggested Links, the Liveblocks badge, and the React Flow attribution. Selecting an idea adds a selection bar and a separate "Show only this idea's links" button.
2. The same status appears in up to three places. "Naming groups…" shows in the AI activity pill, in the Organize panel, and in the layout status bar.
3. There is no shared visual system. The CSS uses 682 distinct hex colors, 75 box-shadow values, 36 font sizes, and 30 border radii, and `globals.css` defines no variables. Five stylesheets each declare `font-family: Arial` and their own page background.
4. Every new shared board starts with five sample ideas about student study rooms. See [New boards start with sample ideas](#new-boards-start-with-sample-ideas).

## Board

The board is where most clutter lives. The target layout below groups the remaining board items into one plan.

### Target layout

Give every control a fixed zone, and show a control only when it applies to what the user is doing. Four groups stay on screen all the time; everything else appears with a selection, opens from a menu, or lives in the Assistant panel. This cuts the always-visible controls from about 15 groups to 4.

| Zone | Always visible | Moves here | Leaves |
| --- | --- | --- | --- |
| Top left | Logo (links to dashboard), editable title | Board description as a tooltip or subtitle | Description info button |
| Top right | Member avatars, **Top ideas**, **Share**, **Assistant**, account | Suggestion count as a badge on **Assistant** | **Style**, theme toggle, Suggested Links box |
| Left toolbar | Select, Pan, Add idea, Connect, Draw, Decorate | Pencil and eraser in a Draw popover; stickers, achievements, and reactions in a Decorate popover | Merge tool, Organize, "DRAW" label, Assistant button |
| Bottom right | Zoom, fit, undo, redo | Undo and redo from the toolbar | React and Message chips |
| Bottom center | Nothing until something is selected | Selection actions: Edit, Style, Pin, Show only its links, Delete; **Merge** when 2 to 8 ideas are selected | Separate "Show only this idea's links" button |
| Right panel | Closed by default | Assistant chat, link suggestions, Organize | Separate Suggested Links and Organize panels |
| Top center | Nothing until there is news | One toast area for AI progress, link copied, earned stickers, and errors | AI activity pill, layout status bar, share notice, accepted-link notice |

Personal preferences (theme, accent, cursor, reaction and animation choices, background) move to a **Preferences** item in the account menu, or a gear in the toolbar for guests. Shared styling for an idea, link, or group opens from **Style** in the selection bar, so the panel never shows controls for something that is not selected.

Keep the R and Enter shortcuts for reactions and cursor messages, and list all shortcuts in a **?** popover in the bottom-right group.

Whether Decorate stays a main toolbar button depends on whether stickers, achievements, reactions, and cursor messages are part of the demo pitch. If they are not, put Decorate behind a menu.

### Header and floating controls

- Move the theme toggle (`board-app.tsx:1382`) into the Style panel, which already has a Theme control.
- Group Achievements and Stickers (`board-app.tsx:1386`) under one Decorate control.
- Move React and Message (`board-social.tsx:74-75`) off the canvas. Their shortcuts already work.
- Show the board description through the title instead of the info button (`board-app.tsx:1369`). When the description is empty, hide it rather than show "No description was added for this board."
- Move "Show only this idea's links" (`board-app.tsx:1556`) into the selection bar.
- Hide the Liveblocks badge if the plan allows it, and use React Flow's `proOptions.hideAttribution` only if your license permits.

### Toolbar

- Combine the main tools and drawing tools into one bar and drop the "DRAW" label (`board-app.tsx:1479`).
- Icons still mix Unicode glyphs (↖ ✋ ＋ ⌁ ⧉ ▦ ◐), emoji (🏅), and SVG (pencil, eraser, undo, pin). Replace them with one SVG icon set.
- The Assistant button and the brand mark both use ✳. Give the Assistant its own icon.

### Idea cards

- The heart and a "0" count show on every card before anyone votes. Consider showing the heart on hover or selection until the idea has a vote.

### Dialogs

- The auto-place checkbox in the new-idea dialog (`board-app.tsx`, `board-auto-place-toggle`) has a two-line explanation. Move this preference to the Organize panel, where groups live.

### Merge preview

- The "Review selected links" and "Review existing links" blocks (`board-app.tsx:1578`, `1625`) render the same list with copied markup. They appear in different preview states, so users see only one, but extract one component.
- The action row has five buttons: Discard, Edit, Regenerate, Change sources, Create merged idea. Move Regenerate and Change sources into a secondary menu.
- "Read full concept" (`board-app.tsx:1589`, `1650`) is the last use of "concept". Change it to "Read more".

### Organize panel and status

- Show AI progress in one place: the toast area from the target layout. Remove the duplicate progress lines from the Organize panel and the layout status bar (`board-organize-progress` and `board-layout-status` in `board-app.tsx`).

### Style panel

- The panel still mixes personal settings with shared object styling. Split it into **Preferences** and **Style selected**, as the target layout describes.

## Dashboard

- The "Recently edited" featured card repeats a card that is also in the grid. With one or two boards it doubles the content. Show it only when the user has more boards than fit in one row.

## Flows

Every flow works end to end, but the order of steps does not follow the product's purpose: collect ideas, then merge them. The start is slow, merging is one tool among six, four AI features run as separate flows, and nothing marks a session as finished.

### Getting to a first idea

A new user clicks **Create board**, signs in, fills a two-field form, and lands on a board that already holds five sample ideas. Adding their own idea takes the Add tool, a click on the canvas, and a modal dialog. The board's empty state ("Your board is ready") never shows because boards are seeded.

- Start new boards empty (see the next section) so the empty state and its **Add your first idea** button become the first step.
- Let a double-click on empty canvas create an idea, and edit the title in place on the card. Keep the dialog for long content.
- Make the board title the only required field on `/boards/new`, or create the board straight away with a default title the user can rename in the header.

### Coming back

Signed-in users who open `/` see the Create and Join cards. Their boards are reachable only through the account menu, and the board logo links to `/` (`board-app.tsx:1365`), not the dashboard. Send signed-in users from `/` to `/dashboard`, and point the board logo there too.

The **Join a board** card asks for a link or ID. People usually follow the link directly, so make it a small link under the Create button.

### Merging

Merging has three entry points with different rules. The Merge tool selects on click. Shift-click in Select mode starts a merge set instead of a normal multi-selection (`board-app.tsx:1419`), so you cannot select several ideas to move or delete them. **Add to merge** in the selection bar switches tools. After a merge set exists, a plain click on another idea also adds it.

- Use Shift-click for ordinary multi-selection, and show **Merge** in the selection bar when two to eight ideas are selected. Drop the separate Merge tool.
- Remove the ↑ and ↓ reorder buttons on merge chips unless source order changes the result in a way users can see.
- The Assistant's merge action already hands off to the same merge tray. Keep every merge path ending in that one preview.

### AI features

There are four AI flows, each with its own UI: the Assistant side panel, the Suggested Links panel, the Organize panel, and the merge preview. The Assistant can also propose links and merges, overlapping the other two. Keep the Assistant as the single AI surface, and show link suggestions and Organize as sections or actions inside it.

### Finishing

The flow has no end. Voting is social, not a decision, and the planned AI-drafted wrap-up (`WORK-038`) is the right place to close a session. Give it a fixed spot in the header once it ships.

### Sharing and access

**Share** copies the URL. Guests then see a name page and join with edit access. The share action does not say who can edit. Show the access level next to the copied-link notice, and add a view-only link only if the team needs it for the demo.

## New boards start with sample ideas

Every shared board, including one a signed-in user creates with their own goal, is seeded with the five student-collaboration sample ideas from `fixtures.ts` (`shared-board.tsx:23-24`). A user who typed "Q3 marketing plan" lands on "Shared study rooms" and "Peer matching". Start authenticated boards empty with the existing empty state, and keep the samples only for a demo board, if one is still wanted. This changes product behavior, so record the decision in `docs/decisions.md`.

## Visual system

The stylesheets define every value inline, so screens drift apart and dark mode needs separate overrides for each color. Add a small token set to `src/app/globals.css` and replace literal values as you touch each stylesheet.

- Colors: about 12 variables for surface, raised surface, border, text, muted text, accent, accent text, danger, and the five group colors, with dark values under `[data-theme="dark"]`.
- Type: four or five sizes (12, 14, 16, 20, 32 px) and one `font-family` on `body`. Replace Arial with a deliberate choice such as the system UI stack or a `next/font` face.
- Radius: three values (6, 10, 16 px) plus `999px` for pills.
- Shadow: two or three elevation levels.

The brand header is built four times with separate CSS: `landing-header`, `board-page-header`, `guest-entry-header`, and `auth-brand`. Extract one `BrandLink` component and one header layout.

## Code structure

These items are not visible to users, but they explain why the UI drifts: each change touches long, dense lines in one large file.

- `board-app.tsx` is 1,696 lines with about 70 `useState` calls. Its JSX packs whole components into single lines; the selection bar is one long line (`board-app.tsx:1559`). Extract the merge preview, merge details, assistant sources, Organize panel, edit dialog, link dialog, selection bar, and tool dock into their own files.
- Merge validity is computed in `generateMerge` (`board-app.tsx:610`), again for the warnings (`1549`), and again for the button's `disabled` (`1554`). Move it into one function in `merge-board.ts`.
- The 4,000-character limit appears as a literal 19 times in `board-app.tsx`. Import it from `@/lib/ideas` with the other merge limits.

## Docs

The docs folder mixes reference docs with finished implementation plans. `assistant-implementation-plan.md`, `auto-cluster-bubble-layout-plan.md`, `cluster-organize-plan.md`, `gemini-cluster-names-plan.md`, and `merge-two-ideas-implementation-plan.md` describe planned work, which `docs/writing-style.md` says belongs in the roadmap or tasks. Fold any still-true content into `assistant.md` or `decisions.md` and delete the rest.

The Verified section of `docs/roadmap.md` is a long dated changelog. Keep one line per feature with its latest verification date and move the history to git or the task files.

## Suggested order

1. Board chrome, moves only: put the theme toggle in Style, group Achievements and Stickers under Decorate, move React and Message off the canvas, move undo and redo next to zoom, and drop the description button and "DRAW" label.
2. Selection bar: move the links toggle and Style into it, replace the Merge tool with **Merge** for multi-selection, and make Shift-click a normal multi-selection.
3. Stop seeding sample ideas into new authenticated boards, after logging the decision.
4. Flow fixes: send signed-in users to the dashboard, point the board logo there, and add double-click to create.
5. Move Suggested Links and Organize into the Assistant panel, and replace the status surfaces with one toast area.
6. Add design tokens and the shared brand header.
7. Split `board-app.tsx` into components as each area above is touched.
