"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ReactFlow, Background, BackgroundVariant, MarkerType, type Edge, type NodeChange, type ReactFlowInstance } from "@xyflow/react";
import { createIdeaId } from "./id";
import { initialBoard } from "./fixtures";
import { createIdea, createRelationship, deleteIdea, deleteRelationship, moveIdea, relationshipLabels, setIdeaPinned, updateIdea,
  type Board, type Idea, type Relationship, type RelationshipType } from "./model";
import { Bubble, type IdeaNode } from "./bubble";
import { ChatSidebar } from "./chat-sidebar";
import { useConnectDrag } from "./use-connect-drag";
import { usePhysics } from "./use-physics";
import "./board.css";

type Tool = "select" | "hand" | "add" | "connect";
type Selection = { kind: "idea" | "relationship"; id: string } | null;
const nodeTypes = { idea: Bubble };

function ToolButton({ label, active, disabled, title, onClick, children }: {
  label: string; active?: boolean; disabled?: boolean; title?: string; onClick?: () => void; children: React.ReactNode;
}) {
  return <button type="button" className={`board-tool ${active ? "active" : ""}`} aria-label={label} aria-pressed={disabled ? undefined : active}
    title={title || label} disabled={disabled} onClick={onClick}><span className="board-tool-icon" aria-hidden="true">{children}</span><span>{label}</span></button>;
}

export function BoardApp() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [title, setTitle] = useState("Student collaboration ideas");
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<{ source: string; target: string } | null>(null);
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("synergy");
  const [explanation, setExplanation] = useState("");
  const [linkError, setLinkError] = useState("");
  const [editor, setEditor] = useState<{ id: string; title: string; content: string } | null>(null);
  const [editError, setEditError] = useState("");
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [spaceDown, setSpaceDown] = useState(false);
  const [nodeLayouts, setNodeLayouts] = useState<Record<string, Pick<IdeaNode, "measured" | "dragging">>>({});
  const flow = useRef<ReactFlowInstance<IdeaNode> | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const boardRef = useRef(board);
  useEffect(() => { boardRef.current = board; }, [board]);
  const connectDrag = useConnectDrag(canvas, {
    onStart: (id) => { setSourceId(id); setSelection({ kind: "idea", id }); },
    onDrop: (source, target) => { setLinkDraft({ source, target }); setRelationshipType("synergy"); setExplanation(""); setLinkError(""); },
    onCancel: () => setSourceId(null),
  });
  const startConnectDrag = connectDrag.start;

  const frozenId = editor?.id ?? sourceId;
  const applyPositions = useCallback((positions: Map<string, { x: number; y: number }>) => {
    setBoard((current) => ({ ...current, ideas: current.ideas.map((idea) => {
      const position = positions.get(idea.id);
      return position && !idea.pinned && idea.id !== frozenId ? { ...idea, position } : idea;
    }) }));
  }, [frozenId]);
  const physics = usePhysics(board, physicsEnabled, frozenId, applyPositions);
  const chosenIdea = selection?.kind === "idea" ? board.ideas.find((idea) => idea.id === selection.id) : undefined;
  const chosenLink = selection?.kind === "relationship" ? board.relationships.find((link) => link.id === selection.id) : undefined;

  function openEditor(idea: Idea) { setSelection({ kind: "idea", id: idea.id }); setEditor({ id: idea.id, title: idea.title, content: idea.content }); setEditError(""); }
  const editingId = editor?.id;
  useEffect(() => { if (editingId) titleInput.current?.focus(); }, [editingId]);
  function cancelInteraction() { connectDrag.cancel(); setEditor(null); setLinkDraft(null); setSourceId(null); setLinkError(""); setTool("select"); }
  function removeSelection() {
    if (!selection) return;
    if (selection.kind === "idea") setBoard((current) => deleteIdea(current, selection.id));
    else setBoard((current) => deleteRelationship(current, selection.id));
    setSelection(null); setEditor(null); setLinkDraft(null); setSourceId(null);
  }
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing = Boolean(target.closest("input,textarea,[contenteditable=true],select"));
      if (event.key === "Escape") { cancelInteraction(); setSelection(null); return; }
      if (typing) return;
      if (event.code === "Space") { event.preventDefault(); setSpaceDown(true); }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelection(); }
    }
    function keyUp(event: KeyboardEvent) { if (event.code === "Space") setSpaceDown(false); }
    function blur() { setSpaceDown(false); }
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); };
  });

  function makeIdea(position: { x: number; y: number }) {
    const idea: Idea = { id: createIdeaId(), title: "New idea", content: "", position, pinned: false, parentIds: [] };
    setBoard((current) => createIdea(current, idea)); setTool("select"); openEditor(idea); physics.reheat();
  }
  function addAtCenter() {
    const bounds = canvas.current?.querySelector(".react-flow")?.getBoundingClientRect();
    if (!bounds || !flow.current) return;
    const point = flow.current.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    makeIdea({ x: point.x - 130, y: point.y - 70 });
  }
  function selectTool(next: Tool) { connectDrag.cancel(); setTool(next); setSourceId(null); setLinkDraft(null); setSelection(null); }
  async function fitBoard() {
    if (!flow.current || !canvas.current || board.ideas.length === 0) return;
    const minX = Math.min(...board.ideas.map((idea) => idea.position.x));
    const minY = Math.min(...board.ideas.map((idea) => idea.position.y));
    const width = Math.max(...board.ideas.map((idea) => idea.position.x + 260)) - minX;
    const height = Math.max(...board.ideas.map((idea) => idea.position.y + 140)) - minY;
    const availableWidth = Math.max(240, canvas.current.clientWidth - 230);
    const availableHeight = Math.max(180, canvas.current.clientHeight - 260);
    const zoom = Math.max(0.15, Math.min(0.95, availableWidth / width, availableHeight / height));
    const x = 205 + (availableWidth - width * zoom) / 2 - minX * zoom;
    const y = 190 + (availableHeight - height * zoom) / 2 - minY * zoom;
    await flow.current.setViewport({ x, y, zoom }, { duration: 250 });
  }
  function confirmLink(event: FormEvent) {
    event.preventDefault();
    if (!linkDraft) return;
    const candidate: Relationship = { id: createIdeaId(), ...linkDraft, type: relationshipType, explanation: explanation.trim() };
    const next = createRelationship(boardRef.current, candidate);
    if (next === boardRef.current) { setLinkError("That relationship already exists, or the ideas are no longer available."); return; }
    setBoard(next); setSelection({ kind: "relationship", id: candidate.id }); setLinkDraft(null); setSourceId(null); setTool("select"); physics.reheat();
  }
  function saveEdit(event: FormEvent) {
    event.preventDefault(); if (!editor) return;
    if (!editor.title.trim()) { setEditError("Give this idea a title before saving."); titleInput.current?.focus(); return; }
    setBoard((current) => updateIdea(current, editor.id, { title: editor.title.trim(), content: editor.content.trim() }));
    setEditor(null);
  }

  const nodes = useMemo<IdeaNode[]>(() => board.ideas.map((idea) => ({
    ...nodeLayouts[idea.id],
    id: idea.id, type: "idea", position: idea.position, selected: selection?.kind === "idea" && selection.id === idea.id,
    draggable: tool !== "connect" && editor?.id !== idea.id,
    data: { idea, connecting: tool === "connect", source: sourceId === idea.id, editing: editor?.id === idea.id,
      onEdit: () => openEditor(idea), onStartConnection: (event) => startConnectDrag(idea.id, event) },
  })), [board.ideas, selection, tool, sourceId, editor?.id, nodeLayouts, startConnectDrag]);
  function onNodesChange(changes: NodeChange<IdeaNode>[]) {
    setNodeLayouts((current) => {
      let next = current;
      for (const change of changes) {
        if (change.type !== "dimensions" && change.type !== "position") continue;
        const previous = next[change.id] ?? {};
        const measured = change.type === "dimensions" ? change.dimensions : undefined;
        const dragging = change.type === "position" ? change.dragging : undefined;
        if (measured && previous.measured?.width === measured.width && previous.measured?.height === measured.height) continue;
        if (dragging !== undefined && previous.dragging === dragging) continue;
        if (!measured && dragging === undefined) continue;
        if (next === current) next = { ...current };
        next[change.id] = { ...previous, ...(measured ? { measured } : {}), ...(dragging !== undefined ? { dragging } : {}) };
      }
      return next;
    });
  }
  const edges = useMemo<Edge[]>(() => board.relationships.map((link) => {
    const source = board.ideas.find((idea) => idea.id === link.source);
    const target = board.ideas.find((idea) => idea.id === link.target);
    const pointsRight = !source || !target || source.position.x <= target.position.x;
    return {
    id: link.id, source: link.source, target: link.target, sourceHandle: pointsRight ? "source-right" : "source-left",
    targetHandle: pointsRight ? "target-left" : "target-right", type: "smoothstep", label: relationshipLabels[link.type],
    selected: selection?.kind === "relationship" && selection.id === link.id,
    markerEnd: link.type === "extends" ? { type: MarkerType.ArrowClosed, color: "#46758c" } : undefined,
    style: { stroke: link.type === "conflict" ? "#b6665b" : link.type === "extends" ? "#46758c" : "#4b8a79", strokeWidth: selection?.id === link.id ? 3 : 2 },
    labelStyle: { fontSize: 11, fontWeight: 700, fill: "#3c5260" },
    labelBgStyle: { fill: "#fff", fillOpacity: 0.96 }, labelBgPadding: [8, 5] as [number, number], labelBgBorderRadius: 6,
    interactionWidth: 24,
  }; }), [board.relationships, board.ideas, selection]);

  return <main className="board-shell">
    <header className="board-topbar"><div className="board-brand"><span className="board-brand-symbol">✳</span><strong>IdeaForge</strong><span className="board-divider" />
      <input aria-label="Board title" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} /></div>
      <div className="board-top-actions"><span className="board-local-badge"><i /> Local demo · resets on refresh</span>
        {process.env.NODE_ENV === "development" && <Link className="board-lab-link" href="/similarity-lab">WORK-006 Similarity Lab</Link>}
        <button disabled title="Sharing is coming later">Share</button></div></header>
    <div className="board-workspace">
      <div ref={canvas} className={`board-canvas ${tool === "add" ? "placing" : ""} ${tool === "connect" ? "connecting" : ""} ${tool === "hand" || spaceDown ? "panning" : ""}`}>
        <ReactFlow<IdeaNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onInit={(instance) => { flow.current = instance; }}
          onPaneClick={(event) => { if (tool === "add" && flow.current) { const point = flow.current.screenToFlowPosition({ x: event.clientX, y: event.clientY }); makeIdea({ x: point.x - 130, y: point.y - 70 }); }
            else { setSelection(null); if (tool === "connect") { setSourceId(null); setLinkDraft(null); setTool("select"); } } }}
          onNodeClick={(_, node) => { if (tool !== "connect") setSelection({ kind: "idea", id: node.id }); }}
          onEdgeClick={(_, edge) => { setSelection({ kind: "relationship", id: edge.id }); setTool("select"); }}
          onNodeDragStart={(_, node) => physics.dragStart(node.id)}
          onNodeDrag={(_, node) => { physics.drag(node.id, node.position); setBoard((current) => moveIdea(current, node.id, node.position)); }}
          onNodeDragStop={(_, node) => { setBoard((current) => moveIdea(current, node.id, node.position)); physics.dragStop(node.id, node.position, Boolean(boardRef.current.ideas.find((idea) => idea.id === node.id)?.pinned)); }}
          panOnDrag={tool === "hand" || spaceDown} nodesDraggable={tool !== "hand" && !spaceDown && tool !== "connect"}
          nodesConnectable={false} elementsSelectable={true} zoomOnDoubleClick={false} minZoom={0.15} maxZoom={1.8} defaultViewport={{ x: 185, y: 180, zoom: 0.72 }}>
          <Background variant={BackgroundVariant.Dots} gap={23} size={1.3} color="#cad7d2" />
        </ReactFlow>
        {connectDrag.preview?.active && <svg className="board-connection-preview" aria-hidden="true">
          <line x1={connectDrag.preview.x1} y1={connectDrag.preview.y1} x2={connectDrag.preview.x2} y2={connectDrag.preview.y2} />
          <circle cx={connectDrag.preview.x2} cy={connectDrag.preview.y2} r="6" />
        </svg>}
        <nav className="board-toolbar" aria-label="Board tools">
          <div className="board-toolbar-title">TOOLS</div>
          <ToolButton label="Select" active={tool === "select"} onClick={() => selectTool("select")}>↖</ToolButton>
          <ToolButton label="Hand / Pan" active={tool === "hand"} onClick={() => selectTool("hand")}>✋</ToolButton>
          <div className="board-tool-rule" />
          <ToolButton label="Add idea" active={tool === "add"} onClick={() => selectTool("add")}>＋</ToolButton>
          <ToolButton label="Connect" active={tool === "connect"} onClick={() => selectTool("connect")}>⌁</ToolButton>
          <div className="board-tool-rule" />
          <ToolButton label="Physics" active={physicsEnabled} onClick={() => setPhysicsEnabled((value) => !value)}>◉</ToolButton>
          <div className="board-tool-rule" />
          <ToolButton label="AI Organize" disabled title="AI Organize is coming later">✧</ToolButton>
          <ToolButton label="Merge ideas" disabled title="Merge ideas is coming later">◇</ToolButton>
          <ToolButton label="Generate brief" disabled title="Generate brief is coming later">▤</ToolButton>
        </nav>
        <div className="board-caption"><span className="board-eyebrow">BRAINSTORMING CANVAS</span><strong>Make space for the next idea.</strong>
          <span>{tool === "add" ? "Click an empty space to place a new idea." : tool === "connect" ? "Drag from one idea into another to connect them." : "Drag ideas to arrange them. Scroll to zoom, or hold Space to pan."}</span></div>
        {board.ideas.length === 0 && <div className="board-empty"><span>✳</span><h2>Your board is ready</h2><p>Start with one thought. You can connect it to others as your map grows.</p><button onClick={addAtCenter}>＋ Add your first idea</button></div>}
        {(chosenIdea || chosenLink) && <div className="board-selection-bar">
          {chosenIdea ? <><strong>{chosenIdea.title}</strong><button onClick={() => openEditor(chosenIdea)}>Edit</button><button onClick={() => { setBoard((current) => setIdeaPinned(current, chosenIdea.id, !chosenIdea.pinned)); if (chosenIdea.pinned) physics.reheat(); }}>{chosenIdea.pinned ? "Unpin" : "Pin"}</button></> : <><strong>{chosenLink && relationshipLabels[chosenLink.type]}</strong>{chosenLink?.explanation && <span title={chosenLink.explanation}>{chosenLink.explanation}</span>}</>}
          <button className="danger" onClick={removeSelection}>Delete</button></div>}
        <div className="board-zoom"><button aria-label="Zoom out" title="Zoom out" onClick={() => flow.current?.zoomOut({ duration: 180 })}>−</button><button aria-label="Fit ideas" title="Fit ideas" onClick={() => { void fitBoard(); }}>Fit</button><button aria-label="Zoom in" title="Zoom in" onClick={() => flow.current?.zoomIn({ duration: 180 })}>＋</button></div>
      </div>
      <ChatSidebar open={chatOpen} onToggle={() => setChatOpen((value) => !value)} />
    </div>
    {editor && <div className="board-modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}><form className="board-dialog" onSubmit={saveEdit} aria-label="Edit idea">
      <span className="board-eyebrow">IDEA DETAILS</span><h2>Edit idea</h2><label>Title<input ref={titleInput} value={editor.title} maxLength={120} onChange={(event) => { setEditor({ ...editor, title: event.target.value }); setEditError(""); }} /></label>
      <label>Content<textarea value={editor.content} maxLength={4000} rows={6} onChange={(event) => setEditor({ ...editor, content: event.target.value })} placeholder="What makes this idea useful?" /></label>
      {editError && <p className="board-error" role="alert">{editError}</p>}<div className="board-dialog-actions"><button type="button" onClick={() => setEditor(null)}>Cancel</button><button className="primary" type="submit">Save idea</button></div></form></div>}
    {linkDraft && <div className="board-modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelInteraction(); }}><form className="board-dialog" onSubmit={confirmLink} aria-label="Choose relationship">
      <span className="board-eyebrow">CONNECT IDEAS</span><h2>How are they related?</h2><p className="board-link-direction">{board.ideas.find((idea) => idea.id === linkDraft.source)?.title} → {board.ideas.find((idea) => idea.id === linkDraft.target)?.title}</p>
      <label>Relationship<select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)}>{Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {relationshipType === "extends" && <p className="board-direction-note">The first idea extends the second idea. The arrow will point to the second idea.</p>}
      <label>Explanation <span>(optional)</span><textarea rows={3} maxLength={500} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Why does this connection matter?" /></label>
      {linkError && <p className="board-error" role="alert">{linkError}</p>}<div className="board-dialog-actions"><button type="button" onClick={cancelInteraction}>Cancel</button><button className="primary" type="submit">Create connection</button></div></form></div>}
  </main>;
}
