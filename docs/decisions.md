# Decisions

This document records the current product and architecture choices for IdeaForge. Read it before changing the scope, architecture, or access policy. The log records the change from the earlier merge prototype to the current local canvas.

## Product

IdeaForge is a local canvas for brainstorming student collaboration ideas. People add, edit, move, pin, connect, and delete idea bubbles. A relationship records a type and optional explanation. **Works well together** and **Conflicts with** are symmetric; **Extends** points from the extending idea to the idea it extends.

Connect mode starts when a person presses an idea and drags into another. Releasing over the target opens the relationship chooser. A link is created only after confirmation. The board begins with five sample ideas and two links, and can become empty.

Physics is mechanical layout behavior. One d3-force simulation gives unpinned ideas mild repulsion, collision avoidance, and gentle springs along links. It does not infer meaning. Pinning or editing fixes an idea while the simulation runs. People can turn physics off and manually arrange the board.

The assistant sidebar and AI toolbar controls remain visible to show the intended workspace layout. The assistant returns a fixed message that says AI is not connected. AI controls and Share are disabled; no result claims to analyze the board.

## Architecture and access

Next.js serves the single route at `/`. React Flow manages the viewport, nodes, and edges. `src/features/board/` owns the local board model, fixtures, UI, connection drag gesture, and force simulation. Board data lives in React memory and resets on refresh. The app has no API routes, authentication, provider credentials, collaboration, or persistence.

The app uses npm and its lockfile. Keep dependencies limited to the current interface. If an AI or shared-board capability returns, use real provider calls with credentials kept on the server, and record that new access policy here first.

## Log

- **2026-10-06: account and database architecture accepted.** The team will add a Node.js Express API with TypeScript and MongoDB. Owners must sign in, using Google or email and password, to create and manage boards. Guests and signed-in participants can edit through a valid sharing link. MongoDB will own account records, sessions, board metadata, ownership, memberships, and sharing records. Liveblocks will remain the authoritative store for board goals, cards, positions, relationship links, accepted merges, and source snapshots. Presence remains temporary. The rendered canvas and unsaved previews remain browser state. These decisions replace the earlier deferral of accounts and a separate database.
- **2026-10-06: Better Auth selected.** Better Auth will handle Google OAuth and email/password accounts, and store users and sessions in MongoDB. Email/password accounts must verify their email address. The Express API will send verification and password-reset mail through configured SMTP credentials. Google sign-in requires verified Google email addresses. Only explicitly configured frontend origins may use credentialed requests. In production, host the API and frontend on the same site so browser cookie rules allow authenticated requests. The existing guest authorization remains until board memberships and share-link grants are enforced by the API.
- **2026-10-05: initial decisions accepted**, as recorded above.
- **2026-10-05: development audit advisory accepted.** `npm audit` reports five high-severity findings in the dev-only lint chain (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`). No patched `braces` release exists. Don't force-downgrade Next tooling to an unrelated major version; recheck during the week.
- **2026-10-05: daily AI cap removed.** The demo first enforced 100 Gemini calls per UTC day with a persistent counter. It was removed at the user's request after merges started failing. The counter showed only two attempts, so the cap itself wasn't the cause. The gate, counter, and its tests were deleted. The failure didn't recur after a restart, and its cause is still unknown.
- **2026-10-05: scope consolidated with the team discussion brief.** The changes are:
  - The differentiator moved from the merge itself to finding which pair to merge.
  - Typed relationships with review were added: works well together, conflicts with, and extends.
  - Organize on demand replaced continuous physics.
  - Display names, card authors, card deletion, an editing lock, and the concept brief joined the MVP.
  - Merge previews became editable and link-aware, with stale-source checks.
  - AI calls gained a shared retry and fallback module.
  - Deployment moved to Day 1.
  - The chatbot became a stretch goal, and retrieval over documents was deferred.

  The team kept this repository's stack instead of the brief's Express, Socket.IO, and MongoDB proposal. Evidence for these choices is in [Similarity](#similarity) and [AI reliability](#ai-reliability). The 503 overload seen that day is one possible cause of the earlier unexplained merge failure. The merge route reported every error with the same message, so the cause can't be confirmed.

## References

- [Miro AI sticky-note capabilities](https://help.miro.com/hc/en-us/articles/28781881506834-Miro-AI-with-Sticky-notes)
- [React Flow](https://reactflow.dev/)
- [React Flow force layout example](https://reactflow.dev/examples/layout/force-layout)
- [React Flow Pro examples](https://reactflow.dev/examples/pro-examples)
- [D3 force simulations](https://d3js.org/d3-force/simulation)
- [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Liveblocks React setup](https://liveblocks.io/docs/get-started/react)
- [Liveblocks Storage guide](https://liveblocks.io/docs/guides/how-to-use-liveblocks-storage-with-react)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings)
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)
- [tldraw licensing](https://tldraw.dev/community/license)
- **2026-10-05:** The project began as a shared merge prototype using Gemini and Liveblocks. Its decisions and evaluations described a different product direction.
- **2026-10-06:** A separate local canvas demo was added at `/demo`, with mechanical physics and labeled AI placeholders. The merge prototype still occupied `/` at that point.
- **2026-10-06:** At the user's request, the local canvas became the app at `/`. The old merge and shared-board code, routes, provider dependencies, and unused styles were removed. Connect changed from clicking two ideas to dragging one idea into another. Physics was retuned for softer, slower motion.
