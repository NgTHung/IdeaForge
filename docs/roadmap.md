# Roadmap

This page tracks what the current local canvas can do and what has been verified. It replaces the earlier merge and collaboration roadmap as the source of current priorities. Older task files in `.tasks/` record the previous direction and need review before anyone resumes them.

## Current status

The main route `/` provides a local board with sample ideas, typed links, editing, deletion, pan and zoom, pinning, a physics toggle, and a labeled assistant placeholder. The board resets on refresh. There are no backend services or provider calls.

On 2026-10-06, the two board-model tests, lint, typecheck, and production build passed. The build exposes only `/` and the not-found route. A headless Chrome check at 1280×720 confirmed the board renders, a connection drag shows its preview and chooser, confirmation adds a link without moving its source, a pinned idea stays fixed, and direct dragging works with physics on.

Browser interaction checks for the editor, deletion, assistant input, touch, and a board with about 30 ideas remain open. The slower physics tuning has not been evaluated with a user session.

## Next decisions

Choose whether the next milestone adds persistence, collaboration, or AI. Record that scope and its access policy in [decisions](decisions.md) before implementation. The disabled controls are placeholders until that decision is made.
