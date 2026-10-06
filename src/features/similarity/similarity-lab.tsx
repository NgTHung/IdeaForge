"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";

export type LabNote = { id: string; theme: string; text: string };
export type BaselinePair = { sourceId: string; targetId: string; raw: number; centered: number };
type PairScore = { sourceId: string; targetId: string; score: number };
type Comparison = {
  method: "cosine_comparison";
  model: string;
  centeredThreshold: number;
  rawScores: PairScore[];
  centeredScores: PairScore[];
};
type LabNodeData = { note: LabNote; distance?: number; accent: string };
type LabNode = Node<LabNodeData, "similarityNote">;

function pairKey(left: string, right: string) {
  return [left, right].sort().join("|");
}

function distance(score: number) {
  return 1 - score;
}

function SimilarityNoteNode({ data, selected }: NodeProps<LabNode>) {
  const added = data.note.id.startsWith("TEST-");
  return <div className={`sim-note-node ${selected ? "is-focused" : ""} ${added ? "is-added" : ""}`}
    style={{ "--sim-note-accent": data.accent } as CSSProperties}>
    <Handle id="target-left" type="target" position={Position.Left} isConnectable={false} className="sim-node-handle" />
    <Handle id="source-left" type="source" position={Position.Left} isConnectable={false} className="sim-node-handle" />
    <div className="sim-node-meta"><strong>{data.note.id}</strong><span>{data.note.theme}</span></div>
    <p>{data.note.text}</p>
    {data.distance !== undefined && <span className="sim-node-distance">d {data.distance.toFixed(3)}</span>}
    <Handle id="target-right" type="target" position={Position.Right} isConnectable={false} className="sim-node-handle" />
    <Handle id="source-right" type="source" position={Position.Right} isConnectable={false} className="sim-node-handle" />
  </div>;
}

const nodeTypes = { similarityNote: SimilarityNoteNode };
const themeColors = ["#188264", "#477d99", "#ad7950", "#816ca9", "#558969", "#b27462"];

export function SimilarityLab({ goal, initialNotes, baselineModel, baselinePairs }: {
  goal: string;
  initialNotes: LabNote[];
  baselineModel: string;
  baselinePairs: BaselinePair[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [newText, setNewText] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [metric, setMetric] = useState<"centered" | "raw">("centered");
  const [selectedNoteId, setSelectedNoteId] = useState(initialNotes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const flow = useRef<ReactFlowInstance<LabNode> | null>(null);
  const requestInFlight = useRef(false);

  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const addedNotes = useMemo(() => notes.filter((note) => note.id.startsWith("TEST-")), [notes]);
  const themeOrder = useMemo(() => [...new Set(notes.map((note) => note.theme))], [notes]);
  const notePositions = useMemo(() => {
    const rowByTheme = new Map<string, number>();
    return new Map(notes.map((note) => {
      const column = themeOrder.indexOf(note.theme);
      const row = rowByTheme.get(note.theme) ?? 0;
      rowByTheme.set(note.theme, row + 1);
      return [note.id, { x: 70 + column * 330, y: 70 + row * 172 }];
    }));
  }, [notes, themeOrder]);
  const activeScores = useMemo(() => {
    if (comparison) return metric === "raw" ? comparison.rawScores : comparison.centeredScores;
    return baselinePairs.map((pair) => ({
      sourceId: pair.sourceId,
      targetId: pair.targetId,
      score: metric === "raw" ? pair.raw : pair.centered,
    }));
  }, [baselinePairs, comparison, metric]);

  const nearestNotes = useMemo(() => {
    const scores = activeScores.flatMap((pair) => {
      const neighborId = pair.sourceId === selectedNoteId
        ? pair.targetId
        : pair.targetId === selectedNoteId ? pair.sourceId : undefined;
      const note = neighborId ? noteById.get(neighborId) : undefined;
      return note ? [{ note, score: pair.score, distance: distance(pair.score) }] : [];
    });
    return scores.sort((left, right) => left.distance - right.distance).slice(0, 5);
  }, [activeScores, noteById, selectedNoteId]);

  const distanceByNote = useMemo(() => new Map(nearestNotes.map(({ note, distance: value }) => [note.id, value])), [nearestNotes]);
  const nodes = useMemo<LabNode[]>(() => notes.map((note) => ({
    id: note.id,
    type: "similarityNote",
    position: notePositions.get(note.id) ?? { x: 70, y: 70 },
    selected: note.id === selectedNoteId,
    data: {
      note,
      distance: distanceByNote.get(note.id),
      accent: themeColors[themeOrder.indexOf(note.theme) % themeColors.length] ?? themeColors[0],
    },
  })), [distanceByNote, notePositions, notes, selectedNoteId, themeOrder]);

  const edges = useMemo<Edge[]>(() => {
    const focus = notePositions.get(selectedNoteId);
    if (!focus) return [];
    return nearestNotes.map(({ note, distance: value }) => {
      const neighbor = notePositions.get(note.id);
      const neighborOnLeft = Boolean(neighbor && neighbor.x < focus.x);
      return {
        id: `distance-${selectedNoteId}-${note.id}`,
        source: selectedNoteId,
        target: note.id,
        sourceHandle: neighborOnLeft ? "source-left" : "source-right",
        targetHandle: neighborOnLeft ? "target-right" : "target-left",
        type: "smoothstep",
        label: `d ${value.toFixed(3)}`,
        labelStyle: { fill: "#24443b", fontSize: 11, fontWeight: 700 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.98 },
        labelBgPadding: [7, 4] as [number, number],
        labelBgBorderRadius: 7,
        style: { stroke: metric === "centered" ? "#168264" : "#477d99", strokeWidth: 2.4 },
      };
    });
  }, [metric, nearestNotes, notePositions, selectedNoteId]);

  const baselineCenteredByPair = useMemo(() => new Map(baselinePairs.map((pair) => [pairKey(pair.sourceId, pair.targetId), pair.centered])), [baselinePairs]);
  const currentCenteredByPair = useMemo(() => new Map(comparison?.centeredScores.map((pair) => [pairKey(pair.sourceId, pair.targetId), pair.score]) ?? []), [comparison]);
  const shiftedPairs = useMemo(() => baselinePairs.flatMap((pair) => {
    const updated = currentCenteredByPair.get(pairKey(pair.sourceId, pair.targetId));
    if (updated === undefined) return [];
    const change = distance(updated) - distance(baselineCenteredByPair.get(pairKey(pair.sourceId, pair.targetId)) ?? pair.centered);
    return Math.abs(change) < 0.00005 ? [] : [{ ...pair, change }];
  }).sort((left, right) => Math.abs(right.change) - Math.abs(left.change)).slice(0, 3), [baselineCenteredByPair, baselinePairs, currentCenteredByPair]);

  useEffect(() => {
    if (!selectedNoteId.startsWith("TEST-")) return;
    const frame = requestAnimationFrame(() => {
      void flow.current?.fitView({ nodes: [{ id: selectedNoteId }], padding: 0.5, duration: 320, maxZoom: 0.85 });
    });
    return () => cancelAnimationFrame(frame);
  }, [notes.length, selectedNoteId]);

  async function recalculate(candidateNotes: LabNote[]) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/similarity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          compareMethods: true,
          cards: candidateNotes.map(({ id, text }) => ({ id, text })),
        }),
        signal: AbortSignal.timeout(96_000),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `Similarity request failed (${response.status}).`;
        throw new Error(message);
      }
      const next = payload as Comparison;
      if (next.method !== "cosine_comparison" || !Array.isArray(next.rawScores) || !Array.isArray(next.centeredScores)) {
        throw new Error("The similarity API returned an unexpected response.");
      }
      setComparison(next);
      setStatus(`Updated ${candidateNotes.length} notes with ${next.model}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not calculate similarities.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = newText.trim();
    if (!text || requestInFlight.current || notes.length >= 50) return;
    const note: LabNote = {
      id: `TEST-${String(notes.filter((item) => item.id.startsWith("TEST-")).length + 1).padStart(2, "0")}`,
      theme: "test note",
      text,
    };
    const nextNotes = [...notes, note];
    setNotes(nextNotes);
    setSelectedNoteId(note.id);
    setComparison(null);
    setNewText("");
    void recalculate(nextNotes);
  }

  const selectedNote = noteById.get(selectedNoteId);
  const changedCount = comparison ? baselinePairs.reduce((count, pair) => {
    const updated = currentCenteredByPair.get(pairKey(pair.sourceId, pair.targetId));
    return count + Number(updated !== undefined && Math.abs(distance(updated) - distance(pair.centered)) >= 0.00005);
  }, 0) : 0;

  return <main className="sim-lab-shell">
    <header className="sim-lab-topbar">
      <div className="sim-lab-brand"><Link href="/" aria-label="Return to IdeaForge board"><span>✳</span><strong>IdeaForge</strong></Link>
        <i aria-hidden="true" /><span>Similarity Lab</span></div>
      <div className="sim-lab-top-status"><span className="sim-lab-dev-badge"><i /> Development test</span><span><strong>{notes.length}</strong> notes</span></div>
    </header>

    <div className="sim-lab-workspace">
      <aside className="sim-lab-toolbox">
        <p className="sim-lab-eyebrow">WORK-006</p>
        <h1>Similarity Lab</h1>
        <p className="sim-lab-goal">{goal}</p>
        <div className="sim-lab-divider" />
        <p className="sim-lab-label">DISTANCE METHOD</p>
        <div className="sim-lab-method-switch" role="group" aria-label="Distance method">
          <button type="button" className={metric === "centered" ? "active" : ""} aria-pressed={metric === "centered"} onClick={() => setMetric("centered")}>Mean-centered</button>
          <button type="button" className={metric === "raw" ? "active" : ""} aria-pressed={metric === "raw"} onClick={() => setMetric("raw")}>Raw cosine</button>
        </div>
        <p className="sim-lab-explainer">Select a note to draw its five closest links. Each link shows distance. Lower values mean closer vectors.</p>
        <div className="sim-lab-divider" />
        <p className="sim-lab-label">ADD A TEST NOTE</p>
        <form className="sim-lab-add-form" onSubmit={addNote}>
          <label className="sim-lab-sr-only" htmlFor="sim-lab-note">New note text</label>
          <textarea id="sim-lab-note" value={newText} maxLength={4000} rows={5} onChange={(event) => setNewText(event.target.value)}
            placeholder="Write a note for this study-group goal…" disabled={busy || notes.length >= 50} />
          <div className="sim-lab-form-footer"><span>{newText.length}/4,000</span>
            <button type="submit" disabled={busy || !newText.trim() || notes.length >= 50}>{busy ? "Calculating…" : "＋ Add note"}</button></div>
        </form>
        <div className="sim-lab-status" aria-live="polite">
          {error && <p className="sim-lab-error" role="alert">{error}</p>}
          {status && <p>{status}</p>}
          {notes.length > initialNotes.length && error && <button className="sim-lab-retry" type="button" onClick={() => void recalculate(notes)}>Retry distances</button>}
          {addedNotes.length > 0 && <button className="sim-lab-focus-test" type="button" onClick={() => setSelectedNoteId(addedNotes.at(-1)!.id)}>Focus {addedNotes.at(-1)!.id} on board</button>}
        </div>
        <div className="sim-lab-divider" />
        <div className="sim-lab-source"><span>Baseline model</span><strong>{baselineModel}</strong><small>40 sample notes · synthetic</small></div>
      </aside>

      <section className="sim-lab-board-area" aria-label="Similarity map">
        <div className="sim-lab-board-heading"><span>IDEA BOARD</span><strong>Click any note to explore its nearest links</strong></div>
        <ReactFlow<LabNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 0.55 }} onInit={(instance) => { flow.current = instance; }}
          onNodeClick={(_, node) => setSelectedNoteId(node.id)} nodesDraggable nodesConnectable={false}
          elementsSelectable minZoom={0.12} maxZoom={1.2} zoomOnDoubleClick={false} panOnDrag>
          <Background variant={BackgroundVariant.Dots} gap={23} size={1.3} color="#cad7d2" />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>
      </section>

      <aside className="sim-lab-inspector">
        <div className="sim-lab-inspector-head"><div><p className="sim-lab-eyebrow">SELECTED NOTE</p><h2>{selectedNote?.id ?? "Choose a note"}</h2></div>
          <button type="button" aria-label="Fit all notes on the board" title="Fit all notes" onClick={() => void flow.current?.fitView({ padding: 0.18, duration: 300, maxZoom: 0.55 })}>Fit</button></div>
        {selectedNote && <><span className="sim-lab-theme-tag">{selectedNote.theme}</span><p className="sim-lab-selected-text">{selectedNote.text}</p></>}
        <div className="sim-lab-inspector-rule" />
        <div className="sim-lab-neighbor-title"><h3>Closest notes</h3><span>{metric === "centered" ? "centered" : "raw"}</span></div>
        {nearestNotes.length ? <ol className="sim-lab-neighbor-list">{nearestNotes.map(({ note, distance: value }) => <li key={note.id}>
          <button type="button" onClick={() => setSelectedNoteId(note.id)} title="Focus this note on the board">
            <span className="sim-lab-neighbor-copy"><strong>{note.id}</strong><span>{note.text}</span></span>
            <span className="sim-lab-distance-chip">{value.toFixed(3)}</span>
          </button></li>)}</ol> : <p className="sim-lab-no-neighbors">{comparison ? "No other notes to compare." : "Pilot distances appear when this note has a reviewed candidate pair."}</p>}
        {comparison && <p className="sim-lab-model-status">Scores from {comparison.model}</p>}
        {comparison && comparison.model !== baselineModel && <p className="sim-lab-model-warning">The saved baseline uses {baselineModel}; old-pair shifts may include model differences.</p>}
        {changedCount > 0 && metric === "centered" && <div className="sim-lab-shift-card"><span>BOARD-WIDE SHIFT</span><strong>{changedCount} candidate distances changed</strong>
          {shiftedPairs[0] && <small>{shiftedPairs[0].sourceId} ↔ {shiftedPairs[0].targetId}: {shiftedPairs[0].change > 0 ? "+" : ""}{shiftedPairs[0].change.toFixed(4)}</small>}
          <small>Raw cosine between existing notes stays fixed. Mean-centering changes when the board mean changes.</small></div>}
        <div className="sim-lab-legend"><i /> Distance link <span>·</span> Lower is closer</div>
      </aside>
    </div>
  </main>;
}
