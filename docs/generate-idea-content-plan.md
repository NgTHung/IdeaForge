# Generate useful idea content

This plan describes the **Generate content** action and the text it puts in Content. The model receives the idea title, board goal, and bounded context that the participant can inspect or edit. A participant chooses when to generate and whether to save the result. `WORK-039` tracks implementation and verification.

## Behavior before this change

The editor already places a successful response in the editable Content textarea. `src/features/board/board-app.tsx` sends only `{ title, goal }` to `POST /api/ideas/description`. The server prompt asks for one to three short sentences, caps the result at 400 characters, and allows a clarification question when the title is vague. With `AI eng`, the model cannot tell whether `eng` means English, engineering, or something else. The screenshot shows a clarification question and an empty Content field. That outcome avoids inventing an idea, but the current request cannot use an explanation typed into Content on the next click.

The normal idea card shows only a few lines of Content, while the editor can show the full text. Longer generated content needs a clear first sentence that still makes sense when the card truncates the rest.

## Desired editor behavior

Show **Generate content** as soon as the title is meaningful and the participant can write to the board. Do not generate on save, reload, or a shared-board update. A successful response goes directly into the Content textarea. The participant can edit it before **Save idea**, and **Cancel** discards the draft. Keep the current confirmation before replacing nonempty Content. Label the action **Regenerate content** when Content already has text, and **Try again** after a provider error.

When the title is ambiguous, ask one question tied to the missing detail and leave Content unchanged. The participant can answer in Content and click **Generate content** again; the next request uses that text as a seed. For `AI eng`, ask what `eng` means if the board context does not settle it. If the participant types “AI English speaking partner for beginners,” the next request can explain that idea without guessing a feature or audience.

## Request context and limits

Keep the existing server-only provider call and endpoint. Expand its validated request so the server receives these fields as data:

| Field | Source | Limit and use |
| --- | --- | --- |
| `title` | Current editor title | Required, trimmed, at most 120 characters. It names the idea. |
| `goal` | Current board goal, falling back to the board title | Required, at most 500 characters. It explains what the board is trying to achieve. |
| `boardTitle` | Current board title | At most 80 characters. It helps interpret the goal, not override the idea title. |
| `boardDescription` | Board metadata description, when available | Optional, trimmed to 600 characters. It supplies the team's stated context. |
| `seedContent` | Current Content before the click | Optional, trimmed to 1,200 characters and further trimmed if the full request exceeds 8 KB. It is the participant's explanation or notes; the model may clarify and condense it, but must not contradict it. |
| `clusterLabel` | Existing idea's current group, only when the cluster snapshot is not stale | Optional, at most 100 characters. It is a weak context hint and must not become an invented feature. New ungrouped ideas omit it. |

Do not send other participants' notes, chat history, votes, or merge sources for this action. If the board goal is empty, use the board title as the goal; omit an empty board description. Keep the request below the route's 8 KB body limit, including JSON escaping and multibyte text. Provider credentials remain on the server. Titles, goals, and seed text are untrusted data, never instructions.

## Writing contract

Ask for one plain-text Content draft of two or three short sentences, usually 120 to 350 characters in the title's language, with a maximum of 700 characters. A shorter draft is better than invented detail. Raise the route's output-token budget enough for that limit, then keep Zod validation and the shared one-time repair. The first sentence must say what the idea is using the title and participant's notes. The rest should state its intended fit with the board goal. Describe a mechanism or benefit only when the title or notes supply it. Prefer concrete nouns and verbs over praise, repeated titles, or filler such as “This innovative idea helps users.”

The model must not invent features, user groups, evidence, numbers, integrations, or promised results. If the title and context cannot support a useful draft, return one focused clarification question. The question should identify the missing decision and tell the participant what to add to Content before trying again. Do not produce a generic paragraph to avoid asking a question. Keep the current description/question response shape for this internal route, while treating `description` as the text to place in Content.

## Client and saved data

Build the request from the latest editor draft and board state at the button click. Extend the existing stale-response guard to compare every context field that can change while the request is pending, including the board description and seed Content. Editing the title or Content, changing the goal, closing or saving the editor, losing write access, or starting a newer request must prevent the old response from filling Content. A change to an unrelated note must not discard a valid result.

Keep generated text and model/time/context provenance in the editor until the participant saves. Save the final edited Content and its generated snapshot in one board mutation. Review the provenance type before adding context fields; record only what is needed to explain what the model saw and avoid copying unrelated board data into each idea. Existing notes without provenance must still load.

## Implementation order

1. Refine `work:WORK-039` with the button label, bounded context, useful-content contract, ambiguity flow, and live acceptance criteria. Run `taskroot validate` and inspect task context when the CLI is available; it is unavailable in the current checkout. Do not mark the task done during planning.
2. Read `docs/decisions.md`, log the accepted context and output change there, and update `docs/roadmap.md` when implementation starts. Read the relevant installed Next.js guides before changing the route or client component.
3. Change the button copy and editor help text in `src/features/board/board-app.tsx`. Build one request snapshot from title, goal, board title, board description, seed Content, and a valid cluster label. Keep Content editable and the existing confirmation before replacement.
4. Expand `src/lib/idea-description-contract.ts` and the route's validation with the new optional fields and limits. Update `src/lib/idea-description.ts` so the prompt uses the context hierarchy and the writing contract above. Keep the output validated at the server boundary and preserve safe errors.
5. Update `src/features/board/description-generation.ts` and the editor's request guard for context changes. Save the final edited Content and provenance only on **Save idea**. Keep automatic group placement based on the final saved text.
6. Update the existing route and guard checks for context bounds, prompt payload, ambiguous titles, seed Content, Vietnamese text, stale replies, and provider failures. Run `npm run lint`, `npm run typecheck`, and `npm run build` after code changes.
7. With credentials available, check the real model and editor on a temporary board. Cover a specific title, `AI eng` with and without a seed, editing the generated Content, cancel, retry, and shared-board reload. Record provider results and any unverified paths in the roadmap without treating a mocked response as a live result.

## Acceptance criteria

- The button reads **Generate content** and one click puts a useful draft in the editable Content field when the context supports one.
- A title-only save causes no model request. The participant can edit, save, or cancel generated Content.
- The provider request contains the validated title, goal, and available bounded board and participant context, with no credentials or unrelated notes.
- A specific idea gets a clear first sentence and enough supported detail to understand its purpose, operation, and fit with the board goal within 700 characters.
- An ambiguous title gets one actionable question. Adding an answer to Content and clicking again sends that answer as seed context.
- A stale response never replaces a participant's edits. The final saved Content and provenance persist together for other board members.
