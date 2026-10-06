"use client";

import { useMemo, useRef, useState } from "react";
import {
  Background, Controls, Handle, Panel, Position, ReactFlow,
  type Node, type NodeProps, type NodeChange, type ReactFlowInstance,
} from "@xyflow/react";
import { mergeResultSchema, type Idea, type MergeResult, type Source } from "@/lib/ideas";
import { createIdeaId } from "@/lib/id";
import { AI_REQUEST_TIMEOUT_MS } from "@/lib/ai-policy";

type IdeaNode = Node<{ idea: Idea; onEdit: (text: string) => void }, "idea">;
type NodeLayout = Pick<IdeaNode, "measured" | "dragging">;
type PendingMerge = { result: MergeResult; sources: Source[]; position: Idea["position"] };

function Note({ data, selected }: NodeProps<IdeaNode>) {
  const { idea } = data;
  return <div className={`note ${idea.merge ? "merged" : ""} ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Top} isConnectable={false} />
    <div className="note-kind">{idea.merge ? "Combined concept" : "Idea seed"}</div>
    {idea.title && <h3>{idea.title}</h3>}
    <textarea className="nodrag nowheel" aria-label={idea.title || "Idea text"} maxLength={4000}
      value={idea.text} onChange={(event) => data.onEdit(event.target.value)} />
    {idea.merge && <details className="nodrag nowheel">
      <summary>How this idea was made</summary>
      <p><b>From A:</b> {idea.merge.contributionA}</p>
      <p><b>From B:</b> {idea.merge.contributionB}</p>
      <p><b>Tension:</b> {idea.merge.tension}</p>
      <p><b>Try next:</b> {idea.merge.nextExperiment}</p>
      {idea.parents.map((parent, index) => <p key={parent.id}><b>Source {index === 0 ? "A" : "B"}:</b> {parent.text}</p>)}
    </details>}
    <Handle type="source" position={Position.Bottom} isConnectable={false} />
  </div>;
}

const nodeTypes = { idea: Note };

export function Board({ ideas, goal, onGoalChange, onAdd, onUpdate, status, onShare }: {
  ideas: readonly Idea[];
  goal: string;
  onGoalChange: (goal: string) => void;
  onAdd: (idea: Idea) => void;
  onUpdate: (id: string, patch: Partial<Idea>) => void;
  status: string;
  onShare?: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [nodeLayouts, setNodeLayouts] = useState<Record<string, NodeLayout>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<PendingMerge | null>(null);
  const flow = useRef<ReactFlowInstance<IdeaNode> | null>(null);
  function revealNewIdea() {
    requestAnimationFrame(() => { void flow.current?.fitView({ padding: 0.2, maxZoom: 1, duration: 200 }); });
  }
  const selected = ideas.filter((idea) => selectedIds.includes(idea.id));
  const nodes = useMemo<IdeaNode[]>(() => ideas.map((idea) => ({
    ...nodeLayouts[idea.id],
    id: idea.id, type: "idea", position: idea.position,
    selected: selectedIds.includes(idea.id), deletable: false,
    data: { idea, onEdit: (text) => onUpdate(idea.id, { text }) },
  })), [ideas, nodeLayouts, onUpdate, selectedIds]);
  const edges = useMemo(() => ideas.flatMap((idea) => idea.parents.map((parent) => ({
    id: `${parent.id}-${idea.id}`, source: parent.id, target: idea.id,
    deletable: false, style: { stroke: "#17664f", strokeWidth: 2 },
  }))), [ideas]);

  function onNodesChange(changes: NodeChange<IdeaNode>[]) {
    // Measured sizes must survive data updates: React Flow hides unmeasured nodes.
    setNodeLayouts((current) => {
      let next = current;
      changes.forEach((change) => {
        if (change.type !== "dimensions" && change.type !== "position") return;
        const layout = next[change.id] ?? {};
        let patch: NodeLayout;
        if (change.type === "dimensions" && change.dimensions) {
          if (layout.measured?.width === change.dimensions.width && layout.measured?.height === change.dimensions.height) return;
          patch = { measured: change.dimensions };
        } else if (change.type === "position" && change.dragging !== undefined) {
          if (layout.dragging === change.dragging) return;
          patch = { dragging: change.dragging };
        } else return;
        if (next === current) next = { ...current };
        next[change.id] = { ...layout, ...patch };
      });
      return next;
    });
    const selections = changes.filter((change) => change.type === "select");
    if (selections.length) setSelectedIds((current) => {
      const next = new Set(current);
      selections.forEach((change) => change.selected ? next.add(change.id) : next.delete(change.id));
      return [...next];
    });
    changes.forEach((change) => {
      if (change.type === "position" && change.position) onUpdate(change.id, { position: change.position });
    });
  }

  async function merge() {
    if (selected.length !== 2 || busy) return;
    const sources = selected.map(({ id, text }) => ({ id, text }));
    const position = { x: (selected[0].position.x + selected[1].position.x) / 2, y: Math.max(selected[0].position.y, selected[1].position.y) + 320 };
    setBusy(true);
    setPending(null);
    setMessage("");
    try {
      const response = await fetch("/api/merge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, sources }), signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not merge these notes.");
      setPending({ result: mergeResultSchema.parse(payload.result), sources, position });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not merge these notes. Try again.");
    } finally { setBusy(false); }
  }

  function accept() {
    if (!pending) return;
    const id = createIdeaId();
    onAdd({ id, title: pending.result.title, text: pending.result.concept,
      position: pending.position, parents: pending.sources, merge: pending.result });
    setPending(null);
    setSelectedIds([id]);
    revealNewIdea();
  }

  return <main className="board">
    <header className="topbar">
      <div><div className="brand">IdeaForge<span className="text-emerald-700">.</span></div><div className="subtitle">{status}</div></div>
      <div className="actions">
        {onShare && <button className="button" onClick={onShare}>New shared board</button>}
        <button className="button" onClick={() => {
          const id = createIdeaId();
          onAdd({ id, title: "", text: "", parents: [], merge: null,
            position: { x: (ideas.length % 3) * 320, y: Math.floor(ideas.length / 3) * 280 } });
          setSelectedIds([id]);
          revealNewIdea();
        }}>+ Add note</button>
        <button className="button primary" disabled={busy || selected.length !== 2 || !goal.trim() || selected.some((idea) => !idea.text.trim())}
          onClick={merge}>{busy ? "Combining ideas…" : `Merge ${selected.length}/2`}</button>
      </div>
    </header>
    <div className="goalbar"><label htmlFor="goal">Our goal</label><input id="goal" value={goal} maxLength={500}
      placeholder="What problem are we brainstorming about?" onChange={(event) => onGoalChange(event.target.value)} /></div>
    {message && <div className="notice" role="alert">{message}</div>}
    {busy && <div className="notice" role="status">Finding a concept that uses both ideas…</div>}
    <div className="workspace">
      <div className="canvas"><ReactFlow<IdeaNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onInit={(instance) => { flow.current = instance; }} fitView fitViewOptions={{ maxZoom: 1 }}
        minZoom={0.15} maxZoom={2} multiSelectionKeyCode="Shift" nodesConnectable={false}>
        <Background color="#d5dcd2" gap={24} /><Controls />
        <Panel position="bottom-right"><div className="hint">Click a note’s border to select it. Hold Shift to select a second note, then merge. Your original ideas stay on the canvas.</div></Panel>
      </ReactFlow></div>
      {pending && <aside className="preview" aria-label="Merge proposal">
        <div className="note-kind">Merge proposal</div><h2>{pending.result.title}</h2>
        <p>{pending.result.concept}</p>
        <h3>From idea A</h3><p>{pending.result.contributionA}</p>
        <h3>From idea B</h3><p>{pending.result.contributionB}</p>
        <h3>What needs checking</h3><p>{pending.result.tension}</p>
        <h3>First experiment</h3><p>{pending.result.nextExperiment}</p>
        <div className="actions"><button className="button primary" onClick={accept}>Keep this idea</button>
          <button className="button" onClick={() => setPending(null)}>Discard</button></div>
      </aside>}
    </div>
  </main>;
}
