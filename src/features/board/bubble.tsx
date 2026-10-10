import { useContext, useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ideaCardSize, type Idea } from "./model";
import { MarkdownText } from "./markdown-text";
import { IdeaUpvote, type IdeaUpvoteProps } from "./idea-upvote";
import { AnimationContext } from "./board-activity";
import { styleColor } from "./personalization";
import { CloudFrame } from "./cloud-frame";

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
  clusterAccent?: string;
  mergeIndex: number;
  onMergeDetails?: () => void;
  onAssistantDetails?: () => void;
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
    "--style-color": idea.appearance ? styleColor(idea.appearance.color) ?? (idea.appearance.border === "clouds" ? "#32856a" : undefined) : undefined,
  } as CSSProperties;
}

export function Bubble({ data, selected, dragging }: NodeProps<IdeaNode>) {
  const { idea } = data;
  const { motion } = useContext(AnimationContext);
  const surface = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLSpanElement>(null);
  const previous = useRef({ dragging: Boolean(dragging), pinned: idea.pinned });
  useEffect(() => {
    const animations: Animation[] = [];
    if (motion && previous.current.dragging && !dragging) animations.push(surface.current!.animate([
      { transform: "translateY(-8px) rotate(-1.5deg) scale(1.025)" },
      { transform: "translateY(2px) rotate(.4deg) scale(.995)", offset: .7 }, { transform: "none" },
    ], { duration: 360, easing: "ease-out" }));
    if (motion && !previous.current.pinned && idea.pinned && pin.current) animations.push(pin.current.animate([
      { transform: "translateY(-18px) rotate(-25deg) scale(1.3)", opacity: 0 },
      { transform: "translateY(2px) rotate(8deg)", opacity: 1, offset: .7 }, { transform: "none", opacity: 1 },
    ], { duration: 430, easing: "ease-out" }));
    previous.current = { dragging: Boolean(dragging), pinned: idea.pinned };
    return () => animations.forEach((animation) => animation.cancel());
  }, [dragging, idea.pinned, motion]);
  const squashing = data.squash ? `is-squashing-${data.squash.axis}` : "";
  return <div data-idea-id={idea.id}
    data-border={idea.appearance?.border} data-styled={Boolean(idea.appearance && idea.appearance.color !== "default")}
    style={{ ...motionStyle(idea, data.clusterLabel), "--cluster-accent": data.clusterAccent } as CSSProperties}
    role="group" tabIndex={0} aria-label={`Idea: ${idea.title}. Press Enter to select.`}
    className={`board-bubble ${data.voting ? "has-voting" : ""} ${selected ? "is-selected" : ""} ${data.source ? "is-source" : ""} ${data.editing ? "is-editing" : ""} ${dragging ? "is-dragging" : ""} ${data.mergeIndex ? "is-merge-source" : ""} ${idea.merge ? "is-merged" : ""} ${data.clusterColor === undefined ? "" : `cluster-color-${data.clusterColor}`} ${squashing}`}
    onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.stopPropagation(); data.onSelect(event.shiftKey); } }}
    onPointerDown={data.connecting ? data.onStartConnection : undefined}
    onDoubleClick={(event) => { if (!data.connecting) { event.stopPropagation(); data.onEdit(); } }}>
    <Handle id="target-left" type="target" position={Position.Left} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-left" type="source" position={Position.Left} isConnectable={false} className="board-hidden-handle" />
    <Handle id="target-top" type="target" position={Position.Top} isConnectable={false} className="board-hidden-handle" />
    <Handle id="source-top" type="source" position={Position.Top} isConnectable={false} className="board-hidden-handle" />
    <div className="board-bubble-float"><div key={data.squash?.token ?? "idle"} className="board-bubble-squash"><div ref={surface} className="board-bubble-surface">
      {idea.appearance?.border === "clouds" && <CloudFrame size={ideaCardSize(idea, data.clusterLabel)} />}
      {idea.merge && <span className="merged-note-sigil" aria-hidden="true">✦</span>}
      <div className="board-bubble-top"><span className="board-bubble-kicker">{idea.assistant ? "ASSISTANT IDEA" : idea.merge ? "✦ COMBINED CONCEPT" : "IDEA"}</span><span className="board-bubble-badges">{data.mergeIndex > 0 && <span className="board-merge-index" aria-label={`Merge idea ${data.mergeIndex}`}>{data.mergeIndex}</span>}{data.clusterLabel && !idea.merge && <span className="board-cluster-badge">{data.clusterLabel}</span>}{idea.pinned && <span ref={pin} className="board-pinned" title="Pinned idea"><span aria-hidden="true">📌</span> PINNED</span>}</span></div>
      {idea.merge && data.clusterLabel && <div className="board-merged-cluster-line"><span className="board-cluster-badge">{data.clusterLabel}</span></div>}
      {data.editingBy && <span className="board-card-editing-lock" title={`${data.editingBy} is editing this idea`}>{data.editingBy} editing</span>}
      <h3>{idea.title}</h3>{idea.author && !idea.merge && <small className="board-bubble-author">By {idea.author}</small>}<MarkdownText className="board-bubble-markdown">{idea.content || "Add a few details to this idea."}</MarkdownText>
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
