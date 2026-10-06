# IdeaForge

IdeaForge is a local brainstorming canvas for capturing ideas and drawing typed relationships between them. You can move and pin ideas while gentle physics keeps the board readable. The assistant and AI controls are labeled placeholders. The board resets when you refresh.

## Run the app

Use Node.js 24 or newer. From PowerShell in this repository, run:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000. No keys or external services are needed.

## Use the board

Choose **Add idea**, then click empty canvas space to place a bubble. Double-click a bubble or select it and choose **Edit** to change its title and content. Drag a bubble to move it; select it to pin or delete it. The sample board starts with five ideas and two relationships.

Choose **Connect**, then drag from one idea into another. Release over the target, choose **Works well together**, **Conflicts with**, or **Extends**, and optionally explain the link. The arrow for **Extends** points from the extending idea to the idea it extends. Select a connection to delete it.

Use **Select** or **Hand / Pan** for navigation. Hold Space while dragging to pan, scroll to zoom, and use the lower-right controls to zoom or fit the ideas. Toggle **Physics** to pause or resume settling. The assistant panel accepts prompts and returns a fixed message that states AI is not connected. **AI Organize**, **Merge ideas**, **Generate brief**, and **Share** are disabled placeholders.

## Code and checks

The app uses Next.js, React Flow, and d3-force. `src/app/` contains the route and base styles. `src/features/board/` contains the board UI, local state actions, fixtures, connection gesture, and physics. There is no backend or persistence.

Run these checks after changing code:

```powershell
node --experimental-strip-types --test tests/board-model.test.mjs
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

The previous merge and shared-board implementation was removed when this canvas became the main app on 2026-10-06. The change is recorded in [decisions](docs/decisions.md); current verification status is in the [roadmap](docs/roadmap.md).
