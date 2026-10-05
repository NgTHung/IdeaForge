# IdeaForge decisions

Accepted on 2026-10-05 for a one-week Forgehack project.

## Product

**Pitch:** A shared canvas where teams combine rough ideas into new concepts and trace how those concepts evolved.

The initial audience is student teams brainstorming hackathon projects. The problem is moving from scattered contributions to a concept the team wants to build. The audience and benefit are hypotheses to validate during the week, not established market demand.

The key interaction is synthesis: select two notes, propose a new concept using both, then let the team keep, edit, discard, or regenerate it. Existing tools already generate and summarize notes; the differentiator to demonstrate is deliberate combinations with visible ancestry and repeated branching.

### Accepted merge behavior

- Each board has a goal that constrains generation.
- Exactly two nonempty notes are merged at a time, including previously merged notes.
- The AI returns one concept, a contribution from each source, a tension, and a next experiment.
- Generation produces a preview; acceptance creates a third note. Originals remain intact.
- Each child keeps source IDs and snapshots of the text used for generation. Connections show ancestry; source edits do not rewrite historical snapshots.
- Weak connections must be acknowledged instead of presented as validated opportunities.
- Generated explanations are model claims to assess, not proof that a concept works.

### Scope

MVP: editable notes on a pan/zoom canvas; guest collaboration through a board URL; goal-aware AI merging; preview and acceptance; visible ancestry; repeated merging; reliable feedback on failure.

Defer: persona critics, summaries on zoom-out, drawing tools, uploads, voting, accounts, dashboards, and a separate database. Later, zoom-out should reveal readable theme summaries. Critic personas should reflect the intended audience and be labeled simulated feedback.

## Technology

| Decision | Rationale | Tradeoff |
| --- | --- | --- |
| Next.js App Router + React + TypeScript | UI and server routes in one familiar project | Canvas must be a client component |
| React Flow | Notes are custom nodes; edges naturally show ancestry; pan, zoom, selection, and dragging are built in | A purpose-built notes interface rather than a complete drawing editor |
| Liveblocks Storage | Managed synchronization and durable shared rooms reduce infrastructure work | External account and service dependency |
| Gemini through `@google/genai` | Direct model call with structured output | Model access and quality must be validated with the configured API project |
| Zod | Validate requests and responses with one typed contract | Valid shape does not guarantee a good idea |
| Tailwind + small CSS layer | Fast layout and styling | Maintain a coherent small set of styles |
| npm and lockfile | Reproducible installation using popular tooling | Update dependencies intentionally |
| No separate database yet | Shared board data lives in Liveblocks | Local draft has no persistence in this starter |

React Flow's core uses the MIT license. tldraw remains an alternative if full drawing becomes central; its production license/key requirements make it a less direct fit for this scope.

Gemini's model is configurable through `GEMINI_MODEL`; `gemini-2.5-flash` is a starter default, not a commitment to a model or its future availability. Compare available models with the evaluation pairs before the demo. The installed SDK's `models.generateContent` interface is used; newer API interfaces can be adopted separately.

## Architecture and data ownership

```text
React Flow canvas ── local component state (local draft)
        │
        ├── Liveblocks room storage (shared boards)
        │
        └── POST /api/merge ── Zod validation ── Gemini ── validated proposal
                    │
                    └── user accepts ── new child note + parent snapshots
```

`Board` receives data and operations. `LocalBoard` supplies in-memory state; `SharedBoard` supplies Liveblocks mutations. Selection, viewport, pending proposals, and loading/error messages belong to the local client. Shared text, positions, goals, and accepted ideas belong to room storage.

A LiveMap holds one LiveObject per note. Mutations update the relevant fields rather than replacing the whole board. Text fields currently use whole-string edits; simultaneous typing into the same note needs an explicit UX policy before calling the editor robust. Rich-text CRDT editing is outside the starter scope.

The AI request captures text at the time of generation. Acceptance creates one child atomically in the state backend. Each accepted concept can be selected for another merge; original generations remain recorded alongside the editable concept text.

## Access and configuration

- Gemini and Liveblocks keys stay on the server in ignored `.env.local`.
- Guest IDs use an HTTP-only cookie. `/api/liveblocks-auth` grants access only to the requested valid `ideaforge:<uuid>` room.
- The MVP deliberately lets anyone holding a board link edit that board. These are shared demo rooms, not private workspaces.
- Creating a shared board starts a fresh seeded board; it does not migrate the local draft.
- AI requests have input size limits and timeouts, but no application-level request quota. The global daily cap was removed at the user's request on 2026-10-05. Gemini's provider quotas still apply; per-user controls are deferred.
- No deployment, vendor account, or credentials are created by initialization.

## Verification and remaining work

### Workstation demos and Funnel hosting

The private demo remains on this workstation's Tailscale IPv4 address, port 3100, under the transient `ideaforge-demo` user service. Browser note IDs use a cryptographically random UUID fallback because `crypto.randomUUID()` is unavailable on HTTP origins.

For public hosting, an enabled persistent user service `ideaforge-funnel` runs the production app on `127.0.0.1:3101`. Tailscale Funnel exposes this through HTTPS port 8443 because port 443 already hosts another app. Initial activation required an administrator command; Funnel status now confirms port 8443 is active and the HTTPS merge route is reachable from this workstation. Reachability from a device outside the tailnet has not been verified in this session. Anyone on the internet can open the app; board-link guest editing policy stays the same. See `demo.md` for activation, verification, and process controls.

The public service initially enforced 100 Gemini call attempts per UTC day with a persistent JSON counter. On 2026-10-05, the user requested reversal because merges were failing despite remaining quota. The recorded counter showed only two attempts before investigation, so the app's daily cap had not been exhausted. The request gate, quota implementation, quota-only tests, and service quota configuration have been removed. The old counter file is no longer read or written. Public and private demos now send validated merge requests directly to Gemini without an application-level cap.

After removal, lint, typecheck, and production build passed, both demo services were restarted, and a real merge through the running Funnel backend returned HTTP 200 with all six proposal fields. An earlier Gemini call failed, but that failure did not reproduce after restart; its underlying cause remains unconfirmed.

Gemini and Liveblocks credentials are now configured in ignored environment files. One live Gemini merge returned validated structured output and Liveblocks authorization returned a token with a secure guest cookie. Two-browser synchronization has not been verified.

Initialization is checked with lint, TypeScript, production build, and HTTP smoke tests. A Chromium smoke check covers selection, missing-key feedback, merge acceptance using an intercepted test response, ancestry, editing, adding notes, and mobile width. Live Gemini generation and two-browser synchronization require real credentials and are not verified by these checks.

The starter intentionally omits undo, deletion, local persistence, cursor avatars, editable proposal fields, and a dedicated regenerate button. Accepted concept text is editable, and a discarded proposal can be regenerated by merging again. See `roadmap.md` for completion priorities.

At initialization, `npm audit` reports five high-severity findings in the development-only lint dependency chain (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`). The registry has no patched `braces` release; do not force-downgrade Next tooling to an unrelated major version. Recheck during the week. The production dependency audit is checked separately.

## References

- [Miro AI sticky-note capabilities](https://help.miro.com/hc/en-us/articles/28781881506834-Miro-AI-with-Sticky-notes)
- [React Flow](https://reactflow.dev/)
- [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Liveblocks React setup](https://liveblocks.io/docs/get-started/react)
- [Liveblocks Storage guide](https://liveblocks.io/docs/guides/how-to-use-liveblocks-storage-with-react)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [tldraw licensing](https://tldraw.dev/community/license)
