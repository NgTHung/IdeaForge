# IdeaForge

A Forgehack project: a shared brainstorming canvas where teams combine two rough ideas into a new concept and trace its ancestry.

This is an initialized, runnable starter for a one-week build. The focus is note merging. Persona critics and summaries on zoom-out are deferred.

## Run locally

Use Node.js 24 or newer and npm (the project records npm 12.2.0).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The local canvas works without keys: add/edit notes, drag, pan, zoom, and select two notes with Shift. Local draft changes last until you reload.

For AI merging, set `GEMINI_API_KEY` in `.env.local`. Adjust `GEMINI_MODEL` to a model available to your project if necessary. Restart the server after environment changes. Select two nonempty notes, set a goal, and choose **Merge**. Review the proposal, then keep or discard it. Keeping it creates a child note with parent links and source text snapshots; its text can be edited and merged again.

For collaboration, set `LIVEBLOCKS_SECRET_KEY` and restart. **New shared board** creates a fresh seeded board at `/board/<uuid>`; it does not move your local draft. Share that URL with another browser. Shared notes/goals are stored in Liveblocks. Anyone with the link can edit the board.

Keys are server-only. `.env.local` is ignored; `.env.example` is tracked. No accounts or external services are provisioned by this starter.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, React Flow, Liveblocks Storage, Gemini (`@google/genai`), and Zod. The lockfile records the installed versions.

## Decisions and plan

- [Product, stack, architecture, and tradeoffs](docs/decisions.md)
- [One-week roadmap and evaluation plan](docs/roadmap.md)
- [Contributor instructions](AGENTS.md)
- [Tailscale Funnel hosting and process controls](docs/demo.md)

## Project layout

```text
src/app/                       Pages and server endpoints
src/app/api/merge/              Validated AI merge endpoint
src/app/api/liveblocks-auth/    Guest room authorization
src/app/board/[id]/             Shared canvas routes
src/components/board.tsx        Canvas and proposal interface
src/components/local-board.tsx In-memory local state
src/components/shared-board.tsx Liveblocks storage adapter
src/lib/ideas.ts                Types, validation, example notes
src/liveblocks.config.ts        Typed shared storage
```

## Checks

```bash
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

Live AI generation and multiplayer require configured credentials. AI requests have no application-level cap; Gemini's provider limits still apply. The initial scaffold still needs undo, deletion, local persistence, better note placement, simultaneous-edit handling, proposal editing/regeneration controls, and per-user AI fairness controls. The decision log records a current development-only dependency advisory.
