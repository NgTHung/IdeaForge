"use client";

import { ViewportPortal } from "@xyflow/react";
import { defaultClusterStyle, styleColor } from "./personalization";
import { ideaCardSize, type Board } from "./model";
import type { NodeSize } from "./node-layout";
import { BorderDecorations } from "./border-decorations";

export function ClusterDecorations({ board, positions, sizes }: { board: Board; positions: Record<string, { x: number; y: number }>; sizes: Record<string, NodeSize | undefined> }) {
  return <ViewportPortal><div className="cluster-decorations">
    {board.clusterSnapshot?.result.groups.map((group, index) => {
      const members = board.ideas.filter((idea) => group.noteIds.includes(idea.id));
      if (!members.length) return null;
      const label = group.label.trim() || `Group ${index + 1}`;
      const bounds = members.map((idea) => ({ ...positions[idea.id] ?? idea.position, ...sizes[idea.id] ?? ideaCardSize(idea, label) }));
      const left = Math.min(...bounds.map((item) => item.x)) - 18;
      const top = Math.min(...bounds.map((item) => item.y)) - 44;
      const width = Math.max(...bounds.map((item) => item.x + item.width)) - left + 18;
      const height = Math.max(...bounds.map((item) => item.y + item.height)) - top + 18;
      const style = group.appearance ?? defaultClusterStyle;
      return <div key={group.id} className="cluster-decoration" data-border={style.border} data-boundary={style.boundary} style={{ left, top, width, height, "--style-color": styleColor(style.color) ?? "#32856a" } as React.CSSProperties}>
        {style.boundary && <BorderDecorations border={style.border} cluster size={{ width, height }} />}
        <div className="cluster-heading" title={label}><span aria-hidden="true">{style.boundary ? ({ cat: "/ᐠ｡ꞈ｡ᐟ\\ ", clouds: "☁ ", stars: "✦ ", flowers: "✿ ", paper: "▤ " } as Record<string, string>)[style.border] : ""}</span>{label}</div>
      </div>;
    })}
  </div></ViewportPortal>;
}
