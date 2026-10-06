# IdeaForge

A brainstorming canvas for capturing ideas and drawing typed relationships between them. The goal is a shared board where a team finds which ideas are worth combining and merges them with visible ancestry. Today the canvas runs locally in the browser, and the AI merge and shared-board backends exist as server routes that the canvas doesn't call yet.

Built in one week for Forgehack.

## Use the board

Choose **Add idea**, then click empty canvas space to place a bubble. Double-click a bubble or select it and choose **Edit** to change its title and content. Drag a bubble to move it; select it to pin or delete it. The sample board starts with five ideas and two relationships, and resets when you refresh.

Choose **Connect**, then drag from one idea into another. Release over the target, choose **Works well together**, **Conflicts with**, or **Extends**, and optionally explain the link. The arrow for **Extends** points from the extending idea to the idea it extends. Select a connection to delete it.

Use **Select** or **Hand / Pan** for navigation. Hold Space while dragging to pan, scroll to zoom, and use the lower-right controls to zoom or fit the ideas. Toggle **Physics** to pause or resume settling. The assistant panel accepts prompts and returns a fixed message that states AI is not connected. **AI Organize**, **Merge ideas**, **Generate brief**, and **Share** are disabled placeholders.

## Getting started

Requirements: Node.js 24+ and npm.

```bash
npm ci
cp .env.example .env.local   # add keys here (optional)
npm run dev
```

Open http://localhost:3000. The canvas needs no keys. The keys below enable the merge, similarity, and Liveblocks authorization routes.

### Account API setup

The Express account API runs separately from the Next.js frontend. Copy `.env.example` to `.env`, set `MONGODB_URI` to the Atlas connection string and `MONGODB_DB_NAME` to `ideaforge_dev`, and generate `BETTER_AUTH_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Keep `.env` out of Git. The MongoDB username and password belong in the URI; URL-encode special characters in them.

Set `API_ORIGIN` to `http://localhost:4000`, `APP_ORIGIN` to `http://localhost:3000`, and `NEXT_PUBLIC_API_URL` to `http://localhost:4000`. Run `npm run dev` and `npm run api:dev` in separate terminals. The API checks its MongoDB connection at startup and reports health at `/healthz`.

To enable Google sign-in, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`. Add `http://localhost:4000/api/auth/callback/google` as an authorized redirect URI in Google Cloud. To enable email/password sign-up, configure all SMTP variables. New email/password accounts must verify their address, and password resets use the same SMTP service. The API accepts credentialed requests only from `APP_ORIGIN`.

This API foundation does not yet create boards or restrict Liveblocks room access. Until board membership and sharing checks are implemented, the existing demo authorization policy still applies.

### Configuration

| Variable | Needed for | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | AI routes | Get one at https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | AI routes | Defaults to `gemini-2.5-flash`; use any model your API project can access |
| `GEMINI_FALLBACK_MODEL` | Optional AI fallback | Used once after the primary model fails twice with overload or timeout |
| `GEMINI_EMBEDDING_MODEL` | Embedding calls | Defaults to `gemini-embedding-001`; used by `/api/similarity` |
| `GEMINI_EMBEDDING_FALLBACK_MODEL` | Optional embedding fallback | Must be an embedding model; generation fallback is never used for embeddings |
| `LIVEBLOCKS_SECRET_KEY` | Shared boards | Get one at https://liveblocks.io/dashboard. Used by `/api/liveblocks-auth` |

All keys stay on the server. `.env.local` is git-ignored.

Each Gemini attempt has a 30-second timeout. On overload, quota exhaustion, or timeout, the server waits one second and retries once. If that attempt fails for the same causes, it calls the configured fallback once. Other errors stop immediately. A merge can take about 91 seconds across all three attempts; the browser waits 96 seconds. Error responses name the cause of a failed request.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | Board model tests, plus AI retry, fallback, validation, and error tests with mocked provider responses |
| `npm run typecheck` | Generate route types and run `tsc` |

## Project structure

```text
src/app/                         Pages and route handlers
src/app/api/merge/               AI merge endpoint (Zod-validated, Gemini)
src/app/api/similarity/          Embedding similarity endpoint
src/app/api/liveblocks-auth/     Guest authorization for shared boards
src/features/board/              Canvas UI, board model, fixtures, connect gesture, physics
src/lib/ideas.ts                 Merge request and result schemas
src/lib/ai.ts                    Server-only Gemini calls, validation, and error responses
src/lib/similarity.ts            Mean-centered embedding similarity and its cache
src/server/                      Express account API (Better Auth, MongoDB)
```

**Stack:** Next.js (App Router), React, TypeScript, React Flow, d3-force, Liveblocks, Gemini (`@google/genai`), Zod, Express, Better Auth, MongoDB.

## Status

This is an early hackathon build. The canvas keeps its board in memory and doesn't yet call the AI or Liveblocks routes, so merging, shared boards, and persistence aren't available in the UI. Undo isn't implemented. The app has no rate limit of its own on AI requests; Gemini's quotas apply. See the [roadmap](docs/roadmap.md) for what has been verified and what's next.

## Documentation

- [Decisions](docs/decisions.md): product scope, architecture, and tradeoffs
- [Roadmap](docs/roadmap.md): current status, plan, and evaluation
- [Writing style](docs/writing-style.md): how to write docs and code comments
- [Contributor guide](AGENTS.md)
