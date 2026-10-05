# Working in IdeaForge

Read `README.md`, `docs/decisions.md`, and `docs/roadmap.md` before substantial changes.

Keep this a one-week hackathon project centered on merging ideas. Use TypeScript and the existing Next.js, React Flow, Liveblocks, Gemini, and Zod stack. Keep provider credentials server-side. Preserve source snapshots and original notes when merging. Do not replace real AI calls with unlabeled canned results.

Use `npm ci` to install the locked dependencies. Run `npm run lint`, `npm run typecheck`, and `npm run build` after meaningful code changes. Verify live provider behavior only when credentials are available; state limitations clearly. Update the decision log when product scope, architecture, or access policy changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
