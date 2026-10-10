"use client";

import { useViewport, ViewportPortal } from "@xyflow/react";
import type { CursorStyle } from "./personalization";

export type LiveCursor = {
  connectionId: number;
  name: string;
  color: string;
  shape?: CursorStyle["shape"];
  x: number;
  y: number;
};

export function LiveCursors({ cursors }: { cursors: LiveCursor[] }) {
  const { zoom } = useViewport();
  return <ViewportPortal>
    <div className="board-live-cursors" aria-hidden="true">
      {cursors.map((cursor) => <div className="board-live-cursor" key={cursor.connectionId}
        style={{ left: cursor.x, top: cursor.y, transform: `scale(${1 / zoom})`, transformOrigin: "top left" }}>
        {cursor.shape === "cat" ? <svg className="board-live-cursor-cat" viewBox="0 0 28 28" aria-hidden="true"><path d="M3 22V3l8 6h6l8-6v19Q14 29 3 22Z" fill={cursor.color} stroke="white" strokeWidth="2" /><path d="M9 15h1m8 0h1m-7 5 2 1 2-1" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg> : cursor.shape === "arrow" ? <svg className="board-live-cursor-arrow" viewBox="0 0 24 28" aria-hidden="true"><path d="M2 2v22l6-6 5 9 4-2-5-9h9Z" fill={cursor.color} stroke="white" strokeWidth="2" /></svg> : <span className="board-live-cursor-dot" style={{ backgroundColor: cursor.color }} />}
        <span className="board-live-cursor-name" style={{ backgroundColor: cursor.color }}>{cursor.name}</span>
      </div>)}
    </div>
  </ViewportPortal>;
}
