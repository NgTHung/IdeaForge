# Decisions

What IdeaForge is, how it's built, and why. Accepted on 2026-10-05 for a one-week Forgehack project. Add a dated entry to the [log](#log) when scope, architecture, or access policy changes.

## Product

**Pitch:** a shared canvas where teams combine rough ideas into new concepts and can trace how each concept evolved.

**Audience:** student teams brainstorming hackathon projects, who struggle to turn scattered contributions into one concept they want to build. Both the audience and the benefit are hypotheses to test this week, not established demand.

**Differentiator:** other tools already generate and summarize notes. IdeaForge focuses on deliberate combinations of two ideas, with visible ancestry and repeated branching.

### Merge rules

- Each board has a goal that constrains generation.
- Exactly two nonempty notes are merged at a time. Merged notes can be merged again.
- The AI returns a title, a concept, each source's contribution, a tension, and a next experiment.
- Generation produces a preview. Only acceptance creates a new note, and the originals stay intact.
- Each merged note stores its parents' IDs and a snapshot of the text used. Later edits to a source don't rewrite the snapshot.
- When a connection is weak, the AI must say so instead of presenting it as a validated opportunity.
- Generated explanations are claims for the team to assess, not proof that a concept works.

### Scope

**MVP:** editable notes on a pan/zoom canvas, guest collaboration through a board URL, goal-aware AI merging, preview and acceptance, visible ancestry, repeated merging, and clear feedback on failure.

**Deferred:** persona critics, summaries on zoom-out, drawing tools, uploads, voting, accounts, dashboards, and a separate database. If added later, zoom-out should show readable theme summaries, and critic personas should match the target audience and be labeled as simulated feedback.

## Technology

| Choice | Why | Tradeoff |
| --- | --- | --- |
| Next.js App Router, React, TypeScript | UI and server routes in one project | The canvas must be a client component |
| React Flow | Notes are custom nodes, edges show ancestry, and pan/zoom/select/drag are built in | A notes interface, not a full drawing editor |
| Liveblocks Storage | Managed sync and durable rooms with little infrastructure | External account and service dependency |
| Gemini via `@google/genai` | Direct model call with structured JSON output | Model access and quality must be checked per API project |
| Zod | One typed contract validates requests and responses | A valid shape doesn't guarantee a good idea |
| Tailwind plus a small CSS layer | Fast layout and styling | Keep the style set small and coherent |
| npm with a lockfile | Reproducible installs | Dependency updates must be deliberate |
| No database | Shared board data lives in Liveblocks | The local board doesn't persist |

React Flow's core is MIT-licensed. tldraw would fit better if freeform drawing became central, but its production license-key requirement makes it a poorer fit for this scope.

The model is set by `GEMINI_MODEL`. `gemini-2.5-flash` is only a starting default; compare available models on the [evaluation pairs](roadmap.md#merge-quality-evaluation) before the demo. The code uses the SDK's `models.generateContent` interface.

## Architecture

```text
React Flow canvas ── local component state (local board)
        │
        ├── Liveblocks room storage (shared boards)
        │
        └── POST /api/merge ── Zod ── Gemini ── validated proposal
                    │
                    └── user accepts ── new child note + parent snapshots
```

`Board` renders the canvas and receives data and operations from one of two adapters: `LocalBoard` (in-memory state) or `SharedBoard` (Liveblocks mutations).

- **Per client:** selection, viewport, the pending proposal, and loading and error states.
- **Shared in room storage:** note text, positions, the goal, and accepted ideas.

Notes are stored as one `LiveObject` per note in a `LiveMap`, and mutations update individual fields. Text edits replace the whole string, so two people typing in the same note need an explicit UX policy. Rich-text CRDT editing is out of scope.

A merge request captures source text at generation time. Accepting a proposal creates the child note in one operation. The original generated proposal is stored alongside the editable concept text.

## Access and configuration

- Gemini and Liveblocks keys are server-only, kept in git-ignored `.env.local`.
- Guests are identified by an HTTP-only cookie. `/api/liveblocks-auth` grants access only to the requested `ideaforge:<uuid>` room.
- Anyone with a board link can edit that board. Boards are shared demo rooms, not private workspaces.
- **New shared board** creates a fresh, seeded board. It doesn't copy the local board.
- AI requests have input size limits and a 30-second timeout but no app-level quota. Gemini's provider quotas apply. Per-user fairness controls are deferred.
- Deployment is deferred. The app is demoed from a developer machine, and hosting will be documented once a deployment target is chosen.

## Log

- **2026-10-05: initial decisions accepted**, as recorded above.
- **2026-10-05: development audit advisory accepted.** `npm audit` reports five high-severity findings in the dev-only lint chain (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`). No patched `braces` release exists. Don't force-downgrade Next tooling to an unrelated major version; recheck during the week.
- **2026-10-05: daily AI cap removed.** The demo first enforced 100 Gemini calls per UTC day with a persistent counter. It was removed at the user's request after merges started failing. The counter showed only two attempts, so the cap itself wasn't the cause. The gate, counter, and its tests were deleted. The failure didn't recur after a restart, and its cause is still unknown.

## References

- [Miro AI sticky-note capabilities](https://help.miro.com/hc/en-us/articles/28781881506834-Miro-AI-with-Sticky-notes)
- [React Flow](https://reactflow.dev/)
- [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Liveblocks React setup](https://liveblocks.io/docs/get-started/react)
- [Liveblocks Storage guide](https://liveblocks.io/docs/guides/how-to-use-liveblocks-storage-with-react)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [tldraw licensing](https://tldraw.dev/community/license)
