# IdeaForge

IdeaForge is a shared canvas where a team finds which of its ideas are worth combining, merges them into new concepts, and keeps a record of who contributed what. It was built in one week for Forgehack in the AI + Creativity / Collaboration track. The live app is at [idea-forge-wine.vercel.app](https://idea-forge-wine.vercel.app), and [`/try`](https://idea-forge-wine.vercel.app/try) opens a sandbox board that saves nothing.

## What it does

A team opens a board link, adds idea notes, and links pairs of notes as **Works well together**, **Conflicts with**, or **Extends**. **Organize** groups notes by embedding similarity and suggests a name for each group. The app also suggests up to three links at a time for the team to review. Select 2 to 8 notes to get an editable merge preview. Keeping it creates a new note that records its sources. Participants upvote ideas, and the board conclusion drafts themes, key ideas, open questions, and next steps from the ideas and groups you select. You can export the conclusion as Markdown.

Shared boards sync live through Liveblocks, with presence, cursors, freehand drawing, undo and redo, PNG export, and QR sharing. A new board starts with five generated starter ideas.

## Principles

- AI proposes and people decide. Suggested links, merges, and conclusions are previews, and nothing is saved until someone accepts it.
- Merging keeps history. The original notes stay intact, and each merged note stores its parents, their authors, and a snapshot of the text it used.
- Similarity isn't agreement. Two notes on the same topic can propose opposite approaches, so closeness on the canvas never creates a link.
- AI output comes from real provider calls. A weak connection is reported as weak, and any canned or mocked result is labeled.
- Votes are a social signal. They rank ideas but never choose anything.
- Provider credentials stay on the server.

[Decisions](docs/decisions.md) explains the reasoning behind each rule.

## Run locally

You need Node.js 24 or later and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The landing screen and `/try` work without any keys. Each other feature needs its own settings in `.env.local`:

| Feature | Variables |
| --- | --- |
| Shared boards | `LIVEBLOCKS_SECRET_KEY` |
| Accounts, the dashboard, and creating boards | `MONGODB_URI`, `MONGODB_DB_NAME`, `BETTER_AUTH_SECRET`, `APP_ORIGIN` |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Email sign-up and password resets | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| Organize and new-note placement | `GEMINI_API_KEY` |
| Merges, group names, link explanations, conclusions, the assistant, and starter ideas | `FEATHERLESS_API_KEY` |
| Automatic link suggestions | `TYPESAFE_API_KEY` and the MongoDB settings |

`.env.example` documents the optional model, fallback, and daily-limit settings. Set `APP_ORIGIN` to the URL your browser uses. Generate `BETTER_AUTH_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`.env.local` is git-ignored. The [deployment guide](docs/deployment.md) covers Vercel, Google sign-in callbacks, and configuration errors.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Build and serve production |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm test` | Run unit tests with mocked storage and provider responses |

## Project structure

```text
src/app/              Pages and route handlers, including the AI routes under api/
src/features/board/   Canvas UI, board model, layout, and link routing
src/lib/              Shared contracts, the server-only AI module, similarity, and clustering
src/server/           Accounts, MongoDB, and board directory handlers
tests/                Node test runner suites
docs/                 Decisions, roadmap, and design notes
```

The stack is Next.js (App Router), React, TypeScript, React Flow, d3-force, Liveblocks, Better Auth, MongoDB, and Zod. Generation uses GLM-5.3-Flash on Featherless, embeddings use Gemini, and link classification uses Jev on TypeSafe.

## Status

This is an early hackathon build. Anyone with a board link can edit that board, and invitations aren't supported yet. The board assistant works but is still being verified. See the [roadmap](docs/roadmap.md) for verification evidence and remaining work.

## Documentation

- [Decisions](docs/decisions.md): product scope, architecture, and tradeoffs
- [Roadmap](docs/roadmap.md): current status, plan, and evaluation
- [Deployment](docs/deployment.md): hosting, Google sign-in, and troubleshooting
- [Writing style](docs/writing-style.md): how to write docs and code comments
- [Contributor guide](AGENTS.md)
