# Design cleanup

This note lists the remaining design cleanup from the source review and browser pass on 2026-10-10. The first copy and vocabulary pass shipped in `work:WORK-044`. The remaining items cover board controls, layout, the visual system, and code structure. Delete an item once it ships or is rejected. Line numbers refer to the original review.

## Main problems

Three patterns still cause most of the clutter.

1. The board shows about 15 floating controls at once. The canvas has a title pill, a description button, a six-button header cluster, Achievements, Stickers, the assistant button, three stacked tool groups, React, Message, zoom, Suggested Links, the Liveblocks badge, and the React Flow attribution. Selecting an idea adds a selection bar and a separate link-visibility button.
2. The same status appears in up to three places. "Naming groups…" shows in the AI activity pill, in the Organize panel, and in the layout status bar (`board-app.tsx:1396`, `1509`, `1530`).
3. There is no shared visual system. The original review found 715 distinct hex colors, 77 box-shadow values, 38 font sizes, and 30 border radii. `globals.css` defines no variables. Five stylesheets each redeclare `font-family: Arial` and their own page background.

## Vocabulary

Use these terms in labels, buttons, empty states, and accessible names. Stored fields and API identifiers keep their existing names.

| Concept | UI term |
| --- | --- |
| Item on the canvas | idea |
| Line between items | link |
| Link category | Link type |
| Result of a merge | merged idea |
| AI side panel | Assistant |
| Spatial group | group |
| Cursor message | Message |

## Board

The board is where most clutter lives. The items below are grouped by area of the screen.

### Target layout

Give every control a fixed zone, and show a control only when it applies to what the user is doing. Four groups stay on screen all the time; everything else appears with a selection, opens from a menu, or lives in the assistant panel. This cuts the always-visible controls from about 15 groups to 4.

| Zone | Always visible | Moves here | Leaves |
| --- | --- | --- | --- |
| Top left | Logo (links to dashboard), editable title | Board description as a tooltip or subtitle | Description info button |
| Top right | Member avatars, **Share**, **Assistant**, account | Suggestion count as a badge on **Assistant** | Vote dropdown, **Style**, theme toggle, Suggested Links box |
| Left toolbar | Select, Pan, Add idea, Connect, Draw, Decorate | Pencil and eraser in a Draw popover; stickers, achievements, and reactions in a Decorate popover | Merge tool, Organize, "DRAW" label, assistant button |
| Bottom right | Zoom, fit, undo, redo | Undo and redo from the toolbar | React and Message chips |
| Bottom center | Nothing until something is selected | Selection actions: Edit, Style, Pin, Show only its links, Delete; **Merge** when 2 to 8 ideas are selected | Separate "Only this node's edges" button |
| Right panel | Closed by default | Assistant chat, link suggestions, Organize | Separate Suggested Links and Organize panels |
| Top center | Nothing until there is news | One toast area for AI progress, link copied, earned stickers, and errors | AI activity pill, layout status bar, share notice, accepted-link notice |

Personal preferences (theme, accent, cursor, reaction and animation choices, background) move to a **Preferences** item in the account menu, or a gear in the toolbar for guests. Shared styling for an idea, link, or group opens from **Style** in the selection bar, so the panel never shows controls for something that is not selected.

Keep the R and Enter shortcuts for reactions and cursor messages, and list all shortcuts in a **?** popover in the bottom-right group.

### Header and floating controls

- Merge the header's theme toggle (`board-app.tsx:1383`) into the Style panel, which already has a Theme control.
- Move Achievements and Stickers (`board-app.tsx:1387`) into one "Decorate" menu, or into the Style panel. They are rarely used and sit next to the board title.
- Move React and Message (`board-social.tsx:74-75`) off the canvas. Their shortcuts (R, Enter) already work, so they could appear in a shortcuts list or the toolbar instead of as two permanent chips.
- Show the board description through the title, for example a tooltip or a line under it, instead of a separate info button. When the description is empty, hide the button rather than show "No description was added for this board."
- Put the "Only this node's edges" toggle (`board-app.tsx:1557`) into the selection bar as a button, and rename it "Show only this idea's links".
- Hide the Liveblocks badge if the plan allows it, and use React Flow's `proOptions.hideAttribution` only if your license permits.

### Toolbar

- The tool dock stacks three groups plus the assistant button down the left edge. Combine the main tools and drawing tools into one bar and drop the "DRAW" label (`board-app.tsx:1480`).
- Icons mix Unicode glyphs (↖ ✋ ＋ ⌁ ⧉ ▦), emoji (📌 🏅), and SVG (pencil, eraser, undo). Glyphs and emoji render differently on each OS. Replace them all with one SVG icon set.
- The assistant button and the brand mark both use ✳. Give the assistant its own icon so it does not read as a home link.

### Selection bar and dialogs

- The auto-place checkbox in the edit dialog (`board-app.tsx:1685-1695`) has a two-line explanation. Move this preference to the Organize panel, where groups live.

### Merge preview

- The "Review selected links" block (`board-app.tsx:1579`) and "Review existing links" block (`board-app.tsx:1631`) render the same list with the same markup. Extract one component and show it in one place.
- The action row has five buttons: Discard, Edit, Regenerate, Change sources, Create merged idea. Move Regenerate and Change sources into a secondary menu.

### Organize panel and status

- Show AI progress in one place: the activity pill. Remove the duplicate progress lines from the Organize panel and the layout status bar.
- "{n} notes · {n} empty skipped" is useful only when something is skipped. Hide the line when nothing is skipped.

### Style panel

- The panel mixes personal settings (theme, cursor, reaction animal, AI thinking animal) with shared object styling (note color, border, group boundary). Split it into **Preferences** and **Style selected**, or show the object section only when something is selected.

## Other screens

### Dashboard

- The "Recently edited" featured card repeats a card that is also in the grid. With one or two boards it doubles the content. Show it only when the user has more boards than fit in one row.

## New boards start with sample ideas

Every shared board, including one a signed-in user creates with their own goal, is seeded with the five student-collaboration sample ideas from `fixtures.ts` (`shared-board.tsx:23-24`). A user who typed "Q3 marketing plan" lands on "Shared study rooms" and "Peer matching". Start authenticated boards empty with the existing empty state, and keep the samples only for a demo board, if one is still wanted. This changes product behavior, so record the decision in `docs/decisions.md`.

## Flows

Every flow works end to end, but the order of steps does not follow the product's purpose: collect ideas, then merge them. The start is slow, merging is one tool among six, four AI features run as separate flows, and nothing marks a session as finished.

### Getting to a first idea

A new user clicks **Create board**, signs in, fills a two-field form, and lands on a board that already holds five sample ideas about student study rooms. Adding their own idea takes the Add tool, a click on the canvas, and a modal dialog. That is three screens and a modal before the first idea of their own, and the board's empty state ("Your board is ready") never shows because boards are seeded.

- Start new boards empty (see the next section) so the empty state and its **Add your first idea** button become the first step.
- Let a double-click on empty canvas create an idea, and edit the title in place on the card. Keep the dialog for long content.
- Make the board title the only required field on `/boards/new`, or create the board straight away with a default title the user can rename in the header.

### Coming back

Signed-in users who open `/` see the marketing page with Create and Join cards. Their boards are reachable only through the account menu, and the logo on a board links to `/`, not the dashboard. Send signed-in users from `/` to `/dashboard`, and point the board logo there too.

The **Join a board** card asks for a link or ID. People usually follow the link directly, so this card helps only when someone receives an ID by text. Make it a small link under the Create button.

### Merging

Merging is what the product is about, but it has three entry points with different rules. The Merge tool selects on click. Shift-click in Select mode starts a merge set instead of a normal multi-selection (`board-app.tsx:1420`), so you cannot select several ideas to move or delete them. **Add to merge** in the selection bar switches tools. After a merge set exists, a plain click on another idea also adds it, because one selected source counts as additive.

- Use Shift-click for ordinary multi-selection, and show **Merge** as an action in the selection bar when two to eight ideas are selected. Drop the separate Merge tool.
- Remove the ↑ and ↓ reorder buttons on merge chips unless source order changes the result in a way users can see.
- The assistant's merge action already hands off to the same merge tray, which is good. Keep every merge path ending in that one preview.

### AI features

There are four AI flows, each with its own UI: the assistant side panel, the Suggested Links panel (top right), the Organize panel (opened from the toolbar), and the merge preview (bottom). The assistant can also propose links and merges, overlapping the other two. Users have to learn four panels for one helper.

- Keep the assistant as the single AI surface, and show link suggestions and Organize as sections or actions inside it.
- Show AI progress in one place, as noted under the board section.

### Finishing

The flow has no end. Voting is social, not a decision, and the planned AI-drafted wrap-up (`WORK-038`) is the right place to close a session. Until it exists, the team has no step that turns a merged idea into an outcome. Give the wrap-up a fixed spot in the header once it ships.

### Sharing and access

**Share** copies the URL. Guests then see a name page and join with edit access. The share action does not say who can edit, and there is no way to share view-only even though the member list shows Editor and Viewer roles. Show the access level next to the copied-link notice, and add a view-only link only if the team needs it for the demo.

## Visual system

The stylesheets define every value inline, so screens drift apart and dark mode needs separate overrides for each color. Add a small token set to `src/app/globals.css` and replace literal values as you touch each stylesheet.

- Colors: about 12 variables for surface, raised surface, border, text, muted text, accent, accent text, danger, and the five group colors, with dark values under `[data-theme="dark"]`.
- Type: four or five sizes (12, 14, 16, 20, 32 px) and one `font-family` on `body`. Replace Arial with a deliberate choice such as the system UI stack or a `next/font` face.
- Radius: three values (6, 10, 16 px) plus `999px` for pills.
- Shadow: two or three elevation levels.
- Uppercase letter-spaced kickers: keep at most one style, and only where it labels something the heading does not.

The brand header is built four times with separate CSS: `landing-header`, `board-page-header`, `guest-entry-header`, and `auth-brand`. Extract one `BrandLink` component and one header layout.

## Code structure

These items are not visible to users, but they explain why the UI drifts: each change touches long, dense lines in one large file.

- `board-app.tsx` is 1,705 lines with about 70 `useState` calls. Its JSX packs whole components into single lines; the selection bar is one 700-character line (`board-app.tsx:1560`). Extract the merge preview, merge details, assistant sources, Organize panel, edit dialog, link dialog, selection bar, and tool dock into their own files.
- Merge validity is computed inline twice, once for the warnings and once for the button's `disabled` (`board-app.tsx:1550-1555`). Move it into one function in `merge-board.ts`.
- The 4,000-character limit is written as a literal in several places in `board-app.tsx`. Import it from `@/lib/ideas` with the other merge limits.

## Docs

The docs folder mixes reference docs with finished implementation plans. `assistant-implementation-plan.md`, `auto-cluster-bubble-layout-plan.md`, `cluster-organize-plan.md`, `gemini-cluster-names-plan.md`, and `merge-two-ideas-implementation-plan.md` describe planned work, which `docs/writing-style.md` says belongs in the roadmap or tasks. Fold any still-true content into `assistant.md` or `decisions.md` and delete the rest.

The Verified section of `docs/roadmap.md` is a long dated changelog. Readers looking for current status have to scan dozens of paragraphs. Keep one line per feature with its latest verification date and move the history to git or the task files.

## Suggested order

1. Board chrome: merge theme into Style, group decorations, move React and Message, and unify the toolbar and icon set.
2. Stop seeding sample ideas into new authenticated boards, after logging the decision.
5. Flow fixes: send signed-in users to the dashboard, make Shift-click a normal multi-selection with **Merge** in the selection bar, and add double-click to create.
6. Move Suggested Links and Organize into the assistant panel.
7. Add design tokens and the shared brand header.
8. Split `board-app.tsx` into components as each area above is touched.
