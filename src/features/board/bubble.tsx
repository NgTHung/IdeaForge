import type { PointerEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Idea } from "./model";

export type IdeaNode = Node<{
  idea: Idea;
  connecting: boolean;
  source: boolean;
  editing: boolean;
  onEdit: () => void;
  onStartConnection: (event: PointerEvent<HTMLDivElement>) => void;
}, "idea">;

export function Bubble({ data, selected }: NodeProps<IdeaNode>) {
  const { idea } = data;
  return <div data-idea-id={idea.id}
    className={`board-bubble ${selected ? "is-selected" : ""} ${data.source ? "is-source" : ""} ${data.editing ? "is-editing" : ""}`}
    onPointerDown={data.connecting ? data.onStartConnection : undefined}
    onDoubleClick={(event) => { if (!data.connecting) { event.stopPropagation(); data.onEdit(); } }}>
    <Handle id="target-left" type="target" position={Position.Left} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-left" type="source" position={Position.Left} isConnectable={false} className="board-hidden-handle" />
    <div className="board-bubble-top"><span className="board-bubble-kicker">IDEA</span>{idea.pinned && <span title="Pinned" aria-label="Pinned">⌖</span>}</div>
    <h3>{idea.title}</h3><p>{idea.content || "Add a few details to this idea."}</p>
    {data.connecting && <span className="board-connect-dot" aria-hidden="true" />}
    <Handle id="target-right" type="target" position={Position.Right} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-right" type="source" position={Position.Right} isConnectable={false} className="board-hidden-handle" />
  </div>;
}
