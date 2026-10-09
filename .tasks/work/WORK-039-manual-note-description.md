---
id: "WORK-039"
title: "Generate useful editable idea content on request"
status: "In Progress"
priority: "Medium"
type: "Feature"
risk: "Medium"
impact: "Lets a participant generate a grounded idea description in the editor using bounded board and participant context."
tags: ["enhancement", "ready-for-agent"]
last_updated: "2026-10-10"
---

## Summary

Show **Generate content** in the idea editor after a participant enters a meaningful title. Send the title, goal, board context, and any participant-provided seed text to the server model. Generate only when clicked, put the result in the editable Content field, and save it with the idea only when the participant clicks **Save idea**. Follow `docs/generate-idea-content-plan.md`.

## Acceptance Criteria

- [x] Saving a title-only idea does not call the model. A participant can request generation only by clicking the editor button after entering a meaningful title.
- [x] The route accepts only bounded, validated title and board-goal input and returns either a concise grounded description or a clarification question; malformed input and provider errors return safe responses.
- [x] The route uses the shared Featherless generation module, keeps provider credentials server-side, and does not read or write board storage.
- [x] The request validates bounded board title, board description, seed Content, and a current cluster label when available. It does not include unrelated ideas, chat history, or secrets.
- [x] The model returns a source-grounded two-or-three-sentence content draft with a clear opening sentence or one actionable clarification question. The response cap and token budget support the target content length.
- [x] A response fills the current editor Content field only while its title, content, board goal, request, and write access are unchanged. Editing, saving, or closing the editor cancels a pending result.
- [x] The generated content remains editable before save. Saving stores model, time, title, goal, and generated-text provenance; canceling does not save the draft.
- [x] Pending, error, and clarification states appear in the editor. The button reads **Generate content**, supports retry, and tells the participant to answer clarification questions in Content. Existing content requires confirmation before replacement.
- [x] A response is discarded when any context used in the request changes. Provenance records the bounded context used without storing unrelated board data.
- [x] Optional group placement runs after save using the final edited content and existing grouping guards.
- [x] Lint, typecheck, and production build pass. Live browser behavior and any unverified paths are recorded in the roadmap.
- [x] The decision log and plan describe the manual editor flow.

## Implementation note

The `taskroot` CLI was unavailable in the implementation environment. This task was added using the repository's existing task format and must be checked with `taskroot validate` when the CLI is available.

The earlier automatic save-time behavior was live-tested before this change. That evidence does not verify the manual editor flow or the expanded context payload.

The manual editor implementation passed nine focused route and guard checks, `npm run lint`, `npm run typecheck`, and `npm run build`. Live GLM-5.3-Flash calls covered a specific title, ambiguous `AI eng`, a clarified seed, and Vietnamese text. The final prompt gave short drafts grounded in the supplied title and seed for those cases. A temporary guest Liveblocks room verified the button, question, seed, replacement confirmation, editable draft, edited save, provenance, cancel, reload, simulated error and retry, simulated stale reply, and zero model calls on a title-only save. Generated text still needs participant review because model output can add unsupported implications in other cases.

All acceptance criteria have code, test, or live evidence. The task stays `In Progress` until `taskroot validate`, `taskroot done work:WORK-039`, and a final `taskroot show` can run in an environment with the CLI.
