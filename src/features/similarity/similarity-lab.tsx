"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
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
type ClusterGroup = { id: string; label: string; noteIds: string[] };
type ClusterResult = {
  algorithm: "kmeans_l2_normalized";
  embeddingModel: string;
  metric: "centered" | "raw";
  clusterCount: number;
  groups: ClusterGroup[];
};
type NoteNodeData = { note: LabNote; groupLabel: string; accent: string };
type GroupHeaderData = { label: string; count: number; accent: string };
type NoteFlowNode = Node<NoteNodeData, "similarityNote">;
type GroupFlowNode = Node<GroupHeaderData, "clusterHeader">;
type LabNode = NoteFlowNode | GroupFlowNode;
type DisplayGroup = ClusterGroup;

function pairKey(left: string, right: string) {
  return [left, right].sort().join("|");
}

function distance(score: number) {
  return 1 - score;
}

function SimilarityNoteNode({ data, selected }: NodeProps<NoteFlowNode>) {
  const added = data.note.id.startsWith("TEST-");
  return <div className={`sim-note-node ${selected ? "is-focused" : ""} ${added ? "is-added" : ""}`}
    style={{ "--sim-note-accent": data.accent } as CSSProperties}>
    <div className="sim-node-meta"><strong>{data.note.id}</strong><span>{data.groupLabel}</span></div>
    <p>{data.note.text}</p>
    <small className="sim-node-theme">Source theme · {data.note.theme}</small>
  </div>;
}

function ClusterHeaderNode({ data }: NodeProps<GroupFlowNode>) {
  return <div className="sim-lab-cluster-header" style={{ "--sim-note-accent": data.accent } as CSSProperties}>
    <strong>{data.label}</strong><span>{data.count} notes</span>
  </div>;
}

const nodeTypes = { similarityNote: SimilarityNoteNode, clusterHeader: ClusterHeaderNode };
const themeColors = ["#188264", "#477d99", "#ad7950", "#816ca9", "#558969", "#b27462"];
const DEFAULT_CLUSTER_COUNT = 5;

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
  const [clusterCount, setClusterCount] = useState(Math.min(DEFAULT_CLUSTER_COUNT, initialNotes.length));
  const [clusterResult, setClusterResult] = useState<ClusterResult | null>(null);
  const [clusterBusy, setClusterBusy] = useState(false);
  const [clusterError, setClusterError] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState(initialNotes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const flow = useRef<ReactFlowInstance<LabNode> | null>(null);
  const requestInFlight = useRef(false);
  const initialClusterStarted = useRef(false);
  const clusterRequestId = useRef(0);

  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const addedNotes = useMemo(() => notes.filter((note) => note.id.startsWith("TEST-")), [notes]);
  const themeOrder = useMemo(() => [...new Set(notes.map((note) => note.theme))], [notes]);
  const fallbackGroups = useMemo<DisplayGroup[]>(() => themeOrder.map((theme, index) => ({
    id: `source-theme-${index}`,
    label: `Source theme · ${theme}`,
    noteIds: notes.filter((note) => note.theme === theme).map((note) => note.id),
  })), [notes, themeOrder]);
  const displayGroups = useMemo<DisplayGroup[]>(() => {
    if (!clusterResult) return fallbackGroups;
    const assignedIds = new Set(clusterResult.groups.flatMap((group) => group.noteIds));
    const unassignedIds = notes.filter((note) => !assignedIds.has(note.id)).map((note) => note.id);
    return unassignedIds.length
      ? [...clusterResult.groups, { id: "new-notes", label: "Waiting for regroup", noteIds: unassignedIds }]
      : clusterResult.groups;
  }, [clusterResult, fallbackGroups, notes]);
  const groupByNote = useMemo(() => new Map(displayGroups.flatMap((group) => group.noteIds.map((id) => [id, group] as const))), [displayGroups]);
  const clusterLayout = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const headers: GroupFlowNode[] = [];
    let rowTop = 70;
    for (let start = 0; start < displayGroups.length; start += 3) {
      const rowGroups = displayGroups.slice(start, start + 3);
      const maxCardRows = Math.max(1, ...rowGroups.map((group) => Math.ceil(group.noteIds.length / 2)));
      rowGroups.forEach((group, column) => {
        const x = 70 + column * 625;
        const groupIndex = start + column;
        const accent = themeColors[groupIndex % themeColors.length];
        headers.push({
          id: `cluster-header-${group.id}`,
          type: "clusterHeader",
          position: { x, y: rowTop },
          draggable: false,
          selectable: false,
          data: { label: group.label, count: group.noteIds.length, accent },
        });
        group.noteIds.forEach((noteId, memberIndex) => {
          positions.set(noteId, {
            x: x + (memberIndex % 2) * 278,
            y: rowTop + 48 + Math.floor(memberIndex / 2) * 154,
          });
        });
      });
      rowTop += maxCardRows * 154 + 120;
    }
    return { positions, headers };
  }, [displayGroups]);
  const activeScores = useMemo(() => {
    if (comparison) return metric === "raw" ? comparison.rawScores : comparison.centeredScores;
    return baselinePairs.map((pair) => ({
      sourceId: pair.sourceId,
      targetId: pair.targetId,
      score: metric === "raw" ? pair.raw : pair.centered,
    }));
  }, [baselinePairs, comparison, metric]);

  const selectedGroup = groupByNote.get(selectedNoteId);
  const selectedGroupMembers = useMemo(() => (selectedGroup?.noteIds ?? [])
    .filter((id) => id !== selectedNoteId)
    .map((id) => {
      const pair = activeScores.find((item) => pairKey(item.sourceId, item.targetId) === pairKey(selectedNoteId, id));
      const note = noteById.get(id);
      return note ? { note, distance: pair ? distance(pair.score) : undefined } : undefined;
    })
    .filter((item): item is { note: LabNote; distance: number | undefined } => item !== undefined)
    .sort((left, right) => (left.distance ?? Number.POSITIVE_INFINITY) - (right.distance ?? Number.POSITIVE_INFINITY)),
  [activeScores, noteById, selectedGroup, selectedNoteId]);
  const nodes = useMemo<LabNode[]>(() => {
    const noteNodes: NoteFlowNode[] = notes.map((note) => {
      const group = groupByNote.get(note.id);
      const groupIndex = group ? displayGroups.findIndex((item) => item.id === group.id) : 0;
      return {
        id: note.id,
        type: "similarityNote",
        position: clusterLayout.positions.get(note.id) ?? { x: 70, y: 70 },
        selected: note.id === selectedNoteId,
        draggable: false,
        data: {
          note,
          groupLabel: group?.label ?? "Unassigned",
          accent: themeColors[Math.max(0, groupIndex) % themeColors.length],
        },
      };
    });
    return [...noteNodes, ...clusterLayout.headers];
  }, [clusterLayout, displayGroups, groupByNote, notes, selectedNoteId]);

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

  const runClustering = useCallback(async (
    candidateNotes: LabNote[],
    requestedCount: number,
    requestedMetric: "centered" | "raw",
  ) => {
    const requestId = ++clusterRequestId.current;
    setClusterBusy(true);
    setClusterError("");
    try {
      const response = await fetch("/api/similarity/clusters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cards: candidateNotes.map(({ id, text }) => ({ id, text })),
          clusterCount: requestedCount,
          metric: requestedMetric,
        }),
        signal: AbortSignal.timeout(96_000),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `Clustering request failed (${response.status}).`;
        throw new Error(message);
      }
      const next = payload as ClusterResult;
      if (next.algorithm !== "kmeans_l2_normalized" || next.clusterCount !== requestedCount
        || next.metric !== requestedMetric || !Array.isArray(next.groups) || next.groups.length !== requestedCount) {
        throw new Error("The clustering API returned an unexpected response.");
      }
      if (requestId === clusterRequestId.current) {
        setClusterResult(next);
        setStatus(`Grouped ${candidateNotes.length} notes into ${next.clusterCount} groups with ${next.embeddingModel}.`);
      }
    } catch (cause) {
      if (requestId === clusterRequestId.current) {
        setClusterError(cause instanceof Error ? cause.message : "Could not group the notes.");
      }
    } finally {
      if (requestId === clusterRequestId.current) setClusterBusy(false);
    }
  }, []);

  useEffect(() => {
    if (initialClusterStarted.current) return;
    initialClusterStarted.current = true;
    void runClustering(notes, clusterCount, metric);
  }, [clusterCount, metric, notes, runClustering]);

  async function recalculate(candidateNotes: LabNote[]) {
    if (requestInFlight.current) return false;
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
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not calculate similarities.");
      return false;
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
    void (async () => {
      await recalculate(nextNotes);
      await runClustering(nextNotes, clusterCount, metric);
    })();
  }

  const selectedNote = noteById.get(selectedNoteId);
  const changedCount = comparison ? baselinePairs.reduce((count, pair) => {
    const updated = currentCenteredByPair.get(pairKey(pair.sourceId, pair.targetId));
    return count + Number(updated !== undefined && Math.abs(distance(updated) - distance(pair.centered)) >= 0.00005);
  }, 0) : 0;
  const clusteringNeedsApply = !clusterResult || clusterResult.clusterCount !== clusterCount || clusterResult.metric !== metric
    || displayGroups.some((group) => group.id === "new-notes");

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
        <p className="sim-lab-label">CLUSTERING METHOD</p>
        <div className="sim-lab-method-switch" role="group" aria-label="Clustering method">
          <button type="button" className={metric === "centered" ? "active" : ""} aria-pressed={metric === "centered"} onClick={() => setMetric("centered")}>Mean-centered</button>
          <button type="button" className={metric === "raw" ? "active" : ""} aria-pressed={metric === "raw"} onClick={() => setMetric("raw")}>Raw cosine</button>
        </div>
        <label className="sim-lab-label sim-lab-group-label" htmlFor="sim-lab-group-count">NUMBER OF GROUPS</label>
        <select id="sim-lab-group-count" className="sim-lab-group-select" value={clusterCount}
          onChange={(event) => setClusterCount(Number(event.target.value))}>
          {Array.from({ length: Math.max(0, Math.min(10, notes.length) - 1) }, (_, index) => index + 2).map((count) =>
            <option key={count} value={count}>{count} groups</option>)}
        </select>
        <button className="sim-lab-cluster-button" type="button" disabled={clusterBusy || !clusteringNeedsApply}
          onClick={() => void runClustering(notes, clusterCount, metric)}>
          {clusterBusy ? "Grouping notes…" : clusterResult ? "Apply grouping" : "Group notes"}
        </button>
        <p className="sim-lab-explainer">K-means groups the note embeddings. Mean-centered removes the board-wide average direction before grouping; raw uses the original cosine vectors.</p>
        <div className="sim-lab-divider" />
        <p className="sim-lab-label">ADD A TEST NOTE</p>
        <form className="sim-lab-add-form" onSubmit={addNote}>
          <label className="sim-lab-sr-only" htmlFor="sim-lab-note">New note text</label>
          <textarea id="sim-lab-note" value={newText} maxLength={4000} rows={5} onChange={(event) => setNewText(event.target.value)}
            placeholder="Write a note for this study-group goal…" disabled={busy || notes.length >= 50} />
          <div className="sim-lab-form-footer"><span>{newText.length}/4,000</span>
            <button type="submit" disabled={busy || clusterBusy || !newText.trim() || notes.length >= 50}>{busy || clusterBusy ? "Updating…" : "＋ Add note"}</button></div>
        </form>
        <div className="sim-lab-status" aria-live="polite">
          {error && <p className="sim-lab-error" role="alert">{error}</p>}
          {clusterError && <p className="sim-lab-error" role="alert">{clusterError}</p>}
          {status && <p>{status}</p>}
          {notes.length > initialNotes.length && error && <button className="sim-lab-retry" type="button" onClick={() => void recalculate(notes)}>Retry scores</button>}
          {clusterError && <button className="sim-lab-retry" type="button" onClick={() => void runClustering(notes, clusterCount, metric)}>Retry grouping</button>}
          {addedNotes.length > 0 && <button className="sim-lab-focus-test" type="button" onClick={() => setSelectedNoteId(addedNotes.at(-1)!.id)}>Focus {addedNotes.at(-1)!.id} on board</button>}
        </div>
        <div className="sim-lab-divider" />
        <div className="sim-lab-source"><span>Baseline model</span><strong>{baselineModel}</strong><small>40 sample notes · synthetic</small></div>
      </aside>

      <section className="sim-lab-board-area" aria-label="Similarity map">
        <div className="sim-lab-board-heading"><span>IDEA BOARD</span><strong>{clusterResult ? `${displayGroups.length} similarity groups · click a note to inspect its group` : "Loading similarity groups…"}</strong></div>
        <ReactFlow<LabNode> nodes={nodes} edges={[]} nodeTypes={nodeTypes} fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 0.55 }} onInit={(instance) => { flow.current = instance; }}
          onNodeClick={(_, node) => { if (node.type === "similarityNote") setSelectedNoteId(node.id); }} nodesDraggable={false} nodesConnectable={false}
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
        <div className="sim-lab-neighbor-title"><h3>{selectedGroup?.label ?? "Group members"}</h3><span>{selectedGroup?.noteIds.length ?? 0} notes</span></div>
        {selectedGroupMembers.length ? <ol className="sim-lab-neighbor-list">{selectedGroupMembers.map(({ note, distance: value }) => <li key={note.id}>
          <button type="button" onClick={() => setSelectedNoteId(note.id)} title="Select this note">
            <span className="sim-lab-neighbor-copy"><strong>{note.id}</strong><span>{note.text}</span></span>
            {value === undefined ? <span className="sim-lab-group-chip">Member</span> : <span className="sim-lab-distance-chip">{value.toFixed(3)}</span>}
          </button></li>)}</ol> : <p className="sim-lab-no-neighbors">{selectedGroup ? "This is the only note in this group." : "Group membership is not available yet."}</p>}
        {comparison && <p className="sim-lab-model-status">Scores from {comparison.model}</p>}
        {comparison && comparison.model !== baselineModel && <p className="sim-lab-model-warning">The saved baseline uses {baselineModel}; old-pair shifts may include model differences.</p>}
        {changedCount > 0 && metric === "centered" && <div className="sim-lab-shift-card"><span>BOARD-WIDE SHIFT</span><strong>{changedCount} candidate distances changed</strong>
          {shiftedPairs[0] && <small>{shiftedPairs[0].sourceId} ↔ {shiftedPairs[0].targetId}: {shiftedPairs[0].change > 0 ? "+" : ""}{shiftedPairs[0].change.toFixed(4)}</small>}
          <small>Raw cosine between existing notes stays fixed. Mean-centering changes when the board mean changes.</small></div>}
        {selectedGroup && <p className="sim-lab-group-method">Group assignment uses {clusterResult?.algorithm.replaceAll("_", " ") ?? "the fallback source themes"} with {clusterResult?.metric ?? metric} vectors.</p>}
        <div className="sim-lab-legend"><i /> Same cluster <span>·</span> distances shown when available</div>
      </aside>
    </div>
  </main>;
}
