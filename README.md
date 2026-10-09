# IdeaForge

A brainstorming canvas for capturing ideas and drawing typed relationships between them. You can group notes by embedding similarity, choose the number of groups, and place new notes into an existing group. The home screen creates or joins shared boards. The canvas offers editable merge previews and automatic relationship suggestions.

Built in one week for Forgehack.

## Use the board

Open the home screen, choose **Create board** or join a board link, then enter your display name if asked. Choose **Add idea**, then click empty canvas space to place a note. Double-click a note or select it and choose **Edit** to change its title and content. Drag a note to move it; select it to pin or delete it. A new shared board starts with five ideas and two relationships, and saves later changes through Liveblocks.

Choose **Connect**, then drag from one idea into another. Release over the target, choose **Works well together**, **Conflicts with**, or **Extends**, and optionally explain the link. The arrow for **Extends** points from the extending idea to the idea it extends. Select a connection to delete it.

Choose **Organize** to group notes by embedding similarity. Select 2 to 10 groups, review the scores, then choose **Organize canvas** to arrange the rectangular notes in separate spatial groups. Similar note pairs are placed closer when space permits; every pair's similarity and distance is returned by the clustering endpoint. Group badges identify membership without drawing bubble regions. GLM-5.3-Flash on Featherless suggests concise group names after organizing, and you can rename them in the Organize panel. Naming sends up to 300 characters from each note to Featherless. Pinned notes stay where they are, and you can undo the layout before moving a note. After the first Organize, turn on **Place new notes in an existing group** in the add-note dialog. Saving a new note then moves only that note near its most similar existing group. The switch remembers your choice in this browser. Set `GEMINI_API_KEY` to enable grouping and placement, and `FEATHERLESS_API_KEY` to enable naming. Shared boards save group membership, labels, and positions through Liveblocks.

Use **Select** or **Hand / Pan** for navigation. Hold Space while dragging to pan, scroll to zoom, and use the lower-left controls to zoom or fit the ideas. Physics is disabled on shared boards so saved positions stay in place. The assistant panel accepts prompts and returns a fixed message that states AI is not connected. Select two notes to request a merge preview; keeping it preserves both originals and their source snapshots.

Automatic relationship suggestions use local text matching to shortlist pairs, then Jev classifies them. They do not call the generation model or an embedding API. Review up to three dashed connections, write an explanation or choose **Explain with AI**, then accept. A conflict also needs a condition. Local matching can miss translations and complementary ideas that use different words.

## Getting started

Requirements: Node.js 24+ and npm.

```bash
npm ci
cp .env.example .env.local   # add account settings and provider keys here
npm run dev
```

Open http://localhost:3000. Set `LIVEBLOCKS_SECRET_KEY` to create and use shared boards, set `GEMINI_API_KEY` to use **Organize**, and set `FEATHERLESS_API_KEY` to merge notes and generate names and explanations. You can view the landing screen without any of these keys.

### Account API setup

Next.js serves accounts, sessions, board metadata, and AI routes in the same process. In `.env.local`, set `MONGODB_URI` to the Atlas connection string and `MONGODB_DB_NAME` to `ideaforge_dev`, and generate `BETTER_AUTH_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Keep `.env.local` out of Git. The MongoDB username and password belong in the URI; URL-encode special characters in them.

Set `APP_ORIGIN` to `http://localhost:3000` and run `npm run dev`. Account and board requests use relative URLs on the app origin. `/healthz` pings MongoDB and returns `{ "status": "ok" }` when the database responds. Configuration and connections initialize on demand, so builds and the landing screen work without account credentials. Account routes require the MongoDB settings and auth secret at runtime.

To enable Google sign-in, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in Google Cloud. To enable email/password sign-up, configure all SMTP variables. New email/password accounts must verify their address, and password resets use the same SMTP service. Better Auth trusts `APP_ORIGIN`, and board mutations require that origin.

When migrating an existing setup, keep the MongoDB database and `BETTER_AUTH_SECRET`, set `APP_ORIGIN` to the app URL, and remove `API_PORT`, `API_ORIGIN`, and `NEXT_PUBLIC_API_URL`. Update the Google redirect URI to use the app URL and configure the same server-side settings on your host. Run `npm run build` and `npm start` for production. No separate API server or database migration is needed.

Sign in before creating a board. **Create board** asks for a goal or topic and optional description, then saves board metadata, ownership, and an owner membership in MongoDB. The canvas lives in the referenced Liveblocks room. Open `/dashboard` to see your boards and joined shared boards. A signed-in user joins a shared board when they open its UUID link; anonymous guests can still edit with the link. Invitations are not supported yet. A valid UUID board link still grants anyone with the link full edit access, matching the current demo policy; MongoDB membership does not restrict Liveblocks access yet.

### Google sign-in on Vercel

Better Auth constructs Google's callback from `APP_ORIGIN`. Set it to the stable URL you use to open the app. This repository passes `APP_ORIGIN` as Better Auth's `baseURL`, so setting `BETTER_AUTH_URL` alone does not change the callback.

In Google Cloud Console, open APIs & Services, then Credentials, and edit the Web application OAuth client matching `GOOGLE_CLIENT_ID`. Add the full callback URL under Authorized redirect URIs. Authorized JavaScript origins do not register callbacks. Use these values for local development and the current production domain:

| Environment | `APP_ORIGIN` | Authorized redirect URI |
| --- | --- | --- |
| Local | `http://localhost:3000` | `http://localhost:3000/api/auth/callback/google` |
| Production | `https://idea-forge-wine.vercel.app` | `https://idea-forge-wine.vercel.app/api/auth/callback/google` |

If you use another production domain, replace both production URLs. In Vercel Project Settings, set `APP_ORIGIN`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` for the Production environment. Keep `BETTER_AUTH_SECRET` and the MongoDB settings configured. Redeploy after changing environment variables; existing deployments retain their earlier settings.

For preview sign-in, use a stable staging or branch hostname. Set that preview's `APP_ORIGIN` to the hostname and register its exact callback with the corresponding Google OAuth client. Each generated deployment hostname needs a separate callback registration. Pointing preview auth at production would send the callback to a different host from the one that started sign-in.

If Google returns `redirect_uri_mismatch`, inspect `redirect_uri` in the error details. Compare its protocol, hostname, port, and path with the registered callback for the client in use. A callback on port 4000 belongs to the former Express service; the migrated local app uses port 3000. See [Google's OAuth requirements](https://developers.google.com/identity/protocols/oauth2/web-server), [Better Auth's Google setup](https://better-auth.com/docs/authentication/google), and [Vercel environment variables](https://vercel.com/docs/environment-variables).

### Configuration

| Variable | Needed for | Notes |
| --- | --- | --- |
| `FEATHERLESS_API_KEY` | Merges, group names, and relationship explanations | Get one at https://featherless.ai/account/api-keys |
| `FEATHERLESS_MODEL` | Generation | Defaults to `zai-org/GLM-5.3-Flash`; use any Featherless chat model your plan can access |
| `FEATHERLESS_FALLBACK_MODEL` | Optional generation fallback | Used once after the primary model fails twice with overload or timeout |
| `FEATHERLESS_REASONING_EFFORT` | Generation | `low` (default), `high`, or `max`; higher effort is slower |
| `GEMINI_API_KEY` | Embedding calls | Get one at https://aistudio.google.com/apikey |
| `GEMINI_EMBEDDING_MODEL` | Embedding calls | Defaults to `gemini-embedding-001`; used by `/api/similarity` and `/api/similarity/clusters` |
| `GEMINI_EMBEDDING_FALLBACK_MODEL` | Optional embedding fallback | Must be an embedding model; generation fallback is never used for embeddings |
| `TYPESAFE_API_KEY` | Automatic relationship classification | Server-side TypeSafe credential; no generation-model fallback |
| `JEV_MODEL` | Relationship classifier | Defaults to `jev-1.13.0` |
| `MONGODB_URI` / `MONGODB_DB_NAME` | Accounts, board metadata, suggestion cache, and allowances | Shared across server workers; database defaults to `ideaforge_dev` |
| `APP_ORIGIN` | Accounts and board mutations | App URL, defaulting to `http://localhost:3000`; also sets OAuth and account email URLs |
| `BETTER_AUTH_SECRET` | Accounts and board routes | Server-only secret of at least 32 characters; keep it when migrating |
| `CONNECTION_JEV_DAILY_REQUEST_LIMIT` | Automatic suggestion allowance | Defaults to 200 provider requests per UTC day across the app; 0 disables new calls |
| `CONNECTION_EXPLANATION_DAILY_REQUEST_LIMIT` | Requested explanation allowance | Defaults to 20 generation requests per UTC day across the app; 0 disables new calls |
| `LIVEBLOCKS_SECRET_KEY` | Shared boards | Get one at https://liveblocks.io/dashboard. Used by `/api/liveblocks-auth` |

All keys stay on the server. `.env.local` is git-ignored.

Except for relationship explanations, each Featherless or Gemini attempt has a 30-second timeout. On overload, quota exhaustion, or timeout, the server waits one second and retries once. If that attempt fails for the same causes, it calls the configured fallback once. Other errors stop immediately. A merge can take about 91 seconds across all three attempts; the browser waits 96 seconds. Error responses name the cause of a failed request.

Relationship classification and explanations each make one provider attempt, without retry or fallback. Classification sends at most 24 pairs and 48 KB per batch, with a 20-second provider timeout and a shared 30-second board cooldown. Pair judgments and board results expire after 24 hours. Repeated unchanged boards reuse their result; remaining candidates wait for a board change or cache expiry. Explanation results are cached by goal, source text, type, direction, and model. Failed provider attempts still consume the allowance. Merge and Organize requests use their existing policies outside these suggestion allowances.

For access on this machine through Tailscale, bind Next.js to `0.0.0.0` and open `http://100.102.144.120:3000`. `APP_ORIGIN` must match the address used by the browser.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | Board models, account configuration, board handlers, clustering, and AI contracts with mocked storage and provider responses |
| `npm run typecheck` | Generate route types and run `tsc` |

## Project structure

```text
src/app/                         Pages and route handlers
src/app/api/auth/                Better Auth account endpoints
src/app/api/boards/              Board metadata, dashboard, membership, and title endpoints
src/app/api/session/             Current account user endpoint
src/app/healthz/                 MongoDB health endpoint
src/app/api/merge/               AI merge endpoint (Zod-validated, Featherless)
src/app/api/similarity/          Embedding similarity endpoint
src/app/api/similarity/clusters/  User-count clustering endpoint
src/app/api/liveblocks-auth/     Guest authorization for shared boards
src/features/board/              Canvas UI, board model, cluster layout, fixtures, connect gesture, physics
src/lib/ideas.ts                 Merge request and result schemas
src/lib/ai.ts                    Server-only Featherless generation and Gemini embedding calls, validation, and error responses
src/lib/similarity.ts            Embedding similarity and its cache
src/lib/cluster-algorithm.ts     Deterministic average-linkage grouping and score summaries
src/server/                      Server-only account configuration, Better Auth, MongoDB, and board handlers
```

**Stack:** Next.js (App Router), React, TypeScript, React Flow, d3-force, Liveblocks, Featherless (GLM-5.3-Flash), Gemini embeddings (`@google/genai`), Zod, Better Auth, MongoDB.

## Status

This is an early hackathon build with shared boards, merge previews, and relationship review. Automatic classification requires a TypeSafe key and MongoDB. See the [roadmap](docs/roadmap.md) for verification evidence and remaining work.

## Documentation

- [Decisions](docs/decisions.md): product scope, architecture, and tradeoffs
- [Roadmap](docs/roadmap.md): current status, plan, and evaluation
- [Writing style](docs/writing-style.md): how to write docs and code comments
- [Contributor guide](AGENTS.md)
