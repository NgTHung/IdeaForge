"use client";

import { ViewportPortal } from "@xyflow/react";

export type LiveCursor = {
  connectionId: number;
  name: string;
  color: string;
  x: number;
  y: number;
};

export function LiveCursors({ cursors }: { cursors: LiveCursor[] }) {
  return <ViewportPortal>
    <div className="board-live-cursors" aria-hidden="true">
      {cursors.map((cursor) => <div className="board-live-cursor" key={cursor.connectionId}
        style={{ left: cursor.x, top: cursor.y }}>
        <span className="board-live-cursor-dot" style={{ backgroundColor: cursor.color }} />
        <span className="board-live-cursor-name" style={{ backgroundColor: cursor.color }}>{cursor.name}</span>
      </div>)}
    </div>
  </ViewportPortal>;
}
