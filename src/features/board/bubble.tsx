import type { CSSProperties, PointerEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { IDEA_CARD_SIZE, type Idea } from "./model";

export type IdeaNode = Node<{
  idea: Idea;
  connecting: boolean;
  source: boolean;
  editing: boolean;
  squash: { axis: "x" | "y"; token: number } | null;
  clusterLabel?: string;
  clusterColor?: number;
  onEdit: () => void;
  onStartConnection: (event: PointerEvent<HTMLDivElement>) => void;
}, "idea">;

function motionStyle(id: string): CSSProperties {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  const seed = Math.abs(hash);
  return {
    width: IDEA_CARD_SIZE.width,
    height: IDEA_CARD_SIZE.height,
    "--float-duration": `${2.5 + seed % 17 / 10}s`,
    "--float-delay": `${-(seed % 53 / 10)}s`,
  } as CSSProperties;
}

export function Bubble({ data, selected, dragging }: NodeProps<IdeaNode>) {
  const { idea } = data;
  const squashing = data.squash ? `is-squashing-${data.squash.axis}` : "";
  return <div data-idea-id={idea.id}
    style={motionStyle(idea.id)}
    className={`board-bubble ${selected ? "is-selected" : ""} ${data.source ? "is-source" : ""} ${data.editing ? "is-editing" : ""} ${dragging ? "is-dragging" : ""} ${data.clusterColor === undefined ? "" : `cluster-color-${data.clusterColor}`} ${squashing}`}
    onPointerDown={data.connecting ? data.onStartConnection : undefined}
    onDoubleClick={(event) => { if (!data.connecting) { event.stopPropagation(); data.onEdit(); } }}>
    <Handle id="target-left" type="target" position={Position.Left} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-left" type="source" position={Position.Left} isConnectable={false} className="board-hidden-handle" />
    <div className="board-bubble-float"><div key={data.squash?.token ?? "idle"} className="board-bubble-squash"><div className="board-bubble-surface">
      <div className="board-bubble-top"><span className="board-bubble-kicker">IDEA</span><span className="board-bubble-badges">{data.clusterLabel && <span className="board-cluster-badge">{data.clusterLabel}</span>}{idea.pinned && <span className="board-pinned" title="Pinned idea">PINNED</span>}</span></div>
      <h3>{idea.title}</h3><p>{idea.content || "Add a few details to this idea."}</p>
      {data.connecting && <span className="board-connect-dot" aria-hidden="true" />}
    </div></div></div>
    <Handle id="target-right" type="target" position={Position.Right} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-right" type="source" position={Position.Right} isConnectable={false} className="board-hidden-handle" />
  </div>;
}
