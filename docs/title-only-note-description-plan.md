# Title-only note descriptions

This plan adds a description to a new note when you save it with a useful title and leave its content empty. The note appears on the board immediately, and a real model call writes a short description after it returns. The description must explain what the title supports without inventing a feature, audience, or result. You can edit the note throughout, and a later model response must not replace your work.

## Decision and task setup

Register this feature in `.tasks/` before production changes. No existing task covers title-only note generation; `WORK-033` covers Markdown rendering, and `WORK-035` completed the move to Next.js. `WORK-038` is the assigned task. The `taskroot` executable is not installed in this environment, so the task was added in the repository's existing format and its metadata was checked against `.tasks/config.json`. Run `taskroot validate` and inspect `work:WORK-038` when the CLI is available. Its status is `In Progress` while the remaining board interaction checks are completed.

The product behavior is recorded in `docs/decisions.md`, and implementation progress is in `docs/roadmap.md`. Keep provider credentials on the server and apply the existing board-link write policy. This feature does not change who can edit a shared board.

## Current code to reuse

| Area | Current behavior | Planned change |
| --- | --- | --- |
| `src/features/board/board-app.tsx` | `makeIdea` opens a local draft with title `New idea` and empty content. `saveEdit` creates the note, closes the editor, then optionally places the note in an existing group. | Trigger one description request from the successful new-note save path when content is blank and the title is meaningful. Keep the request and status in browser state. |
| `src/features/board/model.ts` | `Idea` stores `title`, `content`, `author`, position, ancestry, and optional AI records. `updateIdea` marks a group snapshot stale when text changes. | Add optional description provenance. Apply generated content with `updateIdea` only after checking the latest board state. |
| `src/features/board/shared-board.tsx` | The shared adapter passes a functional board update into one Liveblocks mutation. | Reuse that mutation for the generated text and provenance so concurrent edits are checked against current storage. |
| `src/lib/ai.ts` | Featherless generation, one repair for rejected output, timeout, fallback, and safe error responses are shared by AI routes. | Reuse `generateJsonWithModel` and `aiErrorResponse`; keep the provider key out of the browser. |
| `src/features/board/markdown-text.tsx` | Note content already renders a safe Markdown subset. | Store generated description as plain text, which renders through the same component. |

## User behavior

Saving a new note with a changed, nonempty title and blank content creates the note immediately. The editor closes and a nearby status says **Generating description…**. A successful response fills the content automatically and marks it as AI generated. The result must be editable through the existing note editor. The note keeps the title, author, position, and ID chosen at save time.

Typing any nonblank content before saving skips generation. Editing an existing note, including clearing its content, also skips it. Saving the untouched `New idea` placeholder with blank content does not call the model. Generation starts on a successful save event, never from a render effect, reconnect, reload, or Liveblocks update. Each eligible save starts at most one request; a visible **Try again** action after failure can make one new request for that same note if its content is still blank.

Generation failure leaves the title-only note on the board. Show the cause returned by the AI route, such as missing key, timeout, overload, or invalid output, and keep manual editing available. When the title does not say enough to describe an idea responsibly, leave the content blank and show one question that the participant can answer in the editor. Do not insert a canned description without labeling it.

## Description contract

Add `src/lib/idea-description.ts` for the request schema, response schema, prompt, and server-side generation function. Add `POST /api/ideas/description` in `src/app/api/ideas/description/route.ts`. The route generates text but never writes to MongoDB or Liveblocks. Its input is a trimmed title of 1–120 characters and a bounded board goal. The browser sends `board.goal`, falling back to the board title if the goal is empty. Do not send every card or chat history for this feature.

Use a strict Zod response with `description: string | null` and `question: string | null`. Validate that exactly one is nonempty after trimming. A description is at most 400 characters and targets one to three short sentences. The prompt asks for the idea's purpose, intended audience, and useful effect only when the title and goal support those details. It must keep the title's language, including Vietnamese, and avoid new mechanics, metrics, guarantees, citations, HTML, and generic praise. A title too vague to ground a useful description returns a short question instead of an invented explanation. The model must treat title and goal as data, not instructions.

Return `{ description, question, model, generatedAt }` from the route. Use `generateJsonWithModel` with a bounded output token limit and the shared rejected-output repair. Use `aiErrorResponse` for provider failures, `400` for invalid input, and a body-size limit before parsing. Export `runtime = "nodejs"` and an AI duration budget consistent with the shared three-attempt policy. Never log the title, goal, generated text, or credentials.

For example, under a goal about better study habits, `Study buddy matching` could yield: “Helps students find a partner for regular study sessions. The team still needs to decide how partners are matched.” A title such as `Rocket` should yield a question about what it means on that board.

## Client request and stale-result rules

Keep a pending request keyed by the new note ID, with its saved title, goal, request token, and `AbortController`. The browser can show pending and error status without writing those transient values to Liveblocks. Cancel or ignore the request when the board is left, the note is deleted, or a new request supersedes it. Closing the editor must not cancel an already saved note's generation.

When a description returns, apply it through `commitBoardChange` with a functional update. Inside that update, require that the note still exists, its title equals the submitted title, its content is still blank, the board goal still equals the submitted goal, the request token is current, and the participant still has write access. If any condition fails, leave the board unchanged and clear the pending status. A change to another card must not invalidate the result. Keep the response's `question` local and do not change board content for that outcome.

Add an optional provenance record to `Idea`, separate from its existing `assistant` record for assistant-created ideas. Store the generated description snapshot, model, generation time, and the title and goal sent to the model in the same mutation as the content. Existing notes without this record remain readable. Show **AI-generated description** while content matches the generated snapshot; if a person edits the text, show that it was edited after generation or remove the generated label while preserving the snapshot. A manual edit must never be overwritten by a delayed request.

The automatic description is a separate board edit from note creation. Undo can therefore remove the generated content before removing the note. If someone undoes the creation before the reply arrives, the missing-note check prevents recreation. Redo and reload must not trigger another provider call. A participant in another browser sees only the saved content and provenance, not the first browser's pending spinner.

## Interaction with automatic group placement

`saveEdit` currently starts `assignNewNote` after saving a new note when **Place new notes in an existing group** is enabled. For an eligible title-only note, wait for description generation to settle before assigning it. On success, use the note's latest title and generated content. On failure or a clarification question, use the latest title-only note. If the participant writes content before the model returns, discard the generated response and use that manual content for assignment. Start assignment at most once, reuse its existing snapshot and drag guards, and never move older notes. A deleted note starts no assignment.

## Implementation order

1. Create and validate `work:WORK-038` with criteria for automatic eligibility, grounded output, safe application, errors, provenance, local and shared boards, and group placement. Read its context, then mark it `In Progress` before code changes.
2. Build the Zod contract and server-only generator. Add the route with request limits, the shared provider call, and safe errors. Keep the route free of board mutations.
3. Add the new-note request state to `BoardApp`. Trigger only from a successful title-only save, show a pending status, and preserve manual editing. Add an explicit retry for a failed eligible note.
4. Add the conditional board update and optional provenance to the shared `Idea` type. Check the latest title, content, goal, note existence, request token, and write access before saving a reply.
5. Coordinate `assignNewNote` with the final text of the new note. Keep existing placement and group snapshot guards.
6. Add focused tests and run the repository checks. Record verified behavior and remaining live-service limits in `docs/roadmap.md`, then complete the task only when every criterion has evidence.

## Verification

Use mocked provider responses to check the request and output contract, including English and Vietnamese text, ambiguous titles, malformed JSON, overlong or empty descriptions, prompt injection inside a title, missing credentials, timeout, and overload. Check that the route returns no board mutation and no secret or note text in errors or logs.

Check the browser and board model for a title-only save, a manually written description, an unchanged placeholder, an existing-note edit, double submission, cancel before save, retry after failure, and reload. During a pending request, edit the title, type content, change the goal, delete the note, leave the board, and remove write access; none of those cases may overwrite or recreate a note. Check that a change to an unrelated note does not discard a valid result. Check undo, redo, optional provenance, and older note records without that field.

On a local board and a shared board, save a new note and verify that only the creating browser calls the real model. Confirm that a second browser sees the generated content once and can edit it; the first browser must not write a late reply over that edit. With automatic group placement enabled, verify one placement based on final text and no movement of older notes. Check the editor on a narrow screen and confirm pending and error messages are announced accessibly.

After code changes, run focused tests, `npm run lint`, `npm run typecheck`, and `npm run build`. Call the real provider and Liveblocks only when credentials are available. Report separately what passed with mocks, what passed with a live provider, and what shared-board behavior remains unverified.

## Completion condition

A new note saved with a meaningful title and blank content gains one grounded, editable description from a real model call. A failed, vague, or stale generation leaves the participant's note intact and never replaces human text. Local and shared board checks show correct persistence, attribution, write access, and one-time group placement, and the roadmap records the verification evidence.
