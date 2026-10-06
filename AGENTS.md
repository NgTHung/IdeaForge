# Working in IdeaForge

A local brainstorming canvas for a hackathon project. Before changing product scope, architecture, or access policy, read `docs/decisions.md` and log the change there. Priorities and verification status live in `docs/roadmap.md`.

When `AGENTS.local.md` exists, read it for local instructions.

## Invariants

- Provider credentials stay server-side if provider calls are added.
- Relationships keep their type and direction; an Extends link points from the extending idea to its target.
- Label canned or mocked AI results. Do not imply that a placeholder analyzed the board.

## Working style

- Long-term maintainability comes first. Extract shared logic into a module its callers reuse, and refactor existing code freely when it leaves one source of truth. Sweeping changes are welcome while the project is WIP.
- After code changes, run `npm run lint`, `npm run typecheck`, and `npm run build`.
- Verify external integrations only when they exist and credentials are available, and report what went unverified.
- Writing docs, design notes, or code comments: follow `docs/writing-style.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
