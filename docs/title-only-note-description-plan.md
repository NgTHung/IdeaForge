# Manual note description generation

The idea editor can ask the server to draft a short description after you enter a title. You review and edit that text in Content before saving. Saving a title-only idea without clicking the button does not call the model. `WORK-039` tracks this flow and replaces the earlier automatic save-time trigger.

## Product behavior

Show **Generate description** in the idea editor when the title is nonblank, at most 120 characters, and is not the untouched `New idea` placeholder. The button is available for new and existing ideas. Clicking it sends the current title and board goal to `/api/ideas/description`; the browser never receives the provider key. A participant can still save or cancel without generating.

A successful description fills the editable Content field. The participant can change the title or content and then click **Save idea**. Canceling closes the editor without saving generated text. A clarification question stays in the editor and leaves Content unchanged. A provider failure shows an error beside the button, which becomes **Try again**. If Content already has text, confirm before replacing it with a generated description.

The button makes one request per click. Saving, canceling, closing, leaving the board, changing the title or Content, changing the board goal, or losing write access cancels a pending request. A late response may fill the editor only while its editor ID, title, Content, goal, request token, and write access still match. Reloading or a shared-board update never starts generation.

## Data and service contract

Keep the existing bounded `POST /api/ideas/description` route, strict Zod schemas, Featherless generation module, and safe provider errors. Send only the title and board goal, falling back to the board title when the goal is empty. The route returns either a concise description or one clarification question with model and time metadata. It never writes MongoDB or Liveblocks storage.

Keep generated provenance in the editor until **Save idea**. Saving the idea writes the final Content and provenance together. The provenance records generated text, title, goal, model, and generation time, even when the participant edits the text before saving. The card distinguishes unchanged generated text from text edited after generation. Older notes without provenance still render.

Optional group placement runs after a new idea is saved, using its final edited text. It keeps the existing group snapshot and drag guards. A request that fails or is canceled does not move a note by itself.

## Implementation

1. Rename the colliding description task to `WORK-039`, record the manual trigger in `docs/decisions.md`, and update the roadmap. The `taskroot` CLI is unavailable in this checkout, so validate the task there when the CLI is installed.
2. Remove save-time requests and card-level pending, error, and retry state. Keep request state local to the open editor.
3. Add the title-gated button, editable Content result, confirmation for replacement, pending/error/question text, and stale-response guard.
4. Save generated provenance only with the participant's final idea edit. Keep cancel, reload, and shared-board updates free of provider calls.
5. Check lint, typecheck, and build. Verify the button, result editing, cancel, save, stale request, and shared-board persistence in the browser when live services are available. Mark each task criterion complete only with evidence.

## Completion condition

A participant can enter a title, click **Generate description**, edit the returned Content, and save it as one idea update. A title-only save does not call the model. Late responses never replace the participant's edits, and the roadmap states which browser and provider paths were verified.
