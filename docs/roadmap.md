# One-week delivery plan

This is a proposed allocation; day numbers are relative to the team's start.

| Time | Focus | Exit condition |
| --- | --- | --- |
| Days 1–2 | Canvas and shared rooms | Two browsers can create, edit, move, and see the same notes; reconnect preserves accepted notes |
| Days 3–4 | Merge quality and controls | Both inputs influence each result; edit/regenerate/discard/accept are clear; repeated merging preserves ancestry |
| Day 5 | Reliability | Undo policy, simultaneous editing policy, failures, timeouts, and AI usage limits are handled |
| Days 6–7 | Usability, evidence, demo | A student team completes a session; build passes; README and demo communicate the problem and outcome |

## Starter already included

- Next.js/TypeScript/Tailwind project with installed React Flow, Liveblocks, Gemini, and Zod packages.
- Local canvas with example notes, editing, dragging, selection, and board goal.
- Server merge endpoint with validation and structured output.
- Preview, accept/discard, editable accepted concept, parent links and source snapshots.
- Optional shared boards, guest authorization, note/goal synchronization, and collaborator count.
- Environment template and documented product/technical decisions.

These are scaffolding capabilities. Real AI output and collaboration need configured credentials and end-to-end verification.

## Next work in priority order

1. Configure keys locally and verify Gemini model access plus two-browser collaboration.
2. Test note editing, selection, repeated merges, dragging, and reconnection in a browser.
3. Improve placement of new notes and merged children so they remain visible after arbitrary pan/zoom.
4. Add local persistence, shared undo, deletion semantics, and a clear simultaneous-edit policy.
5. Add proposal editing and regenerate controls. Capture the board goal/model/timestamp alongside source snapshots for richer history.
6. Validate public hosting and consider per-user fairness controls. The global AI request cap was removed at the user's request; Gemini provider quotas still apply.
7. Polish keyboard/mobile use and presentation. Keep deferred features out unless these essentials are finished.

## Merge-quality evaluation

Try at least ten pairs: complementary ideas, unrelated ideas, duplicates, contradictions, vague inputs, and Vietnamese/English notes. For each, record whether:

- A meaningful ingredient from each source remains visible.
- The concept describes a concrete mechanism rather than restating the notes.
- It addresses the board goal.
- It admits tensions or a forced connection.
- Its suggested experiment is achievable by the target team.

Compare a few results with a simple “combine these notes” prompt to see whether goal/context and the structured explanation improve the experience. Do not claim measured impact until the team has evidence.

## Demo script

Two collaborators add different observations about student study habits. Select both, merge, explain the contributions, and accept the concept. Add a third insight and merge again. Show the ancestry and preserved sources. End with the proposed experiment the team can try next.
