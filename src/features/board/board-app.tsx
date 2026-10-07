"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ReactFlow, Background, BackgroundVariant, MarkerType, type Edge, type NodeChange, type ReactFlowInstance } from "@xyflow/react";
import Link from "next/link";
import { createIdeaId } from "./id";
import { initialBoard } from "./fixtures";
import { createIdea, createRelationship, deleteIdea, deleteRelationship, IDEA_CARD_SIZE, moveIdea, relationshipLabels, setIdeaPinned, updateIdea,
  type Board, type Idea, type Relationship, type RelationshipType } from "./model";
import { Bubble, type IdeaNode } from "./bubble";
import { ChatSidebar } from "./chat-sidebar";
import { AccountMenu } from "./account-menu";
import { ActiveMembers } from "./active-members";
import { useConnectDrag } from "./use-connect-drag";
import { usePhysics, type Contact } from "./use-physics";
import { useConnectionSuggestions } from "./use-connection-suggestions";
import { ConnectionSuggestionsPanel } from "./connection-suggestions-panel";
import { isCurrentConnection } from "./connection-preview";
import { clusterAssignmentResponseSchema, clusterNamesResponseSchema, clusterResponseSchema, type ClusterCard, type ClusterNamesRequest } from "@/lib/cluster-contract";
import { layoutClusters, placeNewNote } from "./cluster-layout";
import { appendClusterAssignment, memberFingerprint, renameClusterGroup } from "./cluster-state";
import { addMergedIdea, mergeContext, mergeText } from "./merge-board";
import { initialGoal, mergeResultSchema, type MergeResult } from "@/lib/ideas";
import "./board.css";

type Tool = "select" | "hand" | "add" | "connect";
type Selection = { kind: "idea" | "relationship"; id: string } | null;
type MergePreview = { ids: [string, string]; fingerprint: string; result: MergeResult; model: string; generatedAt: string; title: string; concept: string };
const nodeTypes = { idea: Bubble };
const AUTO_PLACE_KEY = "ideaforge-auto-place-new-notes";
const AUTO_PLACE_EVENT = "ideaforge-auto-place-preference-change";

function getAutoPlacePreference() { return window.localStorage.getItem(AUTO_PLACE_KEY) === "true"; }
function subscribeAutoPlacePreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(AUTO_PLACE_EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(AUTO_PLACE_EVENT, callback); };
}
function saveAutoPlacePreference(enabled: boolean) {
  window.localStorage.setItem(AUTO_PLACE_KEY, String(enabled));
  window.dispatchEvent(new Event(AUTO_PLACE_EVENT));
}

function clusterText(idea: Idea): string | null {
  const title = idea.title.trim();
  const content = idea.content.trim();
  if (!content && title.toLowerCase() === "new idea") return null;
  return [title, content].filter(Boolean).join("\n\n") || null;
}

function clusterNamingPayload(ideas: Idea[], snapshot: NonNullable<Board["clusterSnapshot"]>): ClusterNamesRequest | null {
  const ideaById = new Map(ideas.map((idea) => [idea.id, idea]));
  const groups = snapshot.result.groups.map((group) => {
    const noteIds = [group.representativeNoteId, ...group.noteIds.filter((id) => id !== group.representativeNoteId).sort((left, right) => left.localeCompare(right))];
    const notes = noteIds.flatMap((id) => {
      const idea = ideaById.get(id);
      const text = idea && clusterText(idea);
      return text ? [{ id, text }] : [];
    });
    return { id: group.id, representativeNoteId: group.representativeNoteId, notes };
  });
  if (groups.some((group) => group.notes.length !== snapshot.result.groups.find((candidate) => candidate.id === group.id)?.size)) return null;
  return { revision: snapshot.revision, groups };
}

function boardFingerprint(ideas: Idea[]): string {
  return JSON.stringify([...ideas].sort((left, right) => left.id.localeCompare(right.id)).map(({ id, title, content, pinned }) => ({ id, title, content, pinned })));
}

function positionFingerprint(ideas: Idea[]): string {
  return JSON.stringify([...ideas].sort((left, right) => left.id.localeCompare(right.id)).map(({ id, position }) => ({ id, x: position.x, y: position.y })));
}

type BoardAppProps = {
  sharedBoard?: Board;
  sharedTitle?: string;
  onBoardChange?: (update: (board: Board) => Board) => boolean;
  onTitleChange?: (title: string) => void;
  authorName?: string;
};

function ZoomReadout({ zoom }: { zoom: number }) {
  return <span className="board-zoom-level" aria-live="off">{Math.round(zoom * 100)}%</span>;
}

function ToolButton({ label, active, disabled, title, onClick, children }: {
  label: string; active?: boolean; disabled?: boolean; title?: string; onClick?: () => void; children: React.ReactNode;
}) {
  return <button type="button" className={`board-tool ${active ? "active" : ""}`} aria-label={label} aria-pressed={disabled ? undefined : active}
    title={title || label} disabled={disabled} onClick={onClick}><span className="board-tool-icon" aria-hidden="true">{children}</span></button>;
}

export function BoardApp({ sharedBoard, sharedTitle, onBoardChange, onTitleChange, authorName }: BoardAppProps) {
  const [localBoard, setLocalBoard] = useState<Board>(initialBoard);
  const board = sharedBoard ?? localBoard;
  const setBoard = useCallback<Dispatch<SetStateAction<Board>>>((update) => {
    if (onBoardChange) onBoardChange((current) => typeof update === "function" ? update(current) : update);
    else setLocalBoard(update);
  }, [onBoardChange]);
  const [localTitle, setLocalTitle] = useState("Student collaboration ideas");
  const title = sharedTitle ?? localTitle;
  const [shareNotice, setShareNotice] = useState("");
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [mergeDetailsId, setMergeDetailsId] = useState<string | null>(null);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<{ source: string; target: string } | null>(null);
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("synergy");
  const [explanation, setExplanation] = useState("");
  const [linkError, setLinkError] = useState("");
  const [editor, setEditor] = useState<{ id: string; title: string; content: string } | null>(null);
  const [editError, setEditError] = useState("");
  const [physicsEnabled, setPhysicsEnabled] = useState(!onBoardChange);
  const [chatOpen, setChatOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [zoom, setZoom] = useState(0.72);
  const [squashes, setSquashes] = useState<Record<string, { axis: "x" | "y"; token: number }>>({});
  const [spaceDown, setSpaceDown] = useState(false);
  const [nodeLayouts, setNodeLayouts] = useState<Record<string, Pick<IdeaNode, "measured" | "dragging">>>({});
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [clusterCount, setClusterCount] = useState(sharedBoard?.clusterSnapshot?.result.clusterCount ?? 2);
  const [clusterBusy, setClusterBusy] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentRetryId, setAssignmentRetryId] = useState<string | null>(null);
  const [clusterError, setClusterError] = useState("");
  const [editingGroupName, setEditingGroupName] = useState<{ id: string; value: string } | null>(null);
  const [clusterNamesState, setClusterNamesState] = useState<"idle" | "pending" | "ready" | "error">("idle");
  const [clusterNamesError, setClusterNamesError] = useState("");
  const autoPlaceNewNotes = useSyncExternalStore(subscribeAutoPlacePreference, getAutoPlacePreference, () => false);
  const [clusterNotice, setClusterNotice] = useState("");
  const [undoPositions, setUndoPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<Board["clusterSnapshot"]>(null);
  const [undoAfterFingerprint, setUndoAfterFingerprint] = useState<string | null>(null);
  const [assignmentUndo, setAssignmentUndo] = useState<{ id: string; position: Idea["position"]; after: Idea["position"]; snapshot: Board["clusterSnapshot"]; appliedRevision: string } | null>(null);
  const flow = useRef<ReactFlowInstance<IdeaNode> | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const boardRef = useRef(board);
  const squashTimers = useRef(new Map<string, number>());
  const squashSequence = useRef(0);
  const clusterRequestSequence = useRef(0);
  const clusterRequestFingerprint = useRef<string | null>(null);
  const clusterNamesSequence = useRef(0);
  const clusterNamesController = useRef<AbortController | null>(null);
  const clusterNamesContext = useRef<{ revision: string; sourceFingerprint: string } | null>(null);
  const manuallyNamedGroups = useRef(new Set<string>());
  const manualNameRevision = useRef<string | null>(null);
  const assignmentRequestSequence = useRef(0);
  const assignmentController = useRef<AbortController | null>(null);
  const activeAssignmentId = useRef<string | null>(null);
  const draftIdeaId = useRef<string | null>(null);
  const mergeController = useRef<AbortController | null>(null);
  const mergeRequestSequence = useRef(0);
  const mergeSaveLock = useRef(false);
  const dragRevisions = useRef(new Map<string, number>());
  const autoPlacePreference = useRef(autoPlaceNewNotes);
  autoPlacePreference.current = autoPlaceNewNotes;
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => () => {
    for (const timer of squashTimers.current.values()) window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const savedTheme = window.localStorage.getItem("ideaforge-theme");
    if (savedTheme !== "light" && savedTheme !== "dark") return;
    const frame = window.requestAnimationFrame(() => setTheme(savedTheme));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { window.localStorage.setItem("ideaforge-theme", theme); }, [theme]);
  useEffect(() => {
    if (!clusterNotice) return;
    const timer = window.setTimeout(() => setClusterNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [clusterNotice]);
  useEffect(() => () => { assignmentController.current?.abort(); clusterNamesController.current?.abort(); mergeController.current?.abort(); }, []);
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
  }, [frozenId, setBoard]);
  const applyContacts = useCallback((contacts: Contact[]) => {
    for (const contact of contacts) {
      for (const id of [contact.first, contact.second]) {
        const token = ++squashSequence.current;
        setSquashes((current) => ({ ...current, [id]: { axis: contact.axis, token } }));
        const previousTimer = squashTimers.current.get(id);
        if (previousTimer !== undefined) window.clearTimeout(previousTimer);
        squashTimers.current.set(id, window.setTimeout(() => {
          setSquashes((current) => {
            if (current[id]?.token !== token) return current;
            const next = { ...current };
            delete next[id];
            return next;
          });
          squashTimers.current.delete(id);
        }, 440));
      }
    }
  }, []);
  const physics = usePhysics(board, physicsEnabled, frozenId, applyPositions, applyContacts);
  const currentBoardFingerprint = useMemo(() => boardFingerprint(board.ideas), [board.ideas]);
  const clusterSnapshot = board.clusterSnapshot ?? null;
  const clusterResult = clusterSnapshot?.result ?? null;
  const clusterInput = useMemo(() => {
    const cards: ClusterCard[] = [];
    const tooLong: string[] = [];
    for (const idea of board.ideas) {
      const text = clusterText(idea);
      if (!text) continue;
      if (text.length > 4000) { tooLong.push(idea.id); continue; }
      cards.push({ id: idea.id, text });
    }
    return { cards, tooLongCount: tooLong.length, emptyCount: board.ideas.length - cards.length - tooLong.length };
  }, [board.ideas]);
  const clusterStale = Boolean(clusterSnapshot?.stale || clusterSnapshot && !clusterSnapshot.result.notePairs);
  const clusterLabels = useMemo(() => new Map(clusterResult?.assignments.map((assignment) => [assignment.noteId, clusterResult.groups.find((group) => group.id === assignment.clusterId)?.label ?? ""])), [clusterResult]);
  const clusterColors = useMemo(() => new Map(clusterResult?.groups.flatMap((group, index) => group.noteIds.map((id) => [id, index % 5] as const))), [clusterResult]);
  const chosenIdea = selection?.kind === "idea" ? board.ideas.find((idea) => idea.id === selection.id) : undefined;
  const chosenLink = selection?.kind === "relationship" ? board.relationships.find((link) => link.id === selection.id) : undefined;
  const suggestions = useConnectionSuggestions(board, board.goal ?? initialGoal, Boolean(editor));
  const selectedPair = mergeIds.length === 2 ? mergeContext(board, mergeIds as [string, string]) : null;
  const previewContext = mergePreview ? mergeContext(board, mergePreview.ids) : null;
  const previewStale = Boolean(mergePreview && previewContext?.fingerprint !== mergePreview.fingerprint);
  const selectedMergeIdea = mergeDetailsId ? board.ideas.find((idea) => idea.id === mergeDetailsId && idea.merge) : undefined;


  useEffect(() => {
    if (clusterBusy && clusterRequestFingerprint.current && clusterRequestFingerprint.current !== currentBoardFingerprint) {
      clusterRequestSequence.current += 1;
      clusterRequestFingerprint.current = null;
      setClusterBusy(false);
      setClusterError("The board changed; organize again.");
    }
  }, [clusterBusy, currentBoardFingerprint]);
  useEffect(() => {
    const context = clusterNamesContext.current;
    if (!context || !clusterNamesController.current) return;
    const currentSnapshot = board.clusterSnapshot;
    if (currentSnapshot && !currentSnapshot.stale && currentSnapshot.revision === context.revision &&
      memberFingerprint(board.ideas, currentSnapshot) === context.sourceFingerprint) return;
    clusterNamesController.current.abort();
    clusterNamesController.current = null;
    clusterNamesContext.current = null;
    clusterNamesSequence.current += 1;
    setClusterNamesState("idle");
    setClusterNamesError("");
  }, [board.clusterSnapshot, board.ideas]);
  function changeTitle(nextTitle: string) {
    if (onTitleChange) onTitleChange(nextTitle);
    else setLocalTitle(nextTitle);
  }
  async function copyBoardLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareNotice("Link copied");
    } catch {
      setShareNotice("Copy the board URL from your browser address bar");
    }
    window.setTimeout(() => setShareNotice(""), 2500);
  }

  function openEditor(idea: Idea) { setMergeIds([]); setSelection({ kind: "idea", id: idea.id }); setEditor({ id: idea.id, title: idea.title, content: idea.content }); setEditError(""); }
  const editingId = editor?.id;
  useEffect(() => { if (editingId) titleInput.current?.focus(); }, [editingId]);
  function cancelInteraction() { connectDrag.cancel(); setEditor(null); setLinkDraft(null); setSourceId(null); setLinkError(""); setOrganizeOpen(false); setMergePreview(null); setMergeDetailsId(null); setMergeIds([]); setMergeError(""); mergeRequestSequence.current += 1; mergeController.current?.abort(); setMergeBusy(false); setTool("select"); }
  function removeSelection() {
    if (!selection) return;
    if (selection.kind === "idea") { setUndoPositions(null); setAssignmentUndo(null); }
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
    const idea: Idea = { id: createIdeaId(), title: "New idea", content: "", position, pinned: false, parentIds: [], author: authorName || "Unknown contributor" };
    draftIdeaId.current = idea.id;
    setUndoPositions(null);
    setBoard((current) => createIdea(current, idea)); setTool("select"); openEditor(idea); physics.reheat();
  }
  function addAtCenter() {
    const bounds = canvas.current?.querySelector(".react-flow")?.getBoundingClientRect();
    if (!bounds || !flow.current) return;
    const point = flow.current.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    makeIdea({ x: point.x - IDEA_CARD_SIZE.width / 2, y: point.y - IDEA_CARD_SIZE.height / 2 });
  }
  function selectTool(next: Tool) { connectDrag.cancel(); setTool(next); setSourceId(null); setLinkDraft(null); setSelection(null); setMergeIds([]); }
  async function fitBoard() {
    if (!flow.current || !canvas.current || board.ideas.length === 0) return;
    const minX = Math.min(...board.ideas.map((idea) => idea.position.x));
    const minY = Math.min(...board.ideas.map((idea) => idea.position.y));
    const width = Math.max(...board.ideas.map((idea) => idea.position.x + IDEA_CARD_SIZE.width)) - minX;
    const height = Math.max(...board.ideas.map((idea) => idea.position.y + IDEA_CARD_SIZE.height)) - minY;
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
    setBoard((current) => createRelationship(current, candidate)); setSelection({ kind: "relationship", id: candidate.id }); setLinkDraft(null); setSourceId(null); setTool("select"); physics.reheat();
  }
  function saveEdit(event: FormEvent) {
    event.preventDefault(); if (!editor) return;
    if (!editor.title.trim()) { setEditError("Give this idea a title before saving."); titleInput.current?.focus(); return; }
    const isNewIdea = draftIdeaId.current === editor.id;
    const updatedIdea = { ...boardRef.current.ideas.find((idea) => idea.id === editor.id)!, title: editor.title.trim(), content: editor.content.trim() };
    const updatedBoard = updateIdea(boardRef.current, editor.id, { title: updatedIdea.title, content: updatedIdea.content });
    setUndoPositions(null);
    setAssignmentUndo(null);
    setBoard(updatedBoard);
    boardRef.current = updatedBoard;
    setEditor(null);
    if (isNewIdea) {
      draftIdeaId.current = null;
      if (autoPlaceNewNotes && clusterText(updatedIdea)) void assignNewNote(updatedBoard, updatedIdea);
    }
  }

  function selectMergeNote(id: string, additive: boolean) {
    setMergeError("");
    if (additive) {
      const first = mergeIds.find((candidate) => boardRef.current.ideas.some((idea) => idea.id === candidate)) ?? (selection?.kind === "idea" ? selection.id : null);
      if (first && first !== id) { setMergeIds([first, id]); setSelection(null); return; }
      setMergeIds([id]); setSelection(null); return;
    }
    setMergeIds([]);
    setSelection({ kind: "idea", id });
  }

  function discardMerge() {
    mergeRequestSequence.current += 1;
    mergeController.current?.abort();
    mergeController.current = null;
    setMergeBusy(false); setMergePreview(null); setMergeError("");
  }

  async function generateMerge() {
    const ids = mergePreview?.ids ?? (mergeIds.length === 2 ? mergeIds as [string, string] : null);
    if (mergeBusy || !ids) return;
    const context = mergeContext(boardRef.current, ids);
    if (!context?.goal || context.sources.some((idea) => !mergeText(idea) || mergeText(idea).length > 4000)) {
      setMergeError("Set a board goal and choose two notes with text under 4,000 characters."); return;
    }
    mergeController.current?.abort();
    const controller = new AbortController();
    mergeController.current = controller;
    const sequence = ++mergeRequestSequence.current;
    const timeout = window.setTimeout(() => controller.abort(), 96_000);
    setMergeIds([...ids]);
    setMergeBusy(true); setMergeError(""); setMergePreview(null);
    try {
      const response = await fetch("/api/merge", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ goal: context.goal, sources: context.sources.map((idea) => ({ id: idea.id, text: mergeText(idea) })),
          relationship: context.relationship ? { type: context.relationship.type, explanation: context.relationship.explanation,
            sourceId: context.relationship.source, targetId: context.relationship.target } : undefined }),
      });
      const payload: unknown = await response.json();
      if (sequence !== mergeRequestSequence.current) return;
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string" ? payload.error : "The AI could not merge these ideas.");
      if (!payload || typeof payload !== "object" || !("result" in payload) || !("model" in payload) || !("generatedAt" in payload)) throw new Error("The AI returned an incomplete proposal.");
      const parsed = mergeResultSchema.safeParse(payload.result);
      if (!parsed.success || typeof payload.model !== "string" || typeof payload.generatedAt !== "string") throw new Error("The AI returned an incomplete proposal.");
      if (mergeContext(boardRef.current, ids)?.fingerprint !== context.fingerprint) {
        setMergeError("The source notes or goal changed. Merge again to use the latest text."); return;
      }
      setMergePreview({ ids, fingerprint: context.fingerprint, result: parsed.data, model: payload.model, generatedAt: payload.generatedAt,
        title: parsed.data.title, concept: parsed.data.concept });
    } catch (error) {
      if (sequence !== mergeRequestSequence.current) return;
      setMergeError(controller.signal.aborted ? "The merge timed out. Try again." : error instanceof Error ? error.message : "The AI could not merge these ideas.");
    } finally {
      window.clearTimeout(timeout);
      if (sequence === mergeRequestSequence.current) { setMergeBusy(false); mergeController.current = null; }
    }
  }

  function keepMerge() {
    if (!mergePreview || mergeSaveLock.current || mergePreview.result.status !== "useful") return;
    const context = mergeContext(boardRef.current, mergePreview.ids);
    if (!context || context.fingerprint !== mergePreview.fingerprint) { setMergeError("The source notes or goal changed. Regenerate before creating the idea."); return; }
    const title = mergePreview.title.trim();
    const concept = mergePreview.concept.trim();
    if (!title || !concept) { setMergeError("Give the merged idea a title and description."); return; }
    mergeSaveLock.current = true; setMergeSaving(true);
    const id = createIdeaId();
    const record = {
      sources: context.sources.map((idea) => ({ id: idea.id, title: idea.title, content: idea.content, author: idea.author || "Unknown contributor" })) as [
        { id: string; title: string; content: string; author: string }, { id: string; title: string; content: string; author: string }],
      goal: context.goal,
      relationship: context.relationship ? { type: context.relationship.type, explanation: context.relationship.explanation,
        sourceId: context.relationship.source, targetId: context.relationship.target } : undefined,
      proposal: mergePreview.result, model: mergePreview.model, generatedAt: mergePreview.generatedAt,
    };
    const apply = (current: Board) => mergeContext(current, mergePreview.ids)?.fingerprint === mergePreview.fingerprint ?
      addMergedIdea(current, id, title, concept, record, authorName || "Unknown contributor") : current;
    const committed = onBoardChange ? onBoardChange(apply) : (setLocalBoard(apply), true);
    if (!committed) {
      mergeSaveLock.current = false; setMergeSaving(false);
      setMergeError("The source notes or goal changed. Regenerate before creating the idea.");
      return;
    }
    setPhysicsEnabled(false); physics.stop();
    setMergePreview(null); setMergeIds([]); setSelection({ kind: "idea", id }); setMergeError("");
    setUndoPositions(null); setAssignmentUndo(null);
    mergeSaveLock.current = false; setMergeSaving(false);
    window.requestAnimationFrame(() => { void flow.current?.fitView({ nodes: [{ id: mergePreview.ids[0] }, { id: mergePreview.ids[1] }, { id }], padding: 0.28, duration: 350, maxZoom: 0.9 }); });
  }

  function openOrganize() {
    setClusterError("");
    if (!organizeOpen && !clusterSnapshot) setClusterCount(clusterInput.cards.length > 5 ? 3 : 2);
    setOrganizeOpen(!organizeOpen);
  }

  function saveGroupName(event: FormEvent) {
    event.preventDefault();
    if (!editingGroupName) return;
    const label = editingGroupName.value.trim();
    if (!label || [...label].length > 40) {
      setClusterError("Group names must be 1 to 40 characters.");
      return;
    }
    const current = boardRef.current;
    const snapshot = current.clusterSnapshot;
    if (!snapshot || !snapshot.result.groups.some((group) => group.id === editingGroupName.id)) {
      setEditingGroupName(null);
      setClusterError("This group is no longer available. Organize the canvas again.");
      return;
    }
    const updatedBoard = { ...current, clusterSnapshot: renameClusterGroup(snapshot, editingGroupName.id, label) };
    if (manualNameRevision.current !== snapshot.revision) {
      manualNameRevision.current = snapshot.revision;
      manuallyNamedGroups.current.clear();
    }
    manuallyNamedGroups.current.add(editingGroupName.id);
    setBoard(updatedBoard);
    boardRef.current = updatedBoard;
    setEditingGroupName(null);
    setClusterError("");
    setClusterNotice("Group name saved.");
  }

  async function suggestNamesForSnapshot(snapshot: NonNullable<Board["clusterSnapshot"]>, ideas: Idea[]) {
    const payload = clusterNamingPayload(ideas, snapshot);
    if (!payload) {
      setClusterNamesState("error");
      setClusterNamesError("Names are unavailable because one or more group notes have changed. Organize the canvas again.");
      return;
    }
    clusterNamesController.current?.abort();
    const controller = new AbortController();
    clusterNamesController.current = controller;
    const requestId = ++clusterNamesSequence.current;
    const sourceFingerprint = memberFingerprint(ideas, snapshot);
    clusterNamesContext.current = { revision: snapshot.revision, sourceFingerprint };
    if (manualNameRevision.current !== snapshot.revision) {
      manualNameRevision.current = snapshot.revision;
      manuallyNamedGroups.current.clear();
    }
    setClusterNamesState("pending");
    setClusterNamesError("");
    try {
      const response = await fetch("/api/similarity/clusters/names", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal,
      });
      const result: unknown = await response.json().catch(() => null);
      if (requestId !== clusterNamesSequence.current) return;
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error : "The AI could not suggest group names. Try again.";
        throw new Error(message);
      }
      const parsed = clusterNamesResponseSchema.safeParse(result);
      if (!parsed.success || parsed.data.revision !== snapshot.revision ||
        parsed.data.names.length !== snapshot.result.groups.length ||
        new Set(parsed.data.names.map((item) => item.groupId)).size !== snapshot.result.groups.length ||
        snapshot.result.groups.some((group) => !parsed.data.names.some((item) => item.groupId === group.id))) {
        throw new Error("The AI returned invalid group names. Try again.");
      }
      const latest = boardRef.current;
      const latestSnapshot = latest.clusterSnapshot;
      if (!latestSnapshot || latestSnapshot.stale || latestSnapshot.revision !== snapshot.revision ||
        memberFingerprint(latest.ideas, latestSnapshot) !== sourceFingerprint) return;
      let namedSnapshot = latestSnapshot;
      const manualIds = manualNameRevision.current === snapshot.revision ? manuallyNamedGroups.current : new Set<string>();
      for (const item of parsed.data.names) {
        if (item.suggestedName && !manualIds.has(item.groupId) && namedSnapshot.result.groups.some((group) => group.id === item.groupId)) {
          namedSnapshot = renameClusterGroup(namedSnapshot, item.groupId, item.suggestedName);
        }
      }
      if (namedSnapshot !== latestSnapshot) {
        const namedBoard = { ...latest, clusterSnapshot: namedSnapshot };
        setBoard(namedBoard);
        boardRef.current = namedBoard;
      }
      clusterNamesContext.current = null;
      clusterNamesController.current = null;
      setClusterNamesState("ready");
      setClusterNamesError("");
    } catch (error) {
      if (requestId !== clusterNamesSequence.current || controller.signal.aborted) return;
      clusterNamesContext.current = null;
      clusterNamesController.current = null;
      setClusterNamesState("error");
      setClusterNamesError(error instanceof Error ? error.message : "The AI could not suggest group names. Try again.");
    }
  }

  function retryClusterNames() {
    const current = boardRef.current;
    if (current.clusterSnapshot && !current.clusterSnapshot.stale) void suggestNamesForSnapshot(current.clusterSnapshot, current.ideas);
  }

  async function organizeBoard() {
    const current = boardRef.current;
    const input = current.ideas.flatMap((idea) => {
      const text = clusterText(idea);
      return text && text.length <= 4000 ? [{ id: idea.id, text }] : [];
    });
    if (input.length < 2) { setClusterError("Add at least two notes with text before organizing."); return; }
    if (input.length > 50) { setClusterError("Organize supports up to 50 notes at a time."); return; }
    if (current.ideas.some((idea) => (clusterText(idea)?.length ?? 0) > 4000)) {
      setClusterError("Shorten note text to 4,000 characters or fewer before organizing."); return;
    }
    const count = Math.min(Math.max(2, clusterCount), 10, input.length);
    const submittedFingerprint = boardFingerprint(current.ideas);
    const requestId = ++clusterRequestSequence.current;
    clusterNamesController.current?.abort();
    clusterNamesController.current = null;
    clusterNamesContext.current = null;
    clusterNamesSequence.current += 1;
    setClusterNamesState("idle");
    setClusterNamesError("");
    manualNameRevision.current = null;
    manuallyNamedGroups.current.clear();
    clusterRequestFingerprint.current = submittedFingerprint;
    setClusterBusy(true);
    setClusterError("");
    setClusterNotice("");
    setEditingGroupName(null);
    try {
      const response = await fetch("/api/similarity/clusters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: input, clusterCount: count }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (requestId !== clusterRequestSequence.current) return;
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error : "Clustering failed. Try again.";
        throw new Error(message);
      }
      const parsed = clusterResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("The clustering service returned an invalid result. Try again.");
      if (boardFingerprint(boardRef.current.ideas) !== submittedFingerprint) {
        setClusterError("The board changed; organize again."); return;
      }

      const latestBoard = boardRef.current;
      const measured = Object.fromEntries(Object.entries(nodeLayouts).flatMap(([id, layout]) => {
        const size = layout.measured;
        return size?.width && size.height ? [[id, { width: size.width, height: size.height }]] : [];
      }));
      const layout = layoutClusters(latestBoard.ideas, parsed.data, measured);
      const nextSnapshot = { revision: crypto.randomUUID(), stale: false, result: parsed.data, bubbles: layout.bubbles };
      const previousPositions = new Map(latestBoard.ideas.map((idea) => [idea.id, { ...idea.position }]));
      const updatePositions = (currentBoard: Board): Board => {
        if (boardFingerprint(currentBoard.ideas) !== submittedFingerprint) return currentBoard;
        return { ...currentBoard, ideas: currentBoard.ideas.map((idea) => {
          const position = layout.positions.get(idea.id);
          return position && !idea.pinned ? { ...idea, position } : idea;
        }), clusterSnapshot: nextSnapshot };
      };
      let committedBoard = updatePositions(latestBoard);
      setUndoAfterFingerprint(positionFingerprint(updatePositions(latestBoard).ideas));
      setUndoSnapshot(latestBoard.clusterSnapshot ?? null);
      physics.stop();
      physics.syncPositions(layout.positions);
      setPhysicsEnabled(false);
      if (onBoardChange) {
        let committed = false;
        onBoardChange((currentBoard) => {
          if (boardFingerprint(currentBoard.ideas) !== submittedFingerprint) return currentBoard;
          committed = true;
          committedBoard = updatePositions(currentBoard);
          return committedBoard;
        });
        if (!committed) { setClusterError("The board changed; organize again."); return; }
      } else {
        setLocalBoard(committedBoard);
      }
      boardRef.current = committedBoard;
      setUndoPositions(previousPositions);
      setAssignmentUndo(null);
      setClusterCount(count);
      setOrganizeOpen(false);
      setClusterNotice(`Grouped ${parsed.data.noteCount} notes into ${parsed.data.clusterCount} groups using ${parsed.data.scoreMethod}.`);
      void suggestNamesForSnapshot(nextSnapshot, committedBoard.ideas);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        void flow.current?.fitView({ padding: 0.2, duration: 300 });
      }));
    } catch (error) {
      if (requestId === clusterRequestSequence.current) setClusterError(error instanceof Error ? error.message : "Clustering failed. Try again.");
    } finally {
      if (requestId === clusterRequestSequence.current) {
        clusterRequestFingerprint.current = null;
        setClusterBusy(false);
      }
    }
  }

  async function assignNewNote(savedBoard: Board, savedIdea: Idea) {
    const snapshot = savedBoard.clusterSnapshot;
    const noteText = clusterText(savedIdea);
    if (!snapshot || snapshot.stale || !snapshot.result.notePairs || !noteText) {
      setClusterNotice("Organize the canvas first to create current groups.");
      return;
    }
    if (snapshot.result.noteCount >= 50) {
      setClusterNotice("Auto placement supports up to 50 grouped notes. Use Organize canvas to rebuild.");
      return;
    }
    if (noteText.length > 4000) {
      setClusterError("Shorten this note to 4,000 characters before automatic placement.");
      setAssignmentRetryId(savedIdea.id);
      return;
    }
    const requestGroups = snapshot.result.groups.map((group) => ({
      id: group.id,
      representativeNoteId: group.representativeNoteId,
      cards: group.noteIds.flatMap((id) => {
        const idea = savedBoard.ideas.find((candidate) => candidate.id === id);
        const text = idea && clusterText(idea);
        return idea && text ? [{ id, text }] : [];
      }),
    }));
    if (requestGroups.some((group) => group.cards.length === 0) || requestGroups.flatMap((group) => group.cards).length !== snapshot.result.noteCount) {
      setClusterNotice("A grouped note changed. Use Organize canvas to refresh the groups.");
      return;
    }
    const sourceFingerprint = memberFingerprint(savedBoard.ideas, snapshot);
    const dragRevision = dragRevisions.current.get(savedIdea.id) ?? 0;
    assignmentController.current?.abort();
    const controller = new AbortController();
    assignmentController.current = controller;
    activeAssignmentId.current = savedIdea.id;
    const requestId = ++assignmentRequestSequence.current;
    setAssignmentBusy(true);
    setAssignmentRetryId(null);
    setClusterError("");
    setClusterNotice("");
    physics.stop();
    setPhysicsEnabled(false);
    try {
      const response = await fetch("/api/similarity/clusters/assign", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ newCard: { id: savedIdea.id, text: noteText }, groups: requestGroups, revision: snapshot.revision }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (requestId !== assignmentRequestSequence.current) return;
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error : "Could not place this note. Try again.";
        throw new Error(message);
      }
      const parsed = clusterAssignmentResponseSchema.safeParse(payload);
      const expectedIds = new Set([savedIdea.id, ...requestGroups.flatMap((group) => group.cards.map((card) => card.id))]);
      if (!parsed.success || parsed.data.revision !== snapshot.revision || parsed.data.newNoteId !== savedIdea.id ||
        parsed.data.noteCount !== expectedIds.size || parsed.data.notePairs.some((pair) => !expectedIds.has(pair.sourceId) || !expectedIds.has(pair.targetId))) {
        throw new Error("The assignment service returned an invalid result. Try again.");
      }
      const latest = boardRef.current;
      const latestIdea = latest.ideas.find((idea) => idea.id === savedIdea.id);
      if (!latest.clusterSnapshot || latest.clusterSnapshot.stale || latest.clusterSnapshot.revision !== snapshot.revision ||
        memberFingerprint(latest.ideas, latest.clusterSnapshot) !== sourceFingerprint || !latestIdea || clusterText(latestIdea) !== noteText ||
        (dragRevisions.current.get(savedIdea.id) ?? 0) !== dragRevision || !autoPlacePreference.current) {
        setAssignmentRetryId(savedIdea.id);
        setClusterNotice("The board changed before placement finished. Try placing this note again.");
        return;
      }
      const chosenGroup = latest.clusterSnapshot.result.groups.find((group) => group.id === parsed.data.chosenGroupId);
      const chosenBubble = latest.clusterSnapshot.bubbles.find((bubble) => bubble.clusterId === parsed.data.chosenGroupId);
      if (!chosenGroup || !chosenBubble) throw new Error("The current group could not be found. Use Organize canvas and try again.");
      const measured = Object.fromEntries(Object.entries(nodeLayouts).flatMap(([id, layout]) => {
        const size = layout.measured;
        return size?.width && size.height ? [[id, { width: size.width, height: size.height }]] : [];
      }));
      const placement = latestIdea.pinned ? null : placeNewNote(latestIdea, parsed.data.chosenGroupId, chosenGroup.noteIds, parsed.data, chosenBubble, latest.ideas, measured, latest.clusterSnapshot.bubbles);
      const nextSnapshot = appendClusterAssignment(latest.clusterSnapshot, latestIdea, parsed.data, placement?.bubble ?? null, crypto.randomUUID());
      const nextPosition = placement?.position ?? latestIdea.position;
      let committed = false;
      const commit = (current: Board): Board => {
        const currentIdea = current.ideas.find((idea) => idea.id === savedIdea.id);
        if (!current.clusterSnapshot || current.clusterSnapshot.stale || current.clusterSnapshot.revision !== snapshot.revision ||
          memberFingerprint(current.ideas, current.clusterSnapshot) !== sourceFingerprint || !currentIdea || clusterText(currentIdea) !== noteText ||
          (dragRevisions.current.get(savedIdea.id) ?? 0) !== dragRevision || !autoPlacePreference.current) return current;
        committed = true;
        return {
          ...current,
          clusterSnapshot: nextSnapshot,
          ideas: current.ideas.map((idea) => idea.id === savedIdea.id ? { ...idea, position: nextPosition } : idea),
        };
      };
      if (onBoardChange) onBoardChange(commit);
      else setLocalBoard(commit);
      if (!committed) {
        setAssignmentRetryId(savedIdea.id);
        setClusterNotice("The board changed before placement finished. Try placing this note again.");
        return;
      }
      const moved = nextPosition.x !== latestIdea.position.x || nextPosition.y !== latestIdea.position.y;
      if (moved) {
        physics.syncPositions(new Map([[savedIdea.id, nextPosition]]));
        setAssignmentUndo({ id: savedIdea.id, position: latestIdea.position, after: nextPosition, snapshot: latest.clusterSnapshot, appliedRevision: nextSnapshot.revision });
      } else setAssignmentUndo(null);
      setClusterNotice(placement ? `Placed in ${chosenGroup.label} · ${parsed.data.scoreMethod.replaceAll("_", " ")} score ${parsed.data.groups.find((group) => group.groupId === chosenGroup.id)?.meanSimilarity.toFixed(2)}.` :
        latestIdea.pinned ? `Added to ${chosenGroup.label}. The note is pinned, so it stayed in place.` :
          `Added to ${chosenGroup.label}, but there is no free space nearby. Use Organize canvas to rebuild the layout.`);
    } catch (error) {
      if (requestId === assignmentRequestSequence.current && !controller.signal.aborted) {
        setAssignmentRetryId(savedIdea.id);
        setClusterError(error instanceof Error ? error.message : "Could not place this note. Try again.");
      }
    } finally {
      if (requestId === assignmentRequestSequence.current) {
        assignmentController.current = null;
        activeAssignmentId.current = null;
        setAssignmentBusy(false);
      }
    }
  }

  function undoOrganize() {
    if (!undoPositions) return;
    if (undoAfterFingerprint !== positionFingerprint(boardRef.current.ideas)) {
      setUndoPositions(null);
      setUndoAfterFingerprint(null);
      setClusterNotice("Board positions changed; organize again before undoing.");
      return;
    }
    const restore = (current: Board): Board => ({ ...current, clusterSnapshot: undoSnapshot ?? null, ideas: current.ideas.map((idea) => {
      const position = undoPositions.get(idea.id);
      return position && !idea.pinned ? { ...idea, position } : idea;
    }) });
    physics.stop();
    physics.syncPositions(undoPositions);
    if (onBoardChange) onBoardChange(restore);
    else setLocalBoard(restore);
    setUndoPositions(null);
    setUndoSnapshot(null);
    setUndoAfterFingerprint(null);
    setAssignmentUndo(null);
    setClusterNotice("Previous layout restored.");
  }

  function undoAutomaticPlacement() {
    if (!assignmentUndo) return;
    const restore = (current: Board): Board => {
      const idea = current.ideas.find((item) => item.id === assignmentUndo.id);
      if (!idea || current.clusterSnapshot?.stale || current.clusterSnapshot?.revision !== assignmentUndo.appliedRevision || idea.position.x !== assignmentUndo.after.x || idea.position.y !== assignmentUndo.after.y) return current;
      return {
        ...current,
        clusterSnapshot: assignmentUndo.snapshot ?? null,
        ideas: current.ideas.map((item) => item.id === assignmentUndo.id ? { ...item, position: assignmentUndo.position } : item),
      };
    };
    const latest = boardRef.current;
    const currentIdea = latest.ideas.find((idea) => idea.id === assignmentUndo.id);
    if (!currentIdea || latest.clusterSnapshot?.stale || latest.clusterSnapshot?.revision !== assignmentUndo.appliedRevision || currentIdea.position.x !== assignmentUndo.after.x || currentIdea.position.y !== assignmentUndo.after.y) {
      setAssignmentUndo(null);
      return;
    }
    physics.syncPositions(new Map([[assignmentUndo.id, assignmentUndo.position]]));
    if (onBoardChange) onBoardChange(restore);
    else setLocalBoard(restore);
    setAssignmentUndo(null);
    setClusterNotice("The new note returned to its previous position.");
  }

  const nodes: IdeaNode[] = board.ideas.map((idea) => ({
    ...nodeLayouts[idea.id],
    id: idea.id, type: "idea", position: idea.position, selected: selection?.kind === "idea" && selection.id === idea.id || mergeIds.includes(idea.id),
    className: chosenLink && (chosenLink.source === idea.id || chosenLink.target === idea.id) ? "is-related" : undefined,
    draggable: tool !== "connect" && editor?.id !== idea.id,
    data: { idea, connecting: tool === "connect", source: sourceId === idea.id, editing: editor?.id === idea.id, squash: squashes[idea.id] ?? null,
      mergeIndex: mergeIds.indexOf(idea.id) + 1, onMergeDetails: idea.merge ? () => setMergeDetailsId(idea.id) : undefined,
      onSelect: (additive) => selectMergeNote(idea.id, additive || mergeIds.length === 1),
      clusterLabel: clusterLabels.get(idea.id), clusterColor: clusterColors.get(idea.id),
      onEdit: () => openEditor(idea), onStartConnection: (event) => startConnectDrag(idea.id, event) },
  }));
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
  const undoPlacementAvailable = Boolean(assignmentUndo && !clusterSnapshot?.stale && clusterSnapshot?.revision === assignmentUndo.appliedRevision &&
    board.ideas.find((idea) => idea.id === assignmentUndo.id)?.position.x === assignmentUndo.after.x &&
    board.ideas.find((idea) => idea.id === assignmentUndo.id)?.position.y === assignmentUndo.after.y);
  const edges = useMemo<Edge[]>(() => [...[...board.relationships, ...suggestions.previews.filter((preview) => isCurrentConnection(board, preview)).map((preview) => ({ id: preview.id, source: preview.sourceId, target: preview.targetId, type: preview.type, explanation: preview.explanation }))].map((link) => {
    const provisional = suggestions.previews.some((preview) => preview.id === link.id);
    const source = board.ideas.find((idea) => idea.id === link.source);
    const target = board.ideas.find((idea) => idea.id === link.target);
    const pointsRight = !source || !target || source.position.x <= target.position.x;
    return {
    id: link.id, source: link.source, target: link.target, sourceHandle: pointsRight ? "source-right" : "source-left",
    targetHandle: pointsRight ? "target-left" : "target-right", type: "smoothstep", label: `${provisional ? "Suggested: " : ""}${relationshipLabels[link.type]}`,
    selectable: !provisional, focusable: !provisional,
    selected: selection?.kind === "relationship" && selection.id === link.id,
    markerEnd: link.type === "extends" ? { type: MarkerType.ArrowClosed, color: theme === "dark" ? "#86bdd0" : "#46758c" } : undefined,
    style: { stroke: link.type === "conflict" ? (theme === "dark" ? "#e08b7e" : "#b6665b") : link.type === "extends" ? (theme === "dark" ? "#86bdd0" : "#46758c") : (theme === "dark" ? "#79c5a6" : "#4b8a79"), strokeWidth: selection?.id === link.id ? 3 : 2, strokeDasharray: provisional ? "7 5" : undefined },
    labelStyle: { fontSize: 12, fontWeight: 700, fill: theme === "dark" ? "#dce8e3" : "#3c5260" },
    labelBgStyle: { fill: theme === "dark" ? "#21312f" : "#fff", fillOpacity: 0.96 }, labelBgPadding: [8, 5] as [number, number], labelBgBorderRadius: 6,
    interactionWidth: 24,
  }; }), ...board.ideas.flatMap((idea) => idea.merge ? idea.merge.sources.filter((source) => board.ideas.some((candidate) => candidate.id === source.id)).map((source) => ({
    id: `ancestry:${source.id}:${idea.id}`, source: source.id, target: idea.id,
    sourceHandle: "source-bottom", targetHandle: "target-top", type: "default", selectable: false,
    style: { stroke: theme === "dark" ? "#83c7ac" : "#5b9c82", strokeWidth: 2.4 },
  } as Edge)) : [])], [board, suggestions.previews, selection, theme]);

  return <main className="board-shell" data-theme={theme}>
    <header className="board-topbar" aria-label="Board controls"><div className="board-brand">
      <Link href="/" className="board-brand-home" aria-label="IdeaForge home" title="IdeaForge home"><span className="board-brand-symbol" aria-hidden="true">✳</span></Link>
      <input aria-label="Board title" value={title} maxLength={80} onChange={(event) => changeTitle(event.target.value)} /></div>
      <label className="board-goal-field"><span>Board goal</span><textarea aria-label="Board goal" rows={2} value={board.goal ?? "Help students build a consistent study habit."} maxLength={500}
        onChange={(event) => setBoard((current) => ({ ...current, goal: event.target.value }))} /></label>
      <div className="board-top-actions">{onBoardChange && <><ActiveMembers /><button className="board-share-button" type="button" onClick={() => void copyBoardLink()}>Share</button></>}
        <AccountMenu />
        <button className="board-theme-toggle" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={theme === "dark"} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "◐"}</button></div>
      {shareNotice && <span className="board-share-notice" role="status">{shareNotice}</span>}
    </header>
    <div className="board-workspace">
      <div ref={canvas} className={`board-canvas ${tool === "add" ? "placing" : ""} ${tool === "connect" ? "connecting" : ""} ${tool === "hand" || spaceDown ? "panning" : ""}`}>
        <ReactFlow<IdeaNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onInit={(instance) => { flow.current = instance; setZoom(instance.getZoom()); }} onMove={(_, viewport) => setZoom(viewport.zoom)}
          onPaneClick={(event) => { if (tool === "add" && flow.current) { const point = flow.current.screenToFlowPosition({ x: event.clientX, y: event.clientY }); makeIdea({ x: point.x - IDEA_CARD_SIZE.width / 2, y: point.y - IDEA_CARD_SIZE.height / 2 }); }
            else { setSelection(null); setMergeIds([]); if (tool === "connect") { setSourceId(null); setLinkDraft(null); setTool("select"); } } }}
          onNodeClick={(event, node) => { if (tool !== "connect") selectMergeNote(node.id, event.shiftKey || mergeIds.length === 1); }}
          onEdgeClick={(_, edge) => { if (!board.relationships.some((link) => link.id === edge.id)) return; setMergeIds([]); setSelection({ kind: "relationship", id: edge.id }); setTool("select"); }}
          onNodeDragStart={(_, node) => {
            dragRevisions.current.set(node.id, (dragRevisions.current.get(node.id) ?? 0) + 1);
            if (node.id === activeAssignmentId.current) assignmentController.current?.abort();
            physics.dragStart(node.id);
          }}
          onNodeDrag={(_, node) => { physics.drag(node.id, node.position); setBoard((current) => moveIdea(current, node.id, node.position)); }}
          onNodeDragStop={(_, node) => { setBoard((current) => moveIdea(current, node.id, node.position)); physics.dragStop(node.id, node.position, Boolean(boardRef.current.ideas.find((idea) => idea.id === node.id)?.pinned)); setUndoPositions(null); setAssignmentUndo(null); }}
          panOnDrag={tool === "hand" || spaceDown} nodesDraggable={tool !== "hand" && !spaceDown && tool !== "connect"}
          nodesConnectable={false} elementsSelectable={true} zoomOnDoubleClick={false} minZoom={0.15} maxZoom={1.8} defaultViewport={{ x: 185, y: 180, zoom: 0.72 }}>
          <Background variant={BackgroundVariant.Dots} gap={23} size={1.3} color={theme === "dark" ? "#354c49" : "#cad7d2"} />
        </ReactFlow>
        {connectDrag.preview?.active && <svg className="board-connection-preview" aria-hidden="true">
          <line x1={connectDrag.preview.x1} y1={connectDrag.preview.y1} x2={connectDrag.preview.x2} y2={connectDrag.preview.y2} />
          <circle cx={connectDrag.preview.x2} cy={connectDrag.preview.y2} r="6" />
        </svg>}
        <div className="board-tool-dock">
        <button className={`board-assistant-launch ${chatOpen ? "is-open" : ""}`} aria-label={chatOpen ? "Close AI helper" : "Open AI helper"} title={chatOpen ? "Close AI helper" : "Open AI helper"} aria-expanded={chatOpen} onClick={() => setChatOpen((value) => !value)}>✳</button>
        <nav className="board-toolbar" aria-label="Board tools">
          <ToolButton label="Select" active={tool === "select"} onClick={() => selectTool("select")}>↖</ToolButton>
          <ToolButton label="Hand / Pan" active={tool === "hand"} onClick={() => selectTool("hand")}>✋</ToolButton>
          <div className="board-tool-rule" />
          <ToolButton label="Add idea" active={tool === "add"} onClick={() => selectTool("add")}>＋</ToolButton>
          <ToolButton label="Connect" active={tool === "connect"} title={tool === "connect" ? "Connect is active. Drag from one idea into another." : "Connect ideas by dragging from one bubble into another"} onClick={() => selectTool("connect")}>⌁</ToolButton>
          <div className="board-tool-rule" />
          <ToolButton label={clusterResult ? "Organize again" : "Organize"} active={organizeOpen} disabled={clusterBusy || assignmentBusy || clusterInput.cards.length < 2 || clusterInput.cards.length > 50 || clusterInput.tooLongCount > 0} title={clusterInput.tooLongCount ? "Shorten note text to 4,000 characters before organizing" : "Group related notes and arrange the canvas"} onClick={openOrganize}>▦</ToolButton>
          <ToolButton label="Physics" active={physicsEnabled} disabled={Boolean(onBoardChange)} title={onBoardChange ? "Physics is available on the local demo" : "Physics"} onClick={() => setPhysicsEnabled((value) => !value)}>◉</ToolButton>
        </nav></div>
        {organizeOpen && <section className="board-organize-panel" aria-label="Organize notes">
          <div className="board-organize-head"><div><span className="board-eyebrow">CANVAS LAYOUT</span><h2>Organize notes</h2></div><button type="button" className="board-icon-button" aria-label="Close organize panel" onClick={() => setOrganizeOpen(false)}>×</button></div>
          <p>Group notes by embedding similarity. An AI model suggests concise group names; you can rename any group. The add-note switch places only a new note into an existing group.</p>
          <label className="board-organize-count">Number of groups<select value={Math.min(clusterCount, Math.max(2, Math.min(10, clusterInput.cards.length)))} onChange={(event) => setClusterCount(Number(event.target.value))} disabled={clusterBusy || clusterInput.cards.length < 2}>
            {Array.from({ length: Math.max(0, Math.min(10, clusterInput.cards.length) - 1) }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} groups</option>)}
          </select></label>
          <div className="board-organize-count-note"><span>{clusterInput.cards.length} notes ready</span><span>{clusterInput.emptyCount} empty notes skipped</span></div>
          {clusterInput.cards.length > 50 && <p className="board-error" role="alert">Organize supports up to 50 notes at a time.</p>}
          {clusterInput.tooLongCount > 0 && <p className="board-error" role="alert">{clusterInput.tooLongCount} note(s) exceed the 4,000 character limit. Shorten them before organizing.</p>}
          {clusterError && <p className="board-error" role="alert">{clusterError}</p>}
          {clusterStale && <p className="board-organize-stale" role="status">Notes changed since this layout. Organize again to refresh the groups.</p>}
          {clusterBusy && <p className="board-organize-progress" role="status">Finding groups…</p>}
          {assignmentBusy && <p className="board-organize-progress" role="status">Finding a group for the new note…</p>}
          {clusterNamesState === "pending" && <p className="board-organize-progress" role="status">Naming groups with AI…</p>}
          {clusterNamesState === "error" && <div className="board-cluster-names-error" role="status"><span>Names unavailable. {clusterNamesError}</span><button type="button" onClick={retryClusterNames} disabled={clusterStale || assignmentBusy}>Retry names</button></div>}
          {clusterNamesState === "ready" && <p className="board-cluster-names-hint">AI suggestions · Rename any group to edit.</p>}
          {clusterResult?.groupPairs.length ? <p className="board-cluster-legend">Note spacing uses {clusterResult.notePairs?.length ?? 0} pairwise similarity scores; group badges show membership. Score method: {clusterResult.scoreMethod.replaceAll("_", " ")}.</p> : null}
          {clusterResult && <div className="board-organize-results" aria-label="Group results">
            <span className="board-organize-method">{clusterResult.scoreMethod.replaceAll("_", " ")} · {clusterResult.embeddingModel}</span>
            {clusterResult.groups.map((group) => <div className="board-organize-result" key={group.id}>
              <div className="board-organize-result-main">
                {editingGroupName?.id === group.id ? <form className="board-cluster-name-form" onSubmit={saveGroupName}>
                  <input aria-label={`Name for ${group.label}`} maxLength={80} value={editingGroupName.value} onChange={(event) => setEditingGroupName({ id: group.id, value: event.target.value })} autoFocus />
                  <button type="submit" disabled={clusterBusy || assignmentBusy}>Save</button>
                  <button type="button" onClick={() => setEditingGroupName(null)}>Cancel</button>
                </form> : <>
                  <span>{group.label}<small>{group.size} notes</small></span>
                  <button type="button" className="board-cluster-rename" aria-label={`Rename ${group.label}`} onClick={() => { setClusterError(""); setEditingGroupName({ id: group.id, value: group.label }); }} disabled={clusterBusy || assignmentBusy}>Rename</button>
                </>}
              </div>
              <small>{group.meanPairSimilarity === null ? "Single note" : `mean pair score ${group.meanPairSimilarity.toFixed(2)}`}</small>
            </div>)}
          </div>}
          {clusterNotice && <p className="board-organize-notice" role="status">{clusterNotice}</p>}
          <div className="board-organize-actions"><button type="button" onClick={() => setOrganizeOpen(false)}>Close</button><button type="button" className="primary" onClick={() => void organizeBoard()} disabled={clusterBusy || assignmentBusy || clusterInput.cards.length < 2 || clusterInput.cards.length > 50 || clusterInput.tooLongCount > 0}>{clusterBusy ? "Grouping…" : "Organize canvas"}</button></div>
          {undoPositions && !clusterStale && undoAfterFingerprint === positionFingerprint(board.ideas) && <button type="button" className="board-organize-undo" onClick={undoOrganize}>Undo layout</button>}
        </section>}
        {(clusterNotice || clusterError || assignmentBusy || clusterNamesState === "pending" || clusterNamesState === "error") && <aside className="board-layout-status" role={clusterError ? "alert" : "status"}>
          <span>{assignmentBusy ? "Finding a group for the new note…" : clusterNamesState === "pending" ? "Naming groups with AI…" : clusterNamesState === "error" ? `Group names unavailable. ${clusterNamesError}` : clusterError || clusterNotice}</span>
          {clusterNamesState === "error" && <button type="button" onClick={() => setOrganizeOpen(true)}>Review names</button>}
          {assignmentRetryId && !assignmentBusy && <button type="button" onClick={() => {
            const current = boardRef.current;
            const idea = current.ideas.find((item) => item.id === assignmentRetryId);
            if (idea) void assignNewNote(current, idea);
          }}>Retry placement</button>}
          {undoPlacementAvailable && <button type="button" onClick={undoAutomaticPlacement}>Undo placement</button>}
        </aside>}
        {board.ideas.length === 0 && <div className="board-empty"><span>✳</span><h2>Your board is ready</h2><p>Start with one thought. You can connect it to others as your map grows.</p><button onClick={addAtCenter}>＋ Add your first idea</button></div>}
        {mergeIds.length > 0 && mergeIds.every((id) => board.ideas.some((idea) => idea.id === id)) && !mergePreview && <div className="board-merge-tray" role="region" aria-label="Merge selected ideas">
          <div><strong>{mergeIds.length === 1 ? "Choose a second idea" : "Two ideas selected"}</strong>
            <span>{mergeIds.map((id, index) => `${index + 1}. ${board.ideas.find((idea) => idea.id === id)?.title || "Idea"}`).join("  +  ")}</span>
            {selectedPair?.relationship && <span>Using link: {relationshipLabels[selectedPair.relationship.type]}{selectedPair.relationship.explanation ? ` — ${selectedPair.relationship.explanation}` : ""}</span>}</div>
          {mergeIds.length === 1 && <span className="board-merge-hint">Shift-click another note, or tap it on touch.</span>}
          {mergeError && <span className="board-error" role="alert">{mergeError}</span>}
          <button type="button" onClick={() => { discardMerge(); setMergeIds([]); }}>Clear</button>
          {mergeIds.length === 2 && <button type="button" className="primary" disabled={mergeBusy || !selectedPair?.goal || selectedPair.sources.some((idea) => !mergeText(idea) || mergeText(idea).length > 4000)} onClick={() => void generateMerge()}>{mergeBusy ? "Generating…" : "Merge ideas"}</button>}
        </div>}
        {(chosenIdea || chosenLink) && <div className="board-selection-bar">
          {chosenIdea ? <><strong>{chosenIdea.title}</strong><button onClick={() => openEditor(chosenIdea)}>Edit</button><button onClick={() => { setMergeIds([chosenIdea.id]); setSelection(null); }}>Add to merge</button><button onClick={() => { setUndoPositions(null); setBoard((current) => setIdeaPinned(current, chosenIdea.id, !chosenIdea.pinned)); if (chosenIdea.pinned) physics.reheat(); }}>{chosenIdea.pinned ? "Unpin" : "Pin"}</button>{chosenIdea.merge && <button onClick={() => setMergeDetailsId(chosenIdea.id)}>How this idea was made</button>}</> : <><strong>{chosenLink && relationshipLabels[chosenLink.type]}</strong>{chosenLink?.explanation && <span title={[chosenLink.explanation, chosenLink.condition].filter(Boolean).join(" When: ")}>{chosenLink.explanation}{chosenLink.condition ? ` When: ${chosenLink.condition}` : ""}</span>}</>}
          <button className="danger" onClick={removeSelection}>Delete</button></div>}
        <div className="board-zoom"><button aria-label="Zoom out" title="Zoom out" onClick={() => flow.current?.zoomOut({ duration: 180 })}>−</button><button aria-label="Fit ideas" title="Fit ideas" onClick={() => { void fitBoard(); }}>⤢</button><ZoomReadout zoom={zoom} /><button aria-label="Zoom in" title="Zoom in" onClick={() => flow.current?.zoomIn({ duration: 180 })}>＋</button></div>
      </div>
      {!chatOpen && <ConnectionSuggestionsPanel board={board} suggestions={suggestions} onBoardChange={setBoard} />}
      <ChatSidebar open={chatOpen} onToggle={() => setChatOpen((value) => !value)} />
    </div>
    {mergePreview && <div className="board-merge-panel" role="dialog" aria-modal="false" aria-label="Merged idea preview">
      <div className="board-merge-panel-head"><div><span className="board-eyebrow">AI PROPOSAL</span><h2>Merge preview</h2></div><button type="button" aria-label="Discard merge preview" onClick={discardMerge}>×</button></div>
      <p className="board-merge-sources">{mergePreview.ids.map((id, index) => `${index + 1}. ${board.ideas.find((idea) => idea.id === id)?.title || "Deleted idea"}`).join("  +  ")}</p>
      {previewContext?.relationship && <p className="board-merge-sources">Link: {relationshipLabels[previewContext.relationship.type]}{previewContext.relationship.explanation ? ` — ${previewContext.relationship.explanation}` : ""}</p>}
      {previewStale && <p className="board-error" role="alert">A source note, its link, or the goal changed. Regenerate before creating this idea.</p>}
      {mergePreview.result.status !== "useful" && <p className="board-merge-weak" role="status">{mergePreview.result.reason || "This pair needs a clearer connection before merging."}</p>}
      <label>Title<input value={mergePreview.title} maxLength={120} disabled={mergePreview.result.status !== "useful"} onChange={(event) => setMergePreview({ ...mergePreview, title: event.target.value })} /></label>
      <label>Concept<textarea value={mergePreview.concept} maxLength={2000} rows={5} disabled={mergePreview.result.status !== "useful"} onChange={(event) => setMergePreview({ ...mergePreview, concept: event.target.value })} /></label>
      <div className="board-merge-reasoning"><p><strong>Idea 1 adds</strong> {mergePreview.result.contributionA}</p><p><strong>Idea 2 adds</strong> {mergePreview.result.contributionB}</p>
        <p><strong>Bridge</strong> {mergePreview.result.bridge}</p><p><strong>Tension</strong> {mergePreview.result.tension}</p>
        {mergePreview.result.assumptions.length > 0 && <p><strong>Assumptions</strong> {mergePreview.result.assumptions.join("; ")}</p>}
        <p><strong>Try next</strong> {mergePreview.result.nextExperiment}</p></div>
      {mergeError && <p className="board-error" role="alert">{mergeError}</p>}
      <div className="board-merge-actions"><button type="button" onClick={discardMerge}>Discard</button><button type="button" disabled={mergeBusy} onClick={() => void generateMerge()}>{mergeBusy ? "Generating…" : "Regenerate"}</button>
        <button type="button" className="primary" disabled={mergeSaving || mergeBusy || previewStale || mergePreview.result.status !== "useful" || !mergePreview.title.trim() || !mergePreview.concept.trim()} onClick={keepMerge}>Create merged idea</button></div>
    </div>}
    {selectedMergeIdea?.merge && <div className="board-merge-details" role="dialog" aria-modal="false" aria-label="How this idea was made"><div className="board-merge-panel-head"><h2>How this idea was made</h2><button type="button" aria-label="Close merge details" onClick={() => setMergeDetailsId(null)}>×</button></div>
      <p>{selectedMergeIdea.merge.sources.map((source) => source.title || source.content).join(" + ")}</p>
      {selectedMergeIdea.merge.sources.map((source, index) => <div className="board-merge-source" key={`${source.id}-${index}`}><strong>Idea {index + 1}: {source.title}</strong><span>By {source.author}</span><p>{source.content}</p></div>)}
      <div className="board-merge-reasoning"><p><strong>Goal</strong> {selectedMergeIdea.merge.goal}</p>
        <p><strong>Idea 1 adds</strong> {selectedMergeIdea.merge.proposal.contributionA}</p><p><strong>Idea 2 adds</strong> {selectedMergeIdea.merge.proposal.contributionB}</p>
        {selectedMergeIdea.merge.relationship && <p><strong>Original link</strong> {relationshipLabels[selectedMergeIdea.merge.relationship.type]}: {selectedMergeIdea.merge.relationship.explanation || "No explanation"}</p>}
        <p><strong>Bridge</strong> {selectedMergeIdea.merge.proposal.bridge}</p><p><strong>Tension</strong> {selectedMergeIdea.merge.proposal.tension}</p>
        {selectedMergeIdea.merge.proposal.assumptions.length > 0 && <p><strong>Assumptions</strong> {selectedMergeIdea.merge.proposal.assumptions.join("; ")}</p>}
        <p><strong>Try next</strong> {selectedMergeIdea.merge.proposal.nextExperiment}</p></div>
      <small>Generated with {selectedMergeIdea.merge.model} on {new Date(selectedMergeIdea.merge.generatedAt).toLocaleString()}. The original proposal is saved with this idea.</small>
    </div>}
    {editor && <div className="board-modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}><form className="board-dialog" onSubmit={saveEdit} aria-label="Edit idea">
      <span className="board-eyebrow">IDEA DETAILS</span><h2>Edit idea</h2><label>Title<input ref={titleInput} value={editor.title} maxLength={120} onChange={(event) => { setEditor({ ...editor, title: event.target.value }); setEditError(""); }} /></label>
      <label>Content<textarea value={editor.content} maxLength={4000} rows={6} onChange={(event) => setEditor({ ...editor, content: event.target.value })} placeholder="What makes this idea useful?" /></label>
      {draftIdeaId.current === editor.id && <label className="board-auto-place-toggle"><input type="checkbox" checked={autoPlaceNewNotes} disabled={!clusterSnapshot || clusterStale || assignmentBusy} onChange={(event) => {
        const enabled = event.target.checked;
        autoPlacePreference.current = enabled;
        saveAutoPlacePreference(enabled);
        if (!enabled) {
          assignmentController.current?.abort();
          assignmentRequestSequence.current += 1;
          activeAssignmentId.current = null;
          setAssignmentBusy(false);
        }
      }} /><span><strong>Place new notes in an existing group</strong><small>{clusterStale ? "Organize the canvas again before auto placement." : clusterSnapshot ? "Applies to new notes created from this browser." : "Organize the canvas first to create groups."}</small></span></label>}
      {editError && <p className="board-error" role="alert">{editError}</p>}<div className="board-dialog-actions"><button type="button" onClick={() => setEditor(null)}>Cancel</button><button className="primary" type="submit">Save idea</button></div></form></div>}
    {linkDraft && <div className="board-modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelInteraction(); }}><form className="board-dialog" onSubmit={confirmLink} aria-label="Choose relationship">
      <span className="board-eyebrow">CONNECT IDEAS</span><h2>How are they related?</h2><p className="board-link-direction">{board.ideas.find((idea) => idea.id === linkDraft.source)?.title} → {board.ideas.find((idea) => idea.id === linkDraft.target)?.title}</p>
      <label>Relationship<select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)}>{Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {relationshipType === "extends" && <p className="board-direction-note">The first idea extends the second idea. The arrow will point to the second idea.</p>}
      <label>Explanation <span>(optional)</span><textarea rows={3} maxLength={500} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Why does this connection matter?" /></label>
      {linkError && <p className="board-error" role="alert">{linkError}</p>}<div className="board-dialog-actions"><button type="button" onClick={cancelInteraction}>Cancel</button><button className="primary" type="submit">Create connection</button></div></form></div>}
  </main>;
}
