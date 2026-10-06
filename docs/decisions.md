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

- **2026-10-05:** The project began as a shared merge prototype using Gemini and Liveblocks. Its decisions and evaluations described a different product direction.
- **2026-10-06:** A separate local canvas demo was added at `/demo`, with mechanical physics and labeled AI placeholders. The merge prototype still occupied `/` at that point.
- **2026-10-06:** At the user's request, the local canvas became the app at `/`. The old merge and shared-board code, routes, provider dependencies, and unused styles were removed. Connect changed from clicking two ideas to dragging one idea into another. Physics was retuned for softer, slower motion.
