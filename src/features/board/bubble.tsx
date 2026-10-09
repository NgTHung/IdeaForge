import type { CSSProperties, PointerEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ideaCardSize, type Idea } from "./model";
import { MarkdownText } from "./markdown-text";
import { IdeaUpvote, type IdeaUpvoteProps } from "./idea-upvote";

export type IdeaNode = Node<{
  idea: Idea;
  preview?: boolean;
  voting?: Omit<IdeaUpvoteProps, "ideaTitle">;
  editingBy?: string;
  connecting: boolean;
  source: boolean;
  editing: boolean;
  squash: { axis: "x" | "y"; token: number } | null;
  clusterLabel?: string;
  clusterColor?: number;
  descriptionStatus?: { kind: "pending" | "error" | "question"; message?: string };
  mergeIndex: number;
  onMergeDetails?: () => void;
  onAssistantDetails?: () => void;
  onRetryDescription?: () => void;
  onSelect: (additive: boolean) => void;
  onEdit: () => void;
  onStartConnection: (event: PointerEvent<HTMLDivElement>) => void;
}, "idea" | "assistantPreview">;

function motionStyle(idea: Idea, clusterLabel?: string): CSSProperties {
  let hash = 0;
  for (const character of idea.id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  const seed = Math.abs(hash);
  const size = ideaCardSize(idea, clusterLabel);
  return {
    width: size.width,
    height: size.height,
    "--float-duration": `${2.5 + seed % 17 / 10}s`,
    "--float-delay": `${-(seed % 53 / 10)}s`,
  } as CSSProperties;
}

export function Bubble({ data, selected, dragging }: NodeProps<IdeaNode>) {
  const { idea } = data;
  const squashing = data.squash ? `is-squashing-${data.squash.axis}` : "";
  return <div data-idea-id={idea.id}
    style={motionStyle(idea, data.clusterLabel)}
    role="group" tabIndex={0} aria-label={`Idea: ${idea.title}. Press Enter to select.`}
    className={`board-bubble ${data.voting ? "has-voting" : ""} ${selected ? "is-selected" : ""} ${data.source ? "is-source" : ""} ${data.editing ? "is-editing" : ""} ${dragging ? "is-dragging" : ""} ${data.mergeIndex ? "is-merge-source" : ""} ${idea.merge ? "is-merged" : ""} ${data.clusterColor === undefined ? "" : `cluster-color-${data.clusterColor}`} ${squashing}`}
    onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.stopPropagation(); data.onSelect(event.shiftKey); } }}
    onPointerDown={data.connecting ? data.onStartConnection : undefined}
    onDoubleClick={(event) => { if (!data.connecting) { event.stopPropagation(); data.onEdit(); } }}>
    <Handle id="target-left" type="target" position={Position.Left} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-left" type="source" position={Position.Left} isConnectable={false} className="board-hidden-handle" />
    <Handle id="target-top" type="target" position={Position.Top} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-top" type="source" position={Position.Top} isConnectable={false} className="board-hidden-handle" />
    <div className="board-bubble-float"><div key={data.squash?.token ?? "idle"} className="board-bubble-squash"><div className="board-bubble-surface">
      <div className="board-bubble-top"><span className="board-bubble-kicker">{idea.assistant ? "ASSISTANT IDEA" : idea.merge ? "COMBINED CONCEPT" : "IDEA"}</span><span className="board-bubble-badges">{data.mergeIndex > 0 && <span className="board-merge-index" aria-label={`Merge idea ${data.mergeIndex}`}>{data.mergeIndex}</span>}{data.clusterLabel && !idea.merge && <span className="board-cluster-badge">{data.clusterLabel}</span>}{idea.pinned && <span className="board-pinned" title="Pinned idea">PINNED</span>}</span></div>
      {idea.merge && data.clusterLabel && <div className="board-merged-cluster-line"><span className="board-cluster-badge">{data.clusterLabel}</span></div>}
      {data.editingBy && <span className="board-card-editing-lock" title={`${data.editingBy} is editing this idea`}>{data.editingBy} editing</span>}
      <h3>{idea.title}</h3>{idea.author && !idea.merge && <small className="board-bubble-author">By {idea.author}</small>}
      {idea.descriptionGeneration && <small className="board-description-provenance" title={`Generated with ${idea.descriptionGeneration.model} on ${new Date(idea.descriptionGeneration.generatedAt).toLocaleString()}`}>
        {idea.content.trim() === idea.descriptionGeneration.generatedContent.trim() ? "AI-generated description" : "Edited after AI generation"}
      </small>}
      {data.descriptionStatus?.kind === "pending" && <small className="board-description-status" role="status">Generating description…</small>}
      {data.descriptionStatus?.kind === "error" && <div className="board-description-status is-error" role="alert"><span>{data.descriptionStatus.message}</span>
        <button type="button" className="nodrag nopan" onClick={(event) => { event.stopPropagation(); data.onRetryDescription?.(); }}>Try again</button>
      </div>}
      {data.descriptionStatus?.kind === "question" && <div className="board-description-status is-question" role="status"><span>{data.descriptionStatus.message}</span>
        <button type="button" className="nodrag nopan" onClick={(event) => { event.stopPropagation(); data.onEdit(); }}>Add details</button>
      </div>}
      {(idea.content || !data.descriptionStatus) && <MarkdownText className="board-bubble-markdown">{idea.content || "Add a few details to this idea."}</MarkdownText>}
      {idea.merge && <button type="button" className="board-merge-details-button nodrag nopan" onClick={(event) => { event.stopPropagation(); data.onMergeDetails?.(); }}>How this idea was made</button>}
      {idea.assistant && !data.preview && <button type="button" className="board-merge-details-button nodrag nopan" onClick={(event) => { event.stopPropagation(); data.onAssistantDetails?.(); }}>Show assistant sources</button>}
      {data.voting && <div className="board-bubble-voting"><IdeaUpvote ideaTitle={idea.title} {...data.voting} /></div>}
      {data.connecting && <span className="board-connect-dot" aria-hidden="true" />}
    </div></div></div>
    <Handle id="target-right" type="target" position={Position.Right} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-right" type="source" position={Position.Right} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-bottom" type="source" position={Position.Bottom} isConnectable={false} className="board-hidden-handle" />
    <Handle id="target-bottom" type="target" position={Position.Bottom} isConnectable={false} className="board-hidden-handle" />
  </div>;
}
