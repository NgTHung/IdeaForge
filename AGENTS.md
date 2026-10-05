# Working in IdeaForge

A one-week hackathon project centered on merging ideas. Before changing product scope, architecture, or access policy, read `docs/decisions.md` and log the change there. Priorities and verification status live in `docs/roadmap.md`.

## Invariants

- Provider credentials stay server-side.
- Merging preserves the original notes and their source snapshots.
- AI output comes from real provider calls; label any canned or mocked result.

## Working style

- Long-term maintainability comes first. Extract shared logic into a module its callers reuse, and refactor existing code freely when it leaves one source of truth. Sweeping changes are welcome while the project is WIP.
- After code changes, run `npm run lint`, `npm run typecheck`, and `npm run build`.
- Verify live Gemini and Liveblocks behavior only when credentials are available, and report what went unverified.
- Writing docs, design notes, or code comments: follow `docs/writing-style.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
