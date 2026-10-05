# IdeaForge

A shared brainstorming canvas for merging ideas. Pick two rough notes, and IdeaForge proposes a new concept that builds on both. Every merged idea records where it came from.

Built in one week for Forgehack.

## How it works

1. Set a **board goal**, the problem your team is brainstorming about.
2. Add notes to the canvas, then select two of them.
3. Choose **Merge**. Gemini returns a proposal with a concept, what each note contributed, a tension or weakness, and a small experiment to try next.
4. **Keep** the proposal to add it as a new note linked to its two parents, or **Discard** it. The original notes stay on the canvas.

Merged notes can be edited and merged again, so ideas branch over several rounds. Each merged note keeps a snapshot of the source text it was generated from, so later edits to the sources don't rewrite its history.

## Features

- Pan/zoom canvas with editable, draggable notes (React Flow)
- Goal-aware AI merging with a preview before anything is saved
- Visible ancestry: edges link each merged note to its parents
- Optional real-time shared boards at `/board/<id>`, editable by anyone with the link
- No keys needed to try the canvas; AI merging and shared boards turn on when keys are set

## Getting started

Requirements: Node.js 24+ and npm.

```bash
npm ci
cp .env.example .env.local   # add keys here (optional)
npm run dev
```

Open http://localhost:3000. Click a note's border to select it, and hold Shift to select a second one.

Without keys, you get a local canvas that resets on reload. Add the keys below to enable AI merging and shared boards, then restart the dev server.

### Configuration

| Variable | Needed for | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | AI merging | Get one at https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | AI merging | Defaults to `gemini-2.5-flash`; use any model your API project can access |
| `LIVEBLOCKS_SECRET_KEY` | Shared boards | Get one at https://liveblocks.io/dashboard. Enables **New shared board** |

All keys stay on the server. `.env.local` is git-ignored.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc` |

## Project structure

```text
src/app/                         Pages and route handlers
src/app/api/merge/               AI merge endpoint (Zod-validated, Gemini)
src/app/api/liveblocks-auth/     Guest authorization for shared boards
src/app/board/[id]/              Shared board route
src/components/board.tsx         Canvas and merge-proposal UI
src/components/local-board.tsx   In-memory board state
src/components/shared-board.tsx  Liveblocks-backed board state
src/lib/ideas.ts                 Types, schemas, example notes
src/liveblocks.config.ts         Shared storage types
```

**Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, React Flow, Liveblocks, Gemini (`@google/genai`), Zod.

## Status

This is an early hackathon build. Not yet implemented: undo, note deletion, local persistence, editing or regenerating a proposal before keeping it, and handling for two people typing in the same note. The app has no rate limit of its own on AI requests; Gemini's quotas apply. See the [roadmap](docs/roadmap.md) for what has been verified and what's next.

## Documentation

- [Decisions](docs/decisions.md): product scope, architecture, and tradeoffs
- [Roadmap](docs/roadmap.md): current status, plan, and evaluation
- [Writing style](docs/writing-style.md): how to write docs and code comments
- [Contributor guide](AGENTS.md)
