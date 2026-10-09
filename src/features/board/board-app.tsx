"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ReactFlow, Background, BackgroundVariant, type NodeChange, type ReactFlowInstance } from "@xyflow/react";
import Link from "next/link";
import { createIdeaId } from "./id";
import { initialBoard } from "./fixtures";
import { clusterLabelsFor, createIdea, createRelationship, deleteIdea, deleteRelationship, IDEA_CARD_SIZE, ideaCardSize, moveIdea, relationshipLabels, setIdeaPinned, updateIdea, updateRelationship,
  type Board, type FreeDrawStroke, type Idea, type Relationship, type RelationshipType } from "./model";
import { FreeDrawLayer, type FreeDrawTool } from "./free-draw-layer";
import { Bubble, type IdeaNode } from "./bubble";
import { MarkdownText } from "./markdown-text";
import { OrthogonalEdge, type OrthogonalCanvasEdge } from "./orthogonal-edge";
import { orthogonalPreviewPath, routeCanvasEdges } from "./edge-routing";
import { ChatSidebar } from "./chat-sidebar";
import { acceptAssistantCreate, assistantActionIsCurrent, type AssistantActionDraft } from "./assistant-actions";
import { AccountMenu } from "./account-menu";
import { ActiveMembers } from "./active-members";
import { useConnectDrag } from "./use-connect-drag";
import { usePhysics, type Contact } from "./use-physics";
import { useConnectionSuggestions } from "./use-connection-suggestions";
import { ConnectionSuggestionsPanel } from "./connection-suggestions-panel";
import { isCurrentConnection } from "./connection-preview";
import { clusterAssignmentResponseSchema, clusterNamesResponseSchema, clusterResponseSchema, type ClusterCard, type ClusterNamesRequest } from "@/lib/cluster-contract";
import { layoutClusters, placeNewNote } from "./cluster-layout";
import { withResolvedNodeOverlaps, type NodeSize } from "./node-layout";
import { appendClusterAssignment, memberFingerprint, renameClusterGroup } from "./cluster-state";
import { addMergedIdea, mergeContext, mergeText, relatedIdeaPosition, mergeDisplayData, mergeRecordFor } from "./merge-board";
import { initialGoal, MAX_MERGE_SOURCES, MAX_MERGE_TOTAL_CHARACTERS, mergeCoverageProblem, mergeProposalSchema, type MergeProposal } from "@/lib/ideas";
import { historyShortcut } from "./history-shortcut";
import { canApplyIdeaDescription, ideaDescriptionGoal, isTitleOnlyIdea, type IdeaDescriptionRequestState } from "./description-generation";
import { ideaDescriptionResponseSchema } from "@/lib/idea-description-contract";
import "./board.css";

type Tool = "select" | "hand" | "add" | "connect" | "merge";
type Selection = { kind: "idea" | "relationship"; id: string } | null;
type MergePreview = { ids: string[]; fingerprint: string; result: MergeProposal; model: string; generatedAt: string; title: string; concept: string };
type DescriptionStatus =
  | { kind: "pending"; autoPlace: boolean; goal: string }
  | { kind: "error"; autoPlace: boolean; goal: string; message: string }
  | { kind: "question"; autoPlace: boolean; goal: string; message: string };
const nodeTypes = { idea: Bubble, assistantPreview: Bubble };
const edgeTypes = { orthogonal: OrthogonalEdge };
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

function nodeSizeMap(layouts: Record<string, Pick<IdeaNode, "measured" | "dragging">>): Record<string, NodeSize | undefined> {
  return Object.fromEntries(Object.entries(layouts).map(([id, layout]) => [id, layout.measured?.width && layout.measured.height
    ? { width: layout.measured.width, height: layout.measured.height } : undefined]));
}

function normalizeBoardLayout(board: Board, measured: Record<string, NodeSize | undefined>, fixedIds: string[] = []) {
  return withResolvedNodeOverlaps(board, measured, new Set(fixedIds), clusterLabelsFor(board));
}

function textExcerpt(text: string, limit = 240): { text: string; shortened: boolean } {
  const characters = Array.from(text.trim());
  if (characters.length <= limit) return { text: characters.join(""), shortened: false };
  const boundary = characters.slice(0, limit).lastIndexOf(" ");
  const cutoff = boundary > limit * 0.7 ? boundary : limit;
  return { text: `${characters.slice(0, cutoff).join("").trimEnd()}…`, shortened: true };
}

type BoardAppProps = {
  sharedBoard?: Board;
  sharedTitle?: string;
  boardDescription?: string;
  onBoardChange?: (update: (board: Board) => Board) => boolean;
  onBackgroundBoardChange?: (update: (board: Board) => Board) => boolean;
  onTitleChange?: (title: string) => void | Promise<void>;
  historyActions?: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean; canWrite: boolean };
  liveDrawings?: FreeDrawStroke[];
  onDrawingPreviewChange?: (stroke: FreeDrawStroke | null) => void;
  authorName?: string;
  editingLocks?: Record<string, string>;
  onEditingIdeaChange?: (ideaId: string | null) => void;
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

export function BoardApp({ sharedBoard, sharedTitle, boardDescription = "", onBoardChange, onBackgroundBoardChange, onTitleChange, historyActions, liveDrawings = [], onDrawingPreviewChange, authorName, editingLocks = {}, onEditingIdeaChange }: BoardAppProps) {
  const [localBoard, setLocalBoard] = useState<Board>(() => normalizeBoardLayout(initialBoard, {}));
  const board = sharedBoard ?? localBoard;
  const setBoard = useCallback<Dispatch<SetStateAction<Board>>>((update) => {
    if (onBoardChange) onBoardChange((current) => typeof update === "function" ? update(current) : update);
    else setLocalBoard(update);
  }, [onBoardChange]);
  const [localTitle, setLocalTitle] = useState("Student collaboration ideas");
  const title = sharedTitle ?? localTitle;
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleError, setTitleError] = useState("");
  const [dragPositions, setDragPositions] = useState<Record<string, Idea["position"]>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [tool, setTool] = useState<Tool>("select");
  const [drawTool, setDrawTool] = useState<FreeDrawTool | null>(null);
  const canWriteBoard = !onBoardChange || historyActions?.canWrite === true;
  const [selection, setSelection] = useState<Selection>(null);
  const [hoveredIdeaId, setHoveredIdeaId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [onlySelectedNodeEdges, setOnlySelectedNodeEdges] = useState(false);
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [mergeEditMode, setMergeEditMode] = useState(false);
  const [mergeDetailsId, setMergeDetailsId] = useState<string | null>(null);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<{ source: string; target: string } | null>(null);
  const [relationshipEditor, setRelationshipEditor] = useState<Relationship | null>(null);
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("synergy");
  const [explanation, setExplanation] = useState("");
  const [condition, setCondition] = useState("");
  const [linkError, setLinkError] = useState("");
  const [editor, setEditor] = useState<{ id: string; title: string; content: string } | null>(null);
  const [editorPreview, setEditorPreview] = useState(false);
  const [editError, setEditError] = useState("");
  const [descriptionStatuses, setDescriptionStatuses] = useState<Record<string, DescriptionStatus>>({});
  const [lockNotice, setLockNotice] = useState("");
  const [physicsEnabled, setPhysicsEnabled] = useState(!onBoardChange);
  const [chatOpen, setChatOpen] = useState(false);
  const [assistantPreview, setAssistantPreview] = useState<AssistantActionDraft | null>(null);
  const [assistantDetailsId, setAssistantDetailsId] = useState<string | null>(null);
  const [draftIdeaId, setDraftIdeaId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [zoom, setZoom] = useState(0.72);
  const [squashes, setSquashes] = useState<Record<string, { axis: "x" | "y"; token: number }>>({});
  const [spaceDown, setSpaceDown] = useState(false);
  const [nodeLayouts, setNodeLayouts] = useState<Record<string, Pick<IdeaNode, "measured" | "dragging">>>({});
  const measuredSizes = useMemo(() => nodeSizeMap(nodeLayouts), [nodeLayouts]);
  const sharedLayoutInitialized = useRef(false);
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
  const flow = useRef<ReactFlowInstance<IdeaNode, OrthogonalCanvasEdge> | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const editorDraftRef = useRef<{ id: string; title: string; content: string } | null>(null);
  const draftIdeaRef = useRef<Idea | null>(null);
  const suppressTitleCommit = useRef(false);
  const boardRef = useRef(board);
  const dragPositionsRef = useRef(new Map<string, Idea["position"]>());
  const activeDragRef = useRef<{ id: string; position: Idea["position"] } | null>(null);
  const finishDragRef = useRef<(id: string, position: Idea["position"]) => void>(() => undefined);
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
  const descriptionRequests = useRef(new Map<string, { request: IdeaDescriptionRequestState; controller: AbortController; autoPlace: boolean }>());
  const descriptionSequence = useRef(0);
  const pendingAutoPlacement = useRef(new Set<string>());
  const autoPlacementStarted = useRef(new Set<string>());
  const assignNewNoteHandler = useRef<(savedBoard: Board, savedIdea: Idea) => Promise<void>>(async () => undefined);
  const mergeController = useRef<AbortController | null>(null);
  const mergeRequestSequence = useRef(0);
  const mergeSaveLock = useRef(false);
  const dragRevisions = useRef(new Map<string, number>());
  const autoPlacePreference = useRef(autoPlaceNewNotes);
  const boardTitleRef = useRef(title);
  const canWriteRef = useRef(canWriteBoard);
  const placeNoteOnce = useCallback((ideaId: string) => {
    if (!autoPlacePreference.current || !canWriteRef.current || autoPlacementStarted.current.has(ideaId)) return;
    const savedBoard = boardRef.current;
    const savedIdea = savedBoard.ideas.find((idea) => idea.id === ideaId);
    if (!savedIdea || !clusterText(savedIdea)) return;
    autoPlacementStarted.current.add(ideaId);
    void assignNewNoteHandler.current(savedBoard, savedIdea);
  }, []);
  const settlePendingPlacement = useCallback((ideaId: string) => {
    if (!pendingAutoPlacement.current.has(ideaId) || editorDraftRef.current?.id === ideaId) return;
    pendingAutoPlacement.current.delete(ideaId);
    placeNoteOnce(ideaId);
  }, [placeNoteOnce]);
  const queueOrSettlePlacement = useCallback((ideaId: string) => {
    pendingAutoPlacement.current.add(ideaId);
    settlePendingPlacement(ideaId);
  }, [settlePendingPlacement]);
  useEffect(() => { boardTitleRef.current = title; }, [title]);
  useEffect(() => { canWriteRef.current = canWriteBoard; }, [canWriteBoard]);
  useEffect(() => { autoPlacePreference.current = autoPlaceNewNotes; }, [autoPlaceNewNotes]);
  useEffect(() => { assignNewNoteHandler.current = assignNewNote; });
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => {
    const staleIds = new Set<string>();
    for (const [ideaId, pending] of descriptionRequests.current) {
      if (canApplyIdeaDescription(board, pending.request, pending.request.token,
        ideaDescriptionGoal(board, title), canWriteBoard)) continue;
      pending.controller.abort();
      descriptionRequests.current.delete(ideaId);
      staleIds.add(ideaId);
      if (pending.autoPlace) queueOrSettlePlacement(ideaId);
    }
    for (const [ideaId, status] of Object.entries(descriptionStatuses)) {
      if (status.kind === "pending" && descriptionRequests.current.has(ideaId)) continue;
      const idea = board.ideas.find((candidate) => candidate.id === ideaId);
      if (!idea || !isTitleOnlyIdea(idea) || ideaDescriptionGoal(board, title) !== status.goal) staleIds.add(ideaId);
    }
    if (staleIds.size) setDescriptionStatuses((current) => {
      let next = current;
      for (const id of staleIds) {
        if (!(id in next)) continue;
        if (next === current) next = { ...current };
        delete next[id];
      }
      return next;
    });
  }, [board, title, canWriteBoard, descriptionStatuses, queueOrSettlePlacement]);
  useEffect(() => {
    if (!sharedBoard || sharedLayoutInitialized.current) return;
    sharedLayoutInitialized.current = true;
    // Resolve against the stored board, not this render's snapshot, so edits another participant made since then are kept.
    if (normalizeBoardLayout(sharedBoard, measuredSizes) !== sharedBoard) onBackgroundBoardChange?.((current) => normalizeBoardLayout(current, measuredSizes));
  }, [sharedBoard, onBackgroundBoardChange, measuredSizes]);
  function commitBoardChange(update: (current: Board) => Board): boolean {
    if (onBoardChange) {
      let nextBoard: Board | undefined;
      const committed = onBoardChange((current) => {
        nextBoard = update(current);
        return nextBoard;
      });
      if (committed && nextBoard) boardRef.current = nextBoard;
      return committed;
    }
    const current = boardRef.current;
    const next = update(current);
    if (next === current) return false;
    boardRef.current = next;
    setLocalBoard(next);
    return true;
  }
  useEffect(() => () => {
    for (const timer of squashTimers.current.values()) window.clearTimeout(timer);
    for (const pending of descriptionRequests.current.values()) pending.controller.abort();
    descriptionRequests.current.clear();
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
    onDrop: (source, target) => { setLinkDraft({ source, target }); setRelationshipType("synergy"); setExplanation(""); setCondition(""); setLinkError(""); },
    onCancel: () => setSourceId(null),
  });
  const startConnectDrag = connectDrag.start;

  const frozenId = editor?.id ?? sourceId ?? activeDragId;
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
  const selectedCardId = selection?.kind === "idea" && board.ideas.some((idea) => idea.id === selection.id) ? selection.id : null;
  const suggestions = useConnectionSuggestions(board, board.goal ?? initialGoal, Boolean(editor));
  const selectedMergeContext = mergeIds.length >= 2 ? mergeContext(board, mergeIds) : null;
  const previewContext = mergePreview ? mergeContext(board, mergePreview.ids) : null;
  const previewStale = Boolean(mergePreview && previewContext?.fingerprint !== mergePreview.fingerprint);
  const selectedMergeIdea = mergeDetailsId ? board.ideas.find((idea) => idea.id === mergeDetailsId && idea.merge) : undefined;
  const selectedMergeDetails = selectedMergeIdea?.merge ? mergeDisplayData(selectedMergeIdea.merge) : null;
  const selectedAssistantIdea = assistantDetailsId ? board.ideas.find((idea) => idea.id === assistantDetailsId && idea.assistant) : undefined;


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
  async function changeTitle(nextTitle: string) {
    nextTitle = nextTitle.trim();
    if (!nextTitle) { setTitleError("The board title cannot be empty."); return; }
    if (nextTitle === title) return;
    if (onTitleChange) {
      setTitleError("");
      try { await onTitleChange(nextTitle); boardTitleRef.current = nextTitle; }
      catch (error) { setTitleError(error instanceof Error ? error.message : "The board title could not be saved."); }
    }
    else { boardTitleRef.current = nextTitle; setLocalTitle(nextTitle); }
  }
  function commitTitleDraft() {
    if (suppressTitleCommit.current) { suppressTitleCommit.current = false; setTitleDraft(null); return; }
    if (titleDraft !== null) void changeTitle(titleDraft);
    setTitleDraft(null);
  }
  const focusCard = useCallback((cardId: string) => {
    if (!boardRef.current.ideas.some((idea) => idea.id === cardId)) return;
    setSelection({ kind: "idea", id: cardId });
    setMergeIds([]);
    window.requestAnimationFrame(() => {
      void flow.current?.fitView({ nodes: [{ id: cardId }], padding: 0.45, duration: 350, maxZoom: 0.95 });
    });
  }, []);
  async function copyBoardLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareNotice("Link copied");
    } catch {
      setShareNotice("Copy the board URL from your browser address bar");
    }
    window.setTimeout(() => setShareNotice(""), 2500);
  }

  function openEditor(idea: Idea) {
    const editorName = editingLocks[idea.id];
    if (editorName) {
      setLockNotice(`${editorName} is editing this idea. You can still move, link, or merge it.`);
      return;
    }
    setLockNotice("");
    setMergeIds([]);
    setSelection({ kind: "idea", id: idea.id });
    setEditorDraft({ id: idea.id, title: idea.title, content: idea.content });
    setEditorPreview(false);
    setEditError("");
  }
  function setEditorDraft(next: { id: string; title: string; content: string } | null) {
    editorDraftRef.current = next;
    setEditor(next);
  }
  function closeEditor(placePending = true) {
    const ideaId = editorDraftRef.current?.id;
    setEditorDraft(null);
    if (placePending && ideaId) settlePendingPlacement(ideaId);
  }
  function openRelationshipEditor(relationship: Relationship) {
    setLinkDraft(null);
    setRelationshipEditor(relationship);
    setRelationshipType(relationship.type);
    setExplanation(relationship.explanation);
    setCondition(relationship.condition ?? "");
    setLinkError("");
  }
  const editingId = editor?.id;
  useEffect(() => {
    if (editingId) titleInput.current?.focus();
    if (!onEditingIdeaChange) return;
    onEditingIdeaChange(editingId ?? null);
    return () => onEditingIdeaChange(null);
  }, [editingId, onEditingIdeaChange]);
  function cancelInteraction() { connectDrag.cancel(); closeEditor(); setDraftIdeaId(null); draftIdeaRef.current = null; setLinkDraft(null); setRelationshipEditor(null); setSourceId(null); setLinkError(""); setCondition(""); setOrganizeOpen(false); setMergePreview(null); setMergeDetailsId(null); setMergeIds([]); setMergeError(""); mergeRequestSequence.current += 1; mergeController.current?.abort(); setMergeBusy(false); setDrawTool(null); setTool("select"); }
  function removeSelection() {
    if (!selection) return;
    if (selection.kind === "idea") { setUndoPositions(null); setAssignmentUndo(null); }
    if (selection.kind === "idea") {
      cancelDescriptionRequest(selection.id);
      setBoard((current) => normalizeBoardLayout(deleteIdea(current, selection.id), measuredSizes));
    }
    else setBoard((current) => deleteRelationship(current, selection.id));
    setSelection(null); closeEditor(false); setLinkDraft(null); setSourceId(null);
  }
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const typing = Boolean(target?.closest("input,textarea,select,[contenteditable]:not([contenteditable='false'])"));
      const historyAction = historyShortcut({ key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey,
        shiftKey: event.shiftKey, isComposing: event.isComposing, keyCode: event.keyCode, targetIsEditable: typing });
      if (historyAction && historyActions) {
        event.preventDefault();
        if (!historyActions.canWrite) return;
        if (historyAction === "undo" && historyActions.canUndo) historyActions.undo();
        if (historyAction === "redo" && historyActions.canRedo) historyActions.redo();
        return;
      }
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
    setDraftIdeaId(idea.id);
    draftIdeaRef.current = idea;
    setUndoPositions(null);
    setDrawTool(null); setTool("select"); openEditor(idea); physics.reheat();
  }
  function addAtCenter() {
    const bounds = canvas.current?.querySelector(".react-flow")?.getBoundingClientRect();
    if (!bounds || !flow.current) return;
    const point = flow.current.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    makeIdea({ x: point.x - IDEA_CARD_SIZE.width / 2, y: point.y - IDEA_CARD_SIZE.height / 2 });
  }
  function selectTool(next: Tool) {
    connectDrag.cancel(); setDrawTool(null); setTool(next); setSourceId(null); setLinkDraft(null);
    const seed = next === "merge" && selection?.kind === "idea" ? [selection.id] : [];
    setSelection(null); setMergeIds(seed); setMergeError("");
  }
  function selectDrawTool(next: FreeDrawTool) {
    selectTool("select");
    setDrawTool(next);
  }
  async function fitBoard() {
    if (!flow.current || !canvas.current || board.ideas.length === 0) return;
    const minX = Math.min(...board.ideas.map((idea) => idea.position.x));
    const minY = Math.min(...board.ideas.map((idea) => idea.position.y));
    const width = Math.max(...board.ideas.map((idea) => idea.position.x + ideaCardSize(idea, clusterLabels.get(idea.id)).width)) - minX;
    const height = Math.max(...board.ideas.map((idea) => idea.position.y + ideaCardSize(idea, clusterLabels.get(idea.id)).height)) - minY;
    const availableWidth = Math.max(240, canvas.current.clientWidth - 230);
    const availableHeight = Math.max(180, canvas.current.clientHeight - 260);
    const zoom = Math.max(0.15, Math.min(0.95, availableWidth / width, availableHeight / height));
    const x = 205 + (availableWidth - width * zoom) / 2 - minX * zoom;
    const y = 190 + (availableHeight - height * zoom) / 2 - minY * zoom;
    await flow.current.setViewport({ x, y, zoom }, { duration: 250 });
  }
  function confirmLink(event: FormEvent) {
    event.preventDefault();
    if (!linkDraft && !relationshipEditor) return;
    if (!explanation.trim()) { setLinkError("Add a short explanation for this relationship."); return; }
    if (relationshipType === "conflict" && !condition.trim()) { setLinkError("State the condition under which these ideas conflict."); return; }
    const endpoints = relationshipEditor ?? linkDraft!;
    const candidate: Relationship = { id: relationshipEditor?.id ?? createIdeaId(), source: endpoints.source, target: endpoints.target,
      type: relationshipType, explanation: explanation.trim(), ...(relationshipType === "conflict" ? { condition: condition.trim() } : {}),
      author: relationshipEditor?.author ?? authorName ?? "Unknown contributor" };
    const apply = relationshipEditor ? (current: Board) => updateRelationship(current, candidate.id, candidate) : (current: Board) => createRelationship(current, candidate);
    if (!commitBoardChange(apply)) { setLinkError("That relationship already exists, or the ideas are no longer available."); return; }
    setSelection({ kind: "relationship", id: candidate.id }); setLinkDraft(null); setRelationshipEditor(null); setSourceId(null); setCondition(""); setDrawTool(null); setTool("select"); physics.reheat();
  }
  function saveEdit(event: FormEvent) {
    event.preventDefault(); if (!editor) return;
    if (editingLocks[editor.id]) {
      setEditError(`${editingLocks[editor.id]} is editing this idea. Your changes were not saved.`);
      return;
    }
    if (!editor.title.trim()) { setEditError("Give this idea a title before saving."); titleInput.current?.focus(); return; }
    const isNewIdea = draftIdeaId === editor.id;
    const updated = boardRef.current.ideas.find((idea) => idea.id === editor.id);
    const draft = isNewIdea ? draftIdeaRef.current : updated;
    if (!draft) { closeEditor(false); setDraftIdeaId(null); draftIdeaRef.current = null; return; }
    const updatedIdea = { ...draft, title: editor.title.trim(), content: editor.content.trim() };
    setUndoPositions(null);
    setAssignmentUndo(null);
    const saved = commitBoardChange((current) => isNewIdea
      ? normalizeBoardLayout(createIdea(current, updatedIdea), measuredSizes, current.ideas.map((item) => item.id))
      : updateIdea(current, editor.id, { title: updatedIdea.title, content: updatedIdea.content }));
    if (!saved) {
      closeEditor(false);
      setDraftIdeaId(null);
      draftIdeaRef.current = null;
      return;
    }
    const updatedBoard = boardRef.current;
    closeEditor(false);
    if (isNewIdea) {
      setDraftIdeaId(null);
      draftIdeaRef.current = null;
      const shouldAutoPlace = autoPlaceNewNotes && Boolean(clusterText(updatedIdea));
      if (isTitleOnlyIdea(updatedIdea)) {
        if (shouldAutoPlace) pendingAutoPlacement.current.add(updatedIdea.id);
        void requestIdeaDescription(updatedIdea, ideaDescriptionGoal(updatedBoard, title), shouldAutoPlace);
      } else if (shouldAutoPlace) {
        pendingAutoPlacement.current.add(updatedIdea.id);
        settlePendingPlacement(updatedIdea.id);
      }
    } else if (pendingAutoPlacement.current.has(updatedIdea.id)) {
      settlePendingPlacement(updatedIdea.id);
    }
  }

  function clearDescriptionStatus(ideaId: string) {
    setDescriptionStatuses((current) => {
      if (!(ideaId in current)) return current;
      const next = { ...current };
      delete next[ideaId];
      return next;
    });
  }
  function cancelDescriptionRequest(ideaId: string) {
    descriptionRequests.current.get(ideaId)?.controller.abort();
    descriptionRequests.current.delete(ideaId);
    pendingAutoPlacement.current.delete(ideaId);
    clearDescriptionStatus(ideaId);
  }
  function changedEditorDraft(request: IdeaDescriptionRequestState) {
    const draft = editorDraftRef.current;
    return Boolean(draft?.id === request.ideaId &&
      (draft.title.trim() !== request.title || draft.content.trim()));
  }
  async function requestIdeaDescription(idea: Idea, goal: string, autoPlace: boolean) {
    if (!canWriteRef.current || !isTitleOnlyIdea(idea)) return;
    const previous = descriptionRequests.current.get(idea.id);
    if (previous) return;
    const controller = new AbortController();
    const request: IdeaDescriptionRequestState = {
      ideaId: idea.id, title: idea.title, goal, token: ++descriptionSequence.current,
    };
    const pending = { request, controller, autoPlace };
    descriptionRequests.current.set(idea.id, pending);
    setDescriptionStatuses((current) => ({ ...current, [idea.id]: { kind: "pending", autoPlace, goal } }));

    try {
      const response = await fetch("/api/ideas/description", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ title: request.title, goal: request.goal }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error : "The description could not be generated. Try again.";
        throw new Error(message);
      }
      const parsed = ideaDescriptionResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("The description service returned an invalid response. Try again.");
      if (descriptionRequests.current.get(idea.id) !== pending) return;
      if (changedEditorDraft(request)) {
        descriptionRequests.current.delete(idea.id);
        clearDescriptionStatus(idea.id);
        if (autoPlace) queueOrSettlePlacement(idea.id);
        return;
      }

      let canUseResponse = canApplyIdeaDescription(boardRef.current, request, request.token,
        ideaDescriptionGoal(boardRef.current, boardTitleRef.current), canWriteRef.current);
      let applied = false;
      if (parsed.data.description && canUseResponse) {
        const committed = commitBoardChange((current) => {
          canUseResponse = canApplyIdeaDescription(current, request,
            descriptionRequests.current.get(idea.id)?.request.token,
            ideaDescriptionGoal(current, boardTitleRef.current), canWriteRef.current);
          if (!canUseResponse) return current;
          applied = true;
          return updateIdea(current, idea.id, {
            content: parsed.data.description!,
            descriptionGeneration: {
              generatedContent: parsed.data.description!, title: request.title, goal: request.goal,
              model: parsed.data.model, generatedAt: parsed.data.generatedAt,
            },
          });
        });
        applied = committed && applied;
      }
      if (descriptionRequests.current.get(idea.id) !== pending) return;
      descriptionRequests.current.delete(idea.id);
      if (applied && parsed.data.description) {
        const draft = editorDraftRef.current;
        if (draft?.id === idea.id && draft.title.trim() === request.title && !draft.content.trim()) {
          setEditorDraft({ ...draft, content: parsed.data.description });
        }
        clearDescriptionStatus(idea.id);
      } else if (canUseResponse && parsed.data.question) {
        setDescriptionStatuses((current) => ({ ...current, [idea.id]: { kind: "question", autoPlace, goal, message: parsed.data.question! } }));
      } else clearDescriptionStatus(idea.id);
      if (autoPlace) queueOrSettlePlacement(idea.id);
    } catch (error) {
      if (descriptionRequests.current.get(idea.id) !== pending) return;
      descriptionRequests.current.delete(idea.id);
      if (controller.signal.aborted) {
        clearDescriptionStatus(idea.id);
        if (autoPlace) queueOrSettlePlacement(idea.id);
        return;
      }
      if (changedEditorDraft(request)) {
        clearDescriptionStatus(idea.id);
        if (autoPlace) queueOrSettlePlacement(idea.id);
        return;
      }
      const currentBoard = boardRef.current;
      const stillCurrent = canApplyIdeaDescription(currentBoard, request, request.token,
        ideaDescriptionGoal(currentBoard, boardTitleRef.current), canWriteRef.current);
      if (stillCurrent) {
        setDescriptionStatuses((current) => ({ ...current, [idea.id]: {
          kind: "error", autoPlace, goal,
          message: error instanceof Error ? error.message : "The description could not be generated. Try again.",
        } }));
      } else clearDescriptionStatus(idea.id);
      if (autoPlace) queueOrSettlePlacement(idea.id);
    }
  }
  function retryIdeaDescription(ideaId: string) {
    const status = descriptionStatuses[ideaId];
    if (status?.kind !== "error" || !canWriteRef.current) return;
    const currentBoard = boardRef.current;
    const idea = currentBoard.ideas.find((candidate) => candidate.id === ideaId);
    const goal = ideaDescriptionGoal(currentBoard, boardTitleRef.current);
    if (!idea || !isTitleOnlyIdea(idea) || goal !== status.goal) {
      clearDescriptionStatus(ideaId);
      return;
    }
    void requestIdeaDescription(idea, goal, status.autoPlace);
  }

  function selectMergeNote(id: string, additive: boolean) {
    setMergeError("");
    if (additive) {
      const selected = mergeIds.filter((candidate) => boardRef.current.ideas.some((idea) => idea.id === candidate));
      if (selected.includes(id)) {
        discardMerge();
        setMergeIds(selected.filter((candidate) => candidate !== id));
        setSelection(null);
        return;
      }
      const first = selected.length === 0 && selection?.kind === "idea" && selection.id !== id ? [selection.id] : selected;
      if (first.length >= MAX_MERGE_SOURCES) {
        setMergeError(`You can merge up to ${MAX_MERGE_SOURCES} notes at a time.`);
        return;
      }
      discardMerge();
      setMergeIds([...first, id]);
      setSelection(null);
      return;
    }
    if (mergePreview || mergeBusy) discardMerge();
    setMergeIds([]);
    setSelection({ kind: "idea", id });
  }

  function discardMerge() {
    mergeRequestSequence.current += 1;
    mergeController.current?.abort();
    mergeController.current = null;
    setMergeBusy(false); setMergePreview(null); setMergeEditMode(false); setMergeError("");
  }

  function moveMergeSource(id: string, offset: -1 | 1) {
    const index = mergeIds.indexOf(id);
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= mergeIds.length) return;
    const reordered = [...mergeIds];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    discardMerge();
    setMergeIds(reordered);
  }

  async function generateMerge() {
    const ids = mergePreview?.ids ?? (mergeIds.length >= 2 ? mergeIds : null);
    if (mergeBusy || !ids) return;
    const context = mergeContext(boardRef.current, ids);
    const totalCharacters = context?.sources.reduce((total, idea) => total + mergeText(idea).length, 0) ?? 0;
    if (!context?.goal || context.sources.some((idea) => !mergeText(idea) || mergeText(idea).length > 4000) || totalCharacters > MAX_MERGE_TOTAL_CHARACTERS) {
      setMergeError(`Set a board goal and choose notes with text under 4,000 characters each and ${MAX_MERGE_TOTAL_CHARACTERS.toLocaleString()} total.`); return;
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
          relationships: context.relationships }),
      });
      const payload: unknown = await response.json();
      if (sequence !== mergeRequestSequence.current) return;
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string" ? payload.error : "The AI could not merge these ideas.");
      if (!payload || typeof payload !== "object" || !("result" in payload) || !("model" in payload) || !("generatedAt" in payload)) throw new Error("The AI returned an incomplete proposal.");
      const parsed = mergeProposalSchema.safeParse(payload.result);
      if (!parsed.success || typeof payload.model !== "string" || typeof payload.generatedAt !== "string") throw new Error("The AI returned an incomplete proposal.");
      if (mergeCoverageProblem(parsed.data, ids)) throw new Error("The AI did not account for every selected note.");
      if (mergeContext(boardRef.current, ids)?.fingerprint !== context.fingerprint) {
        setMergeError("The source notes or goal changed. Merge again to use the latest text."); return;
      }
      setMergeEditMode(false);
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
    const record = mergeRecordFor(context, mergePreview.result, mergePreview.model, mergePreview.generatedAt);
    const apply = (current: Board) => {
      if (mergeContext(current, mergePreview.ids)?.fingerprint !== mergePreview.fingerprint) return current;
      const merged = addMergedIdea(current, id, title, concept, record, authorName || "Unknown contributor");
      return normalizeBoardLayout(merged, measuredSizes, current.ideas.map((idea) => idea.id));
    };
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
    window.requestAnimationFrame(() => { void flow.current?.fitView({ nodes: [{ id }], padding: 0.32, duration: 350, maxZoom: 0.9 }); });
  }

  function previewAssistantAction(draft: AssistantActionDraft) {
    setAssistantPreview(draft);
    const sourceIds = draft.action.kind === "create" ? [...new Set(draft.action.basedOn)]
      : draft.action.kind === "edit" ? [draft.action.card]
        : draft.action.kind === "link" ? [draft.source, draft.target] : [draft.action.a, draft.action.b];
    const focusIds = draft.action.kind === "create" ? [...sourceIds, `assistant-preview-${draft.key}`] : sourceIds;
    window.requestAnimationFrame(() => {
      const nodes = focusIds.filter((id) => id.startsWith("assistant-preview-") || boardRef.current.ideas.some((idea) => idea.id === id))
        .map((id) => ({ id }));
      if (nodes.length) void flow.current?.fitView({ nodes, padding: 0.32, duration: 350, maxZoom: 0.9 });
    });
  }

  function updateAssistantPreview(draft: AssistantActionDraft) {
    setAssistantPreview((current) => current?.key === draft.key ? draft : current);
  }

  function discardAssistantPreview(key: string) {
    setAssistantPreview((current) => current?.key === key ? null : current);
  }

  function acceptAssistantAction(draft: AssistantActionDraft): { ok: boolean; error?: string } {
    if (!assistantActionIsCurrent(boardRef.current, draft)) {
      return { ok: false, error: "A source card changed or was deleted. Ask the assistant again." };
    }
    if (draft.action.kind === "merge") {
      const ids: [string, string] = [draft.action.a, draft.action.b];
      if (!mergeContext(boardRef.current, ids)) return { ok: false, error: "Those cards are no longer available for merging." };
      setAssistantPreview(null);
      setSelection(null);
      setMergeError("");
      setMergeIds(ids);
      setDrawTool(null); setTool("merge");
      return { ok: true };
    }
    if (draft.action.kind === "edit" && (editingLocks[draft.action.card] || editingId === draft.action.card)) {
      return { ok: false, error: editingLocks[draft.action.card]
        ? `${editingLocks[draft.action.card]} is editing this idea.`
        : "Close your editor before accepting an assistant edit." };
    }

    let selectedId: string | null = null;
    let selectedKind: "idea" | "relationship" = "idea";
    let appliedBoard: Board | null = null;
    const id = createIdeaId();
    const committed = commitBoardChange((current) => {
      if (!assistantActionIsCurrent(current, draft)) return current;
      let next = current;
      if (draft.action.kind === "create") {
        if (!draft.title.trim() || draft.title.trim().length > 120 || draft.title.trim().length + draft.content.trim().length > 4000) return current;
        next = acceptAssistantCreate(current, draft, id, authorName || "Unknown contributor");
        selectedId = id;
        selectedKind = "idea";
      } else if (draft.action.kind === "edit") {
        if (editingLocks[draft.action.card] || editingId === draft.action.card) return current;
        if (!draft.title.trim() || draft.title.trim().length > 120 || draft.title.trim().length + draft.content.trim().length > 4000) return current;
        next = updateIdea(current, draft.action.card, { title: draft.title.trim(), content: draft.content.trim() });
        selectedId = draft.action.card;
        selectedKind = "idea";
      } else {
        if (!draft.explanation.trim() || draft.type === "conflict" && !draft.condition.trim()) return current;
        const relationship: Relationship = {
          id,
          source: draft.source,
          target: draft.target,
          type: draft.type,
          explanation: draft.explanation.trim(),
          author: authorName || "Unknown contributor",
          ...(draft.type === "conflict" ? { condition: draft.condition.trim() } : {}),
        };
        next = createRelationship(current, relationship);
        selectedId = id;
        selectedKind = "relationship";
      }
      if (next !== current) appliedBoard = next;
      return next;
    });
    if (!committed || !appliedBoard || !selectedId) {
      if (draft.action.kind === "create" && (!draft.title.trim() || draft.title.trim().length > 120 || draft.title.trim().length + draft.content.trim().length > 4000)) {
        return { ok: false, error: "Give the idea a title up to 120 characters and keep its title and content under 4,000 characters." };
      }
      if (draft.action.kind === "edit" && (!draft.title.trim() || draft.title.trim().length > 120 || draft.title.trim().length + draft.content.trim().length > 4000)) {
        return { ok: false, error: "Give the idea a title up to 120 characters and keep its title and content under 4,000 characters." };
      }
      if (draft.action.kind === "link" && (!draft.explanation.trim() || draft.type === "conflict" && !draft.condition.trim())) {
        return { ok: false, error: draft.type === "conflict" ? "Add an explanation and the condition for this conflict." : "Add an explanation for this relationship." };
      }
      return { ok: false, error: "The action is stale or a matching link already exists." };
    }

    setAssistantPreview(null);
    setSelection({ kind: selectedKind, id: selectedId });
    if (draft.action.kind === "create") {
      setPhysicsEnabled(false);
      physics.stop();
      setUndoPositions(null);
      setAssignmentUndo(null);
    }
    window.requestAnimationFrame(() => { void flow.current?.fitView({ nodes: [{ id: selectedId! }], padding: 0.4, duration: 350, maxZoom: 0.9 }); });
    return { ok: true };
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
    const snapshot = boardRef.current.clusterSnapshot;
    if (!snapshot || !snapshot.result.groups.some((group) => group.id === editingGroupName.id)) {
      setEditingGroupName(null);
      setClusterError("This group is no longer available. Organize the canvas again.");
      return;
    }
    if (manualNameRevision.current !== snapshot.revision) {
      manualNameRevision.current = snapshot.revision;
      manuallyNamedGroups.current.clear();
    }
    manuallyNamedGroups.current.add(editingGroupName.id);
    commitBoardChange((current) => {
      const latestSnapshot = current.clusterSnapshot;
      return latestSnapshot && latestSnapshot.revision === snapshot.revision && latestSnapshot.result.groups.some((group) => group.id === editingGroupName.id)
        ? { ...current, clusterSnapshot: renameClusterGroup(latestSnapshot, editingGroupName.id, label) } : current;
    });
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
      const applyNames = (latest: Board) => {
        const latestSnapshot = latest.clusterSnapshot;
        if (!latestSnapshot || latestSnapshot.stale || latestSnapshot.revision !== snapshot.revision ||
          memberFingerprint(latest.ideas, latestSnapshot) !== sourceFingerprint) return latest;
        let namedSnapshot = latestSnapshot;
        const manualIds = manualNameRevision.current === snapshot.revision ? manuallyNamedGroups.current : new Set<string>();
        for (const item of parsed.data.names) {
          if (item.suggestedName && !manualIds.has(item.groupId) && namedSnapshot.result.groups.some((group) => group.id === item.groupId)) {
            namedSnapshot = renameClusterGroup(namedSnapshot, item.groupId, item.suggestedName);
          }
        }
        return namedSnapshot === latestSnapshot ? latest : { ...latest, clusterSnapshot: namedSnapshot };
      };
      if (onBackgroundBoardChange ?? onBoardChange) (onBackgroundBoardChange ?? onBoardChange)!(applyNames);
      else {
        const namedBoard = applyNames(boardRef.current);
        if (namedBoard !== boardRef.current) { boardRef.current = namedBoard; setLocalBoard(namedBoard); }
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
      const measured = measuredSizes;
      const adjacency = [
        ...latestBoard.relationships.map((link) => [link.source, link.target] as [string, string]),
        ...latestBoard.ideas.flatMap((idea) => idea.merge?.sources.map((source) => [source.id, idea.id] as [string, string]) ?? []),
      ];
      const layout = layoutClusters(latestBoard.ideas, parsed.data, measured, adjacency);
      const proposedIdeas = latestBoard.ideas.map((idea) => {
        const position = layout.positions.get(idea.id);
        return position && !idea.pinned ? { ...idea, position } : idea;
      });
      const resolvedLayoutBoard = normalizeBoardLayout({ ...latestBoard, ideas: proposedIdeas }, measured);
      const resolvedPositions = new Map(resolvedLayoutBoard.ideas.map((idea) => [idea.id, idea.position]));
      const bubbles = layout.bubbles.map((bubble) => {
        const group = parsed.data.groups.find((candidate) => candidate.id === bubble.clusterId);
        const rectangles = (group?.noteIds ?? []).flatMap((id) => {
          const idea = resolvedLayoutBoard.ideas.find((candidate) => candidate.id === id);
          if (!idea) return [];
          const size = measured[id] ?? ideaCardSize(idea, clusterLabels.get(id));
          return [{ left: idea.position.x, top: idea.position.y, right: idea.position.x + size.width, bottom: idea.position.y + size.height }];
        });
        if (!rectangles.length) return bubble;
        const padding = 54;
        const left = Math.min(...rectangles.map((rect) => rect.left)) - padding;
        const top = Math.min(...rectangles.map((rect) => rect.top)) - padding;
        const right = Math.max(...rectangles.map((rect) => rect.right)) + padding;
        const bottom = Math.max(...rectangles.map((rect) => rect.bottom)) + padding;
        return { ...bubble, x: left, y: top, width: right - left, height: bottom - top,
          centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
      });
      const nextSnapshot = { revision: crypto.randomUUID(), stale: false, result: parsed.data, bubbles };
      const previousPositions = new Map(latestBoard.ideas.map((idea) => [idea.id, { ...idea.position }]));
      const updatePositions = (currentBoard: Board): Board => {
        if (boardFingerprint(currentBoard.ideas) !== submittedFingerprint) return currentBoard;
        return { ...currentBoard, ideas: currentBoard.ideas.map((idea) => {
          const position = resolvedPositions.get(idea.id);
          return position ? { ...idea, position } : idea;
        }), clusterSnapshot: nextSnapshot };
      };
      let committedBoard = updatePositions(latestBoard);
      setUndoAfterFingerprint(positionFingerprint(updatePositions(latestBoard).ideas));
      setUndoSnapshot(latestBoard.clusterSnapshot ?? null);
      physics.stop();
      physics.syncPositions(resolvedPositions);
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
      setClusterNotice(`${parsed.data.noteCount} notes organized into ${parsed.data.clusterCount} groups.`);
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
      const measured = measuredSizes;
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
      if (onBackgroundBoardChange ?? onBoardChange) (onBackgroundBoardChange ?? onBoardChange)!(commit);
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
    const restoreLayout = (current: Board) => normalizeBoardLayout(restore(current), measuredSizes);
    const restored = restoreLayout(boardRef.current);
    boardRef.current = restored;
    physics.stop();
    physics.syncPositions(new Map(restored.ideas.map((idea) => [idea.id, idea.position])));
    if (onBoardChange) onBoardChange(restoreLayout);
    else setLocalBoard(restored);
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
    const restoreLayout = (current: Board) => normalizeBoardLayout(restore(current), measuredSizes);
    const restored = restoreLayout(latest);
    boardRef.current = restored;
    physics.syncPositions(new Map(restored.ideas.map((idea) => [idea.id, idea.position])));
    if (onBoardChange) onBoardChange(restoreLayout);
    else setLocalBoard(restored);
    setAssignmentUndo(null);
    setClusterNotice("The new note returned to its previous position.");
  }

  function finishDrag(id: string, position: Idea["position"]) {
    const active = activeDragRef.current;
    if (!active || active.id !== id) return;
    activeDragRef.current = null;
    setActiveDragId(null);
    dragPositionsRef.current.delete(id);
    setDragPositions((current) => { const next = { ...current }; delete next[id]; return next; });
    const pinned = Boolean(boardRef.current.ideas.find((idea) => idea.id === id)?.pinned);
    const resolved = commitBoardChange((current) => normalizeBoardLayout(moveIdea(current, id, position), measuredSizes, [id]));
    if (resolved) {
      const latest = boardRef.current;
      physics.syncPositions(new Map(latest.ideas.map((idea) => [idea.id, idea.position])));
      physics.dragStop(id, position, pinned);
      setUndoPositions(null);
      setAssignmentUndo(null);
    }
  }
  useEffect(() => { finishDragRef.current = finishDrag; });
  useEffect(() => {
    const finishActiveDrag = () => {
      const active = activeDragRef.current;
      if (active) finishDragRef.current(active.id, active.position);
    };
    window.addEventListener("pointerup", finishActiveDrag);
    window.addEventListener("pointercancel", finishActiveDrag);
    return () => {
      window.removeEventListener("pointerup", finishActiveDrag);
      window.removeEventListener("pointercancel", finishActiveDrag);
      finishActiveDrag();
    };
  }, []);

  const previewMergeIds = assistantPreview?.action.kind === "merge" ? [assistantPreview.action.a, assistantPreview.action.b] : [];
  const assistantPreviewIdea = useMemo(() => {
    if (assistantPreview?.action.kind !== "create") return null;
    const sourceIds = [...new Set(assistantPreview.action.basedOn)];
    const parents = sourceIds.flatMap((id) => board.ideas.filter((idea) => idea.id === id));
    if (parents.length !== sourceIds.length || parents.length === 0) return null;
    return {
      id: `assistant-preview-${assistantPreview.key}`,
      title: assistantPreview.title,
      content: assistantPreview.content,
      position: relatedIdeaPosition(board, parents),
      pinned: false,
      parentIds: sourceIds,
      author: authorName || "Unknown contributor",
      assistant: {
        sources: assistantPreview.sources,
        generated: { title: assistantPreview.action.title, content: assistantPreview.action.content },
        model: assistantPreview.model,
        generatedAt: assistantPreview.generatedAt,
      },
    } satisfies Idea;
  }, [assistantPreview, board, authorName]);
  const nodes: IdeaNode[] = board.ideas.map((idea) => ({
    ...nodeLayouts[idea.id],
    id: idea.id, type: "idea", position: dragPositions[idea.id] ?? idea.position, selected: selection?.kind === "idea" && selection.id === idea.id || mergeIds.includes(idea.id) || previewMergeIds.includes(idea.id),
    className: chosenLink && (chosenLink.source === idea.id || chosenLink.target === idea.id) ? "is-related" : previewMergeIds.includes(idea.id) ? "is-merge-source" : editingLocks[idea.id] ? "is-locked-for-editing" : undefined,
    draggable: tool !== "connect" && editor?.id !== idea.id,
    data: { idea, editingBy: editingLocks[idea.id], connecting: tool === "connect", source: sourceId === idea.id, editing: editor?.id === idea.id, squash: squashes[idea.id] ?? null,
      mergeIndex: mergeIds.includes(idea.id) ? mergeIds.indexOf(idea.id) + 1 : previewMergeIds.indexOf(idea.id) + 1,
      onMergeDetails: idea.merge ? () => setMergeDetailsId(idea.id) : undefined,
      onAssistantDetails: idea.assistant ? () => setAssistantDetailsId(idea.id) : undefined,
      descriptionStatus: descriptionStatuses[idea.id],
      onRetryDescription: descriptionStatuses[idea.id]?.kind === "error" ? () => retryIdeaDescription(idea.id) : undefined,
      onSelect: (additive) => {
        if (tool === "merge") selectMergeNote(idea.id, true);
        else selectMergeNote(idea.id, additive || mergeIds.length === 1);
      },
      clusterLabel: clusterLabels.get(idea.id), clusterColor: clusterColors.get(idea.id),
      onEdit: () => openEditor(idea), onStartConnection: (event) => startConnectDrag(idea.id, event) },
  }));
  if (assistantPreviewIdea) {
    nodes.push({ id: assistantPreviewIdea.id, type: "assistantPreview", position: assistantPreviewIdea.position, draggable: false, selectable: false, focusable: false,
      className: "is-assistant-preview", data: { idea: assistantPreviewIdea, preview: true, connecting: false, source: false, editing: false, squash: null, mergeIndex: 0,
        onSelect: () => undefined, onEdit: () => undefined, onStartConnection: () => undefined } });
  }
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
  const routedLinks = useMemo(() => {
    type DisplayLink = { id: string; source: string; target: string; label?: string; type?: RelationshipType; provisional: boolean; ancestry: boolean; assistant: boolean };
    const previews = suggestions.enabled ? suggestions.previews.filter((preview) => isCurrentConnection(board, preview)) : [];
    const present = new Set(board.ideas.map((idea) => idea.id));
    const links: DisplayLink[] = [
      ...board.relationships.filter((link) => present.has(link.source) && present.has(link.target)).map((link) => ({ id: link.id, source: link.source, target: link.target, label: relationshipLabels[link.type], type: link.type, provisional: false, ancestry: false, assistant: false })),
      ...previews.map((preview) => ({ id: preview.id, source: preview.sourceId, target: preview.targetId, label: relationshipLabels[preview.type], type: preview.type, provisional: true, ancestry: false, assistant: false })),
      ...board.ideas.flatMap((idea) => [...new Set(idea.parentIds)].filter((parentId) => present.has(parentId)).map((parentId) => ({
        id: `ancestry:${parentId}:${idea.id}`, source: parentId, target: idea.id, provisional: false, ancestry: true, assistant: false,
      }))),
    ];
    if (assistantPreview?.action.kind === "link" && present.has(assistantPreview.source) && present.has(assistantPreview.target)) {
      links.push({ id: `assistant-link-preview:${assistantPreview.key}`, source: assistantPreview.source, target: assistantPreview.target,
        label: `Preview: ${relationshipLabels[assistantPreview.type]}`, type: assistantPreview.type, provisional: true, ancestry: false, assistant: true });
    }
    if (assistantPreviewIdea) {
      links.push(...assistantPreviewIdea.parentIds.map((parentId) => ({
        id: `assistant-ancestry-preview:${assistantPreview!.key}:${parentId}`, source: parentId, target: assistantPreviewIdea.id,
        provisional: true, ancestry: true, assistant: true,
      })));
    }
    const routingIdeas = assistantPreviewIdea ? [...board.ideas, assistantPreviewIdea] : board.ideas;
    const routes = routeCanvasEdges(routingIdeas, links, measuredSizes, clusterLabels);
    return links.flatMap((link) => {
      const route = routes.get(link.id);
      return route ? [{ ...link, route }] : [];
    });
  }, [board, measuredSizes, clusterLabels, suggestions.previews, suggestions.enabled, assistantPreview, assistantPreviewIdea]);
  const edgeFocus = useMemo(() => {
    const nodes = new Set<string>();
    if (hoveredIdeaId) nodes.add(hoveredIdeaId);
    if (selection?.kind === "idea") nodes.add(selection.id);
    for (const id of mergeIds) nodes.add(id);
    if (assistantPreview?.action.kind === "merge") { nodes.add(assistantPreview.action.a); nodes.add(assistantPreview.action.b); }
    const focusedEdgeId = hoveredEdgeId ?? (selection?.kind === "relationship" ? selection.id : null);
    const focusedEdge = focusedEdgeId ? routedLinks.find((link) => link.id === focusedEdgeId) : undefined;
    if (focusedEdge) { nodes.add(focusedEdge.source); nodes.add(focusedEdge.target); }
    return { nodes, active: nodes.size > 0 };
  }, [hoveredIdeaId, hoveredEdgeId, selection, mergeIds, assistantPreview, routedLinks]);
  const edges = useMemo<OrthogonalCanvasEdge[]>(() => routedLinks.flatMap((link, index) => {
      const { route } = link;
      const selected = selection?.kind === "relationship" && selection.id === link.id;
      const selectedNodeId = selection?.kind === "idea" ? selection.id : null;
      const ancestryChildFocused = selectedNodeId === link.target || hoveredIdeaId === link.target;
      if (link.ancestry && !link.assistant && !ancestryChildFocused) return [];
      const related = edgeFocus.nodes.has(link.source) || edgeFocus.nodes.has(link.target);
      const selectedNodeEdge = selectedNodeId === link.source || selectedNodeId === link.target;
      if (onlySelectedNodeEdges && selectedNodeId && !selectedNodeEdge && !link.assistant) return [];
      const stroke = link.assistant ? (theme === "dark" ? "#c09bdd" : "#8c62a8") :
        link.ancestry ? (theme === "dark" ? "#83c7ac" : "#5b9c82") :
          link.type === "conflict" ? (theme === "dark" ? "#e08b7e" : "#b6665b") :
            link.type === "extends" ? (theme === "dark" ? "#86bdd0" : "#46758c") : (theme === "dark" ? "#79c5a6" : "#4b8a79");
      return {
        id: link.id, source: link.source, target: link.target,
        sourceHandle: `source-${route.sourceSide}`, targetHandle: `target-${route.targetSide}`,
        type: "orthogonal" as const, data: { route, directional: link.type === "extends" },
        selectable: !link.ancestry && !link.provisional, focusable: !link.ancestry && !link.provisional,
        selected, interactionWidth: 24, zIndex: index + 1,
        style: { stroke, strokeWidth: edgeFocus.active && related ? 2.5 : link.ancestry ? 2.4 : selected ? 3 : 2,
          strokeDasharray: link.provisional ? "7 5" : undefined,
          opacity: link.assistant ? 1 : edgeFocus.active && !related ? 0.2 : 1 },
      };
    }), [routedLinks, selection, hoveredIdeaId, edgeFocus, onlySelectedNodeEdges, theme]);

  return <main className="board-shell" data-theme={theme}>
    <header className="board-topbar" aria-label="Board controls"><div className="board-brand">
      <Link href="/" className="board-brand-home" aria-label="IdeaForge home" title="IdeaForge home"><span className="board-brand-symbol" aria-hidden="true">✳</span></Link>
      <input aria-label="Board title" value={titleDraft ?? title} maxLength={80} onChange={(event) => setTitleDraft(event.target.value)}
        onBlur={commitTitleDraft} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { suppressTitleCommit.current = true; setTitleDraft(null); event.currentTarget.blur(); } }} /></div>
      {titleError && <span className="board-title-save-error" role="alert">{titleError}</span>}
      <details className="board-description-control"><summary aria-label="Board description" title="Board description">
        <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.25" /><path d="M10 9v4M10 6.6v.1" /></svg>
      </summary>
        <div className="board-description-popup"><strong>Board description</strong>
          <p>{boardDescription.trim() || "No description was added for this board."}</p></div>
      </details>
      <div className="board-top-actions">{onBoardChange && <><ActiveMembers /><button className="board-share-button" type="button" onClick={() => void copyBoardLink()}>Share</button></>}
        {historyActions && <div className="board-history-controls" role="group" aria-label="Board history">
          <button type="button" aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={!historyActions.canUndo || !historyActions.canWrite} onClick={historyActions.undo}>Undo</button>
          <button type="button" aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" disabled={!historyActions.canRedo || !historyActions.canWrite} onClick={historyActions.redo}>Redo</button>
        </div>}
        <AccountMenu />
        <button className="board-theme-toggle" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={theme === "dark"} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "◐"}</button></div>
      {shareNotice && <span className="board-share-notice" role="status">{shareNotice}</span>}
    </header>
    <div className="board-workspace">
      <div ref={canvas} className={`board-canvas ${tool === "add" ? "placing" : ""} ${tool === "connect" ? "connecting" : ""} ${tool === "hand" || spaceDown ? "panning" : ""} ${drawTool ? `drawing-${drawTool}` : ""}`}>
        <ReactFlow<IdeaNode, OrthogonalCanvasEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onInit={(instance) => { flow.current = instance; setZoom(instance.getZoom()); }} onMove={(_, viewport) => setZoom(viewport.zoom)}
          onPaneClick={(event) => { if (tool === "add" && flow.current) { const point = flow.current.screenToFlowPosition({ x: event.clientX, y: event.clientY }); makeIdea({ x: point.x - IDEA_CARD_SIZE.width / 2, y: point.y - IDEA_CARD_SIZE.height / 2 }); }
            else { setSelection(null); setMergeIds([]); if (tool === "connect") { setSourceId(null); setLinkDraft(null); setTool("select"); } } }}
          onNodeClick={(event, node) => {
            if (tool === "merge") selectMergeNote(node.id, true);
            else if (tool !== "connect") selectMergeNote(node.id, event.shiftKey || mergeIds.length === 1);
          }}
          onNodeMouseEnter={(_, node) => setHoveredIdeaId(node.id)}
          onNodeMouseLeave={() => setHoveredIdeaId(null)}
          onEdgeClick={(_, edge) => { if (!board.relationships.some((link) => link.id === edge.id)) return; setMergeIds([]); setSelection({ kind: "relationship", id: edge.id }); setDrawTool(null); setTool("select"); }}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          onNodeDragStart={(_, node) => {
            dragRevisions.current.set(node.id, (dragRevisions.current.get(node.id) ?? 0) + 1);
            if (node.id === activeAssignmentId.current) assignmentController.current?.abort();
            const startPosition = boardRef.current.ideas.find((idea) => idea.id === node.id)?.position ?? node.position;
            activeDragRef.current = { id: node.id, position: startPosition };
            setActiveDragId(node.id);
            dragPositionsRef.current.set(node.id, startPosition);
            setDragPositions((current) => ({ ...current, [node.id]: startPosition }));
            physics.dragStart(node.id);
          }}
          onNodeDrag={(_, node) => { physics.drag(node.id, node.position); activeDragRef.current = { id: node.id, position: node.position }; setActiveDragId(node.id); dragPositionsRef.current.set(node.id, node.position); setDragPositions((current) => ({ ...current, [node.id]: node.position })); }}
          onNodeDragStop={(_, node) => finishDrag(node.id, node.position)}
          panOnDrag={!drawTool && (tool === "hand" || spaceDown)} nodesDraggable={!drawTool && tool !== "hand" && !spaceDown && tool !== "connect"}
          nodesConnectable={false} elementsSelectable={!drawTool} elevateEdgesOnSelect={false} zoomOnDoubleClick={false} minZoom={0.15} maxZoom={1.8} defaultViewport={{ x: 185, y: 180, zoom: 0.72 }}>
          <Background variant={BackgroundVariant.Dots} gap={23} size={1.5} color={theme === "dark" ? "#405b52" : "#b6c9bf"} />
          <FreeDrawLayer
            key={`${drawTool ?? "off"}-${canWriteBoard ? "write" : "read"}`}
            strokes={board.drawings ?? []}
            liveStrokes={liveDrawings}
            tool={drawTool}
            enabled={canWriteBoard}
            onStroke={(stroke) => setBoard((current) => ({ ...current, drawings: [...(current.drawings ?? []), stroke] }))}
            onDraft={onDrawingPreviewChange}
            onErase={(ids) => {
              const removed = new Set(ids);
              setBoard((current) => ({ ...current, drawings: (current.drawings ?? []).filter((stroke) => !removed.has(stroke.id)) }));
            }}
          />
        </ReactFlow>
        {connectDrag.preview?.active && <svg className="board-connection-preview" aria-hidden="true">
          <path d={orthogonalPreviewPath({ x: connectDrag.preview.x1, y: connectDrag.preview.y1 }, { x: connectDrag.preview.x2, y: connectDrag.preview.y2 })} />
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
          <ToolButton label="Merge" active={tool === "merge"} title={`Choose 2 to ${MAX_MERGE_SOURCES} ideas to merge`} onClick={() => selectTool("merge")}>⧉</ToolButton>
          <div className="board-tool-rule" />
          <ToolButton label={clusterResult ? "Organize again" : "Organize"} active={organizeOpen} disabled={clusterBusy || assignmentBusy || clusterInput.cards.length < 2 || clusterInput.cards.length > 50 || clusterInput.tooLongCount > 0} title={clusterInput.tooLongCount ? "Shorten note text to 4,000 characters before organizing" : "Group related notes and arrange the canvas"} onClick={openOrganize}>▦</ToolButton>
        </nav>
        <nav className="board-draw-toolbar" aria-label="Free drawing tools">
          <ToolButton label="Pencil" active={drawTool === "pencil"} disabled={!canWriteBoard} onClick={() => selectDrawTool("pencil")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.9 4.4 4.4-.9L19.8 7.7a2.1 2.1 0 0 0-3-3L4 16.5Z" /><path d="m14.8 6.7 3 3" /></svg>
          </ToolButton>
          <ToolButton label="Eraser" active={drawTool === "eraser"} disabled={!canWriteBoard} onClick={() => selectDrawTool("eraser")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 14.3 8.8-9.1a2 2 0 0 1 2.9 0l5.2 5.2a2 2 0 0 1 0 2.9l-6.4 6.4H8.7l-5.2-5.2a1.5 1.5 0 0 1 0-2.2Z" /><path d="m8.4 9.2 6.5 6.5M14 19.7h6.5" /></svg>
          </ToolButton>
        </nav>
        </div>
        {organizeOpen && <section className="board-organize-panel" aria-label="Organize notes">
          <div className="board-organize-head"><h2>Organize notes</h2><button type="button" className="board-icon-button" aria-label="Close organize panel" onClick={() => setOrganizeOpen(false)}>×</button></div>
          <label className="board-organize-count">Groups<select value={Math.min(clusterCount, Math.max(2, Math.min(10, clusterInput.cards.length)))} onChange={(event) => setClusterCount(Number(event.target.value))} disabled={clusterBusy || clusterInput.cards.length < 2}>
            {Array.from({ length: Math.max(0, Math.min(10, clusterInput.cards.length) - 1) }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} groups</option>)}
          </select></label>
          <div className="board-organize-count-note"><span>{clusterInput.cards.length} notes</span>{clusterInput.emptyCount > 0 && <span>{clusterInput.emptyCount} empty skipped</span>}</div>
          {clusterInput.cards.length > 50 && <p className="board-error" role="alert">Organize supports up to 50 notes at a time.</p>}
          {clusterInput.tooLongCount > 0 && <p className="board-error" role="alert">{clusterInput.tooLongCount} note(s) exceed the 4,000 character limit. Shorten them before organizing.</p>}
          {clusterError && <p className="board-error" role="alert">{clusterError}</p>}
          {clusterStale && <p className="board-organize-stale" role="status">Notes changed. Organize again to update groups.</p>}
          {clusterBusy && <p className="board-organize-progress" role="status">Organizing…</p>}
          {assignmentBusy && <p className="board-organize-progress" role="status">Finding a group for the new note…</p>}
          {clusterNamesState === "pending" && <p className="board-organize-progress" role="status">Naming groups…</p>}
          {clusterNamesState === "error" && <div className="board-cluster-names-error" role="status"><span>Names unavailable. {clusterNamesError}</span><button type="button" onClick={retryClusterNames} disabled={clusterStale || assignmentBusy}>Retry names</button></div>}
          {clusterResult && <div className="board-organize-results" aria-label="Group results">
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
            </div>)}
          </div>}
          <div className="board-organize-actions"><button type="button" className="primary" onClick={() => void organizeBoard()} disabled={clusterBusy || assignmentBusy || clusterInput.cards.length < 2 || clusterInput.cards.length > 50 || clusterInput.tooLongCount > 0}>{clusterBusy ? "Organizing…" : "Organize canvas"}</button></div>
          {!onBoardChange && undoPositions && !clusterStale && undoAfterFingerprint === positionFingerprint(board.ideas) && <button type="button" className="board-organize-undo" onClick={undoOrganize}>Undo layout</button>}
        </section>}
        {lockNotice && <aside className="board-layout-status" role="status"><span>{lockNotice}</span><button type="button" onClick={() => setLockNotice("")}>Dismiss</button></aside>}
        {!organizeOpen && (clusterNotice || clusterError || assignmentBusy || clusterNamesState === "pending" || clusterNamesState === "error") && <aside className="board-layout-status" role={clusterError ? "alert" : "status"}>
          <span>{assignmentBusy ? "Finding a group for the new note…" : clusterNamesState === "pending" ? "Naming groups with AI…" : clusterNamesState === "error" ? `Group names unavailable. ${clusterNamesError}` : clusterError || clusterNotice}</span>
          {clusterNamesState === "error" && <button type="button" onClick={() => setOrganizeOpen(true)}>Review names</button>}
          {assignmentRetryId && !assignmentBusy && <button type="button" onClick={() => {
            const current = boardRef.current;
            const idea = current.ideas.find((item) => item.id === assignmentRetryId);
            if (idea) void assignNewNote(current, idea);
          }}>Retry placement</button>}
          {!onBoardChange && undoPlacementAvailable && <button type="button" onClick={undoAutomaticPlacement}>Undo placement</button>}
        </aside>}
        {board.ideas.length === 0 && <div className="board-empty"><span>✳</span><h2>Your board is ready</h2><p>Start with one thought. You can connect it to others as your map grows.</p><button onClick={addAtCenter}>＋ Add your first idea</button></div>}
        {(mergeIds.length > 0 || tool === "merge") && mergeIds.every((id) => board.ideas.some((idea) => idea.id === id)) && !mergePreview && <div className="board-merge-tray" role="region" aria-label="Merge selected ideas">
          <div className="board-merge-tray-copy"><strong>{mergeIds.length < 2 ? mergeIds.length === 0 ? "Choose ideas to merge" : "Choose one more idea" : `${mergeIds.length} ideas selected`}</strong>
            <span>Choose 2–{MAX_MERGE_SOURCES} ideas</span>
            <div className="board-merge-chips" aria-label="Selected source ideas">{mergeIds.map((id, index) => <span className="board-merge-chip" key={id}>
              <span>{index + 1}. {board.ideas.find((idea) => idea.id === id)?.title || "Idea"}</span>
              <button type="button" aria-label={`Move ${board.ideas.find((idea) => idea.id === id)?.title || "idea"} earlier`} disabled={index === 0} onClick={() => moveMergeSource(id, -1)}>↑</button>
              <button type="button" aria-label={`Move ${board.ideas.find((idea) => idea.id === id)?.title || "idea"} later`} disabled={index === mergeIds.length - 1} onClick={() => moveMergeSource(id, 1)}>↓</button>
              <button type="button" aria-label={`Remove ${board.ideas.find((idea) => idea.id === id)?.title || "idea"} from merge`} onClick={() => selectMergeNote(id, true)}>×</button>
            </span>)}</div>
            {selectedMergeContext?.relationships.length ? <span>Using {selectedMergeContext.relationships.length} relationship{selectedMergeContext.relationships.length === 1 ? "" : "s"} between selected notes.</span> : null}
            {selectedMergeContext?.sources.some((idea) => mergeText(idea).length > 4000) && <span className="board-error">Each note must be at most 4,000 characters.</span>}
            {selectedMergeContext && selectedMergeContext.sources.reduce((total, idea) => total + mergeText(idea).length, 0) > MAX_MERGE_TOTAL_CHARACTERS && <span className="board-error">Combined text exceeds {MAX_MERGE_TOTAL_CHARACTERS.toLocaleString()} characters.</span>}</div>
          {!onBoardChange && mergeIds.length === 1 && undoPlacementAvailable && <button type="button" onClick={undoAutomaticPlacement}>Undo placement</button>}
          {mergeError && <span className="board-error" role="alert">{mergeError}</span>}
          {mergeIds.length === 0 ? <button type="button" onClick={() => selectTool("select")}>Cancel</button> : <button type="button" onClick={() => { discardMerge(); setMergeIds([]); }}>Clear</button>}
          {mergeIds.length >= 2 && <button type="button" className="primary" disabled={mergeBusy || !selectedMergeContext?.goal || selectedMergeContext.sources.some((idea) => !mergeText(idea) || mergeText(idea).length > 4000) || Boolean(selectedMergeContext && selectedMergeContext.sources.reduce((total, idea) => total + mergeText(idea).length, 0) > MAX_MERGE_TOTAL_CHARACTERS)} onClick={() => void generateMerge()}>{mergeBusy ? "Generating…" : `Merge ${mergeIds.length} ideas`}</button>}
        </div>}
        {chosenIdea && <button type="button" className={`board-focus-toggle${onlySelectedNodeEdges ? " is-active" : ""}`} aria-pressed={onlySelectedNodeEdges}
          onClick={() => setOnlySelectedNodeEdges((value) => !value)}>Only this node’s edges</button>}
        {(chosenIdea || chosenLink) && <div className="board-selection-bar">
          {chosenIdea ? <><strong>{chosenIdea.title}</strong><button onClick={() => openEditor(chosenIdea)}>Edit</button><button onClick={() => { setMergeIds((current) => current.includes(chosenIdea.id) ? current : [...current, chosenIdea.id]); setSelection(null); setDrawTool(null); setTool("merge"); }}>Add to merge</button><button onClick={() => { setUndoPositions(null); setBoard((current) => setIdeaPinned(current, chosenIdea.id, !chosenIdea.pinned)); if (chosenIdea.pinned) physics.reheat(); }}>{chosenIdea.pinned ? "Unpin" : "Pin"}</button>{chosenIdea.merge && <button onClick={() => setMergeDetailsId(chosenIdea.id)}>How this idea was made</button>}</>
            : <><strong>{chosenLink && relationshipLabels[chosenLink.type]}</strong>{chosenLink?.explanation && <span title={[chosenLink.explanation, chosenLink.condition].filter(Boolean).join(" When: ")}>{chosenLink.explanation}{chosenLink.condition ? ` When: ${chosenLink.condition}` : ""}</span>}{chosenLink?.author && <small>By {chosenLink.author}</small>}<button onClick={() => chosenLink && openRelationshipEditor(chosenLink)}>Edit link</button></>}
          <button className="danger" onClick={removeSelection}>Delete</button></div>}
        <div className="board-zoom"><button aria-label="Zoom out" title="Zoom out" onClick={() => flow.current?.zoomOut({ duration: 180 })}>−</button><button aria-label="Fit ideas" title="Fit ideas" onClick={() => { void fitBoard(); }}>⤢</button><ZoomReadout zoom={zoom} /><button aria-label="Zoom in" title="Zoom in" onClick={() => flow.current?.zoomIn({ duration: 180 })}>＋</button></div>
      </div>
      <ConnectionSuggestionsPanel board={board} suggestions={suggestions} onBoardChange={setBoard} minimized={chatOpen} authorName={authorName} />
      <ChatSidebar open={chatOpen} onToggle={() => setChatOpen((value) => !value)} board={board} boardTitle={title}
        selectedCardId={selectedCardId} onFocusCard={focusCard} activeActionKey={assistantPreview?.key ?? null}
        onPreviewAction={previewAssistantAction} onUpdatePreviewAction={updateAssistantPreview}
        onAcceptAction={acceptAssistantAction} onDiscardAction={discardAssistantPreview} />
    </div>
    {mergePreview && <div className="board-merge-panel" role="dialog" aria-modal="false" aria-label="Merged idea preview">
      <div className="board-merge-panel-head"><div><span className="board-eyebrow">{mergePreview.result.excluded?.length ? `${mergePreview.result.contributions.length} OF ${mergePreview.ids.length} IDEAS USED` : `${mergePreview.ids.length} SOURCE IDEAS`}</span><h2>Merge preview</h2></div><button type="button" aria-label="Discard merge preview" onClick={discardMerge}>×</button></div>
      <div className="board-merge-preview-content">
        {previewStale && <p className="board-error" role="alert">A source note, its link, or the goal changed. Regenerate before creating this idea.</p>}
        {mergePreview.result.status !== "useful" ? <>
          <MarkdownText className="board-merge-weak" role="status">{textExcerpt(mergePreview.result.reason || "These ideas need a clearer connection before they can be combined.", 180).text}</MarkdownText>
          {mergePreview.result.reason.length > 180 && <details className="board-merge-read-full"><summary>Read the full explanation</summary><MarkdownText>{mergePreview.result.reason}</MarkdownText></details>}
          <p className="board-merge-sources">{mergePreview.ids.map((id, index) => `${index + 1}. ${board.ideas.find((idea) => idea.id === id)?.title || "Deleted idea"}`).join(" · ")}</p>
          {previewContext?.relationships.length ? <details className="board-merge-disclosure"><summary>Review selected links ({previewContext.relationships.length})</summary><div className="board-merge-reasoning">
            {previewContext.relationships.map((relationship, index) => <div className="board-merge-reasoning-item" key={`${relationship.type}-${relationship.sourceId}-${relationship.targetId}-${index}`}><strong>{relationshipLabels[relationship.type]}</strong><p>{board.ideas.find((idea) => idea.id === relationship.sourceId)?.title || "Source"} → {board.ideas.find((idea) => idea.id === relationship.targetId)?.title || "Target"}</p>{relationship.explanation && <MarkdownText>{relationship.explanation}</MarkdownText>}{relationship.condition && <MarkdownText>Condition: {relationship.condition}</MarkdownText>}</div>)}
          </div></details> : null}
        </> : <>
          {mergeEditMode ? <div className="board-merge-edit-fields">
            <label>Title<input value={mergePreview.title} maxLength={120} onChange={(event) => setMergePreview({ ...mergePreview, title: event.target.value })} /></label>
            <label>Concept<textarea value={mergePreview.concept} maxLength={2000} rows={5} onChange={(event) => setMergePreview({ ...mergePreview, concept: event.target.value })} /><span className="board-merge-character-hint">Short concepts are easier to scan. {mergePreview.concept.length}/2,000 characters.</span></label>
          </div> : <section className="board-merge-compact-concept" aria-label="Combined idea">
            <h3>{mergePreview.title}</h3>
            {(() => { const excerpt = textExcerpt(mergePreview.concept); return <>
              <MarkdownText className="board-merge-concept-text">{excerpt.text}</MarkdownText>
              {excerpt.shortened && <details className="board-merge-read-full"><summary>Read full concept</summary><MarkdownText>{mergePreview.concept}</MarkdownText></details>}
            </>; })()}
            {(() => { const experiment = textExcerpt(mergePreview.result.nextExperiment, 160); return <>
              <div className="board-merge-first-test"><strong>Try first</strong><MarkdownText>{experiment.text}</MarkdownText></div>
              {experiment.shortened && <details className="board-merge-read-full"><summary>Read full experiment</summary><MarkdownText>{mergePreview.result.nextExperiment}</MarkdownText></details>}
            </>; })()}
            {previewContext?.relationships.some((relationship) => relationship.type === "conflict") && <p className="board-merge-conflict-notice" role="note">This set includes a conflict. Review its condition under “Why these ideas fit”.</p>}
          </section>}
          {mergePreview.result.excluded?.length ? <section className="board-merge-excluded" aria-label="Notes left out">
            <h3>Left out ({mergePreview.result.excluded.length})</h3>
            {mergePreview.result.excluded.map((item) => <div className="board-merge-reasoning-item" key={item.sourceId}><strong>{board.ideas.find((idea) => idea.id === item.sourceId)?.title || "Deleted idea"}</strong><MarkdownText>{item.reason}</MarkdownText></div>)}
            <p>The new idea links only to the notes it uses.</p>
          </section> : null}
          <details className="board-merge-disclosure">
            <summary>Why these ideas fit</summary>
            <div className="board-merge-reasoning">
              <section className="board-merge-contributions">
                <h3>What each idea adds</h3>
                <ol className="board-merge-contribution-list">{mergePreview.result.contributions.map((item, index) => <li className="board-merge-contribution-card" key={item.sourceId}>
                  <span className="board-merge-contribution-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{board.ideas.find((idea) => idea.id === item.sourceId)?.title || `Idea ${index + 1}`}</strong><MarkdownText>{item.contribution}</MarkdownText></div>
                </li>)}</ol>
              </section>
              <section className="board-merge-bridge">
                <span className="board-merge-section-kicker">THE CONNECTION</span>
                <h3>Why the combination works</h3>
                <MarkdownText>{mergePreview.result.bridge}</MarkdownText>
              </section>
              <section className="board-merge-checks">
                <h3>What needs checking</h3>
                <div className="board-merge-tension"><span className="board-merge-section-kicker">TENSION</span><MarkdownText>{mergePreview.result.tension}</MarkdownText></div>
                {mergePreview.result.assumptions.length > 0 && <div className="board-merge-assumptions">
                  <h4>Assumptions</h4>
                  <ul>{mergePreview.result.assumptions.map((assumption, index) => <li key={`${index}-${assumption}`}><MarkdownText>{assumption}</MarkdownText></li>)}</ul>
                </div>}
              </section>
              <section className="board-merge-experiment">
                <span className="board-merge-section-kicker">TRY THIS FIRST</span>
                <h3>First experiment</h3>
                <MarkdownText>{mergePreview.result.nextExperiment}</MarkdownText>
              </section>
              {previewContext?.relationships.length ? <details className="board-merge-existing-links">
                <summary>Review existing links ({previewContext.relationships.length})</summary>
                <div>{previewContext.relationships.map((relationship, index) => <div className="board-merge-reasoning-item" key={`${relationship.type}-${relationship.sourceId}-${relationship.targetId}-${index}`}><strong>{relationshipLabels[relationship.type]}</strong><p>{board.ideas.find((idea) => idea.id === relationship.sourceId)?.title || "Source"} → {board.ideas.find((idea) => idea.id === relationship.targetId)?.title || "Target"}</p>{relationship.explanation && <MarkdownText>{relationship.explanation}</MarkdownText>}{relationship.condition && <MarkdownText>Condition: {relationship.condition}</MarkdownText>}</div>)}</div>
              </details> : null}
            </div>
          </details>
        </>}
        {mergeError && <p className="board-error" role="alert">{mergeError}</p>}
      </div>
      <div className="board-merge-actions">
        <button type="button" onClick={discardMerge}>Discard</button>
        {mergePreview.result.status === "useful" && <button type="button" onClick={() => setMergeEditMode((value) => !value)}>{mergeEditMode ? "Preview" : "Edit"}</button>}
        <button type="button" disabled={mergeBusy} onClick={() => void generateMerge()}>{mergeBusy ? "Generating…" : "Regenerate"}</button>
        <button type="button" disabled={mergeBusy} onClick={() => { setMergePreview(null); setMergeEditMode(false); setMergeError(""); setDrawTool(null); setTool("merge"); }}>Change sources</button>
        <button type="button" className="primary" disabled={mergeSaving || mergeBusy || previewStale || mergePreview.result.status !== "useful" || !mergePreview.title.trim() || !mergePreview.concept.trim()} onClick={keepMerge}>Create merged idea</button>
      </div>
    </div>}
    {selectedMergeIdea?.merge && <div className="board-merge-details" role="dialog" aria-modal="false" aria-label="How this idea was made"><div className="board-merge-panel-head"><h2>How this idea was made</h2><button type="button" aria-label="Close merge details" onClick={() => setMergeDetailsId(null)}>×</button></div>
      <button type="button" className="board-merge-show-sources" onClick={() => {
        const sourceIds = mergeDisplayData(selectedMergeIdea.merge!).sources.map((source) => source.id).filter((id) => board.ideas.some((idea) => idea.id === id));
        setSelection({ kind: "idea", id: selectedMergeIdea.id });
        window.requestAnimationFrame(() => { void flow.current?.fitView({ nodes: [...sourceIds, selectedMergeIdea.id].map((id) => ({ id })), padding: 0.28, duration: 350, maxZoom: 0.9 }); });
      }}>Show source notes on canvas</button>
      <p className="board-merge-source-count">Combined from {selectedMergeDetails?.sources.length ?? 0} ideas</p>
      <h3 className="board-merge-saved-title">{selectedMergeIdea.title}</h3>
      {(() => { const excerpt = textExcerpt(selectedMergeIdea.content); return <>
        <MarkdownText className="board-merge-saved-concept">{excerpt.text}</MarkdownText>
        {excerpt.shortened && <details className="board-merge-read-full"><summary>Read full concept</summary><MarkdownText>{selectedMergeIdea.content}</MarkdownText></details>}
      </>; })()}
      <details className="board-merge-disclosure"><summary>Original source notes ({selectedMergeDetails?.sources.length ?? 0})</summary>
        {selectedMergeDetails?.sources.map((source, index) => <div className="board-merge-source" key={`${source.id}-${index}`}><strong>Idea {index + 1}: {source.title || "Untitled idea"}</strong><span>By {source.author}</span><MarkdownText>{source.content || "No description"}</MarkdownText></div>)}
      </details>
      <details className="board-merge-disclosure"><summary>Why this idea works</summary><div className="board-merge-reasoning">
        <p><strong>Goal</strong> {selectedMergeIdea.merge.goal}</p>
        {selectedMergeDetails?.contributions.map((item, index) => <div className="board-merge-reasoning-item" key={item.sourceId}><strong>{selectedMergeDetails.sources[index]?.title || `Idea ${index + 1}`} adds</strong><MarkdownText>{item.contribution}</MarkdownText></div>)}
        {selectedMergeDetails?.excluded.map((item) => <div className="board-merge-reasoning-item" key={item.sourceId}><strong>Left out: {board.ideas.find((idea) => idea.id === item.sourceId)?.title || "a deleted idea"}</strong><MarkdownText>{item.reason}</MarkdownText></div>)}
        {selectedMergeDetails?.relationships.map((relationship, index) => <div className="board-merge-reasoning-item" key={`${relationship.type}-${relationship.sourceId}-${relationship.targetId}-${index}`}><strong>{relationshipLabels[relationship.type]}</strong><MarkdownText>{relationship.explanation || "No explanation"}</MarkdownText>{relationship.condition && <MarkdownText>Condition: {relationship.condition}</MarkdownText>}</div>)}
        <div className="board-merge-reasoning-item"><strong>Why the combination works</strong><MarkdownText>{selectedMergeIdea.merge.proposal.bridge}</MarkdownText></div><div className="board-merge-reasoning-item"><strong>What needs checking</strong><MarkdownText>{selectedMergeIdea.merge.proposal.tension}</MarkdownText></div>
        {selectedMergeIdea.merge.proposal.assumptions.length > 0 && <div className="board-merge-reasoning-item"><strong>Assumptions</strong><MarkdownText>{selectedMergeIdea.merge.proposal.assumptions.join("\n\n")}</MarkdownText></div>}
        <div className="board-merge-reasoning-item"><strong>First experiment</strong><MarkdownText>{selectedMergeIdea.merge.proposal.nextExperiment}</MarkdownText></div>
        <small>Generated with {selectedMergeIdea.merge.model} on {new Date(selectedMergeIdea.merge.generatedAt).toLocaleString()}.</small>
      </div></details>
    </div>}
    {selectedAssistantIdea?.assistant && <div className="board-merge-details" role="dialog" aria-modal="false" aria-label="Assistant idea sources"><div className="board-merge-panel-head"><h2>Assistant idea sources</h2><button type="button" aria-label="Close assistant sources" onClick={() => setAssistantDetailsId(null)}>×</button></div>
      <p><strong>Current title</strong> {selectedAssistantIdea.title}</p><div><strong>Current content</strong><MarkdownText>{selectedAssistantIdea.content || "No description"}</MarkdownText></div>
      <p><strong>Generated title</strong> {selectedAssistantIdea.assistant.generated.title}</p><div><strong>Generated content</strong><MarkdownText>{selectedAssistantIdea.assistant.generated.content}</MarkdownText></div>
      {selectedAssistantIdea.assistant.sources.map((source, index) => <div className="board-merge-source" key={`${source.id}-${index}`}><strong>Source {index + 1}: {source.title || "Untitled idea"}</strong><span>By {source.author}</span><MarkdownText>{source.content || "No description"}</MarkdownText></div>)}
      <small>Created by {selectedAssistantIdea.author || "Unknown contributor"} with {selectedAssistantIdea.assistant.model} on {new Date(selectedAssistantIdea.assistant.generatedAt).toLocaleString()}.</small>
    </div>}
    {editor && <div className="board-modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) { closeEditor(); setDraftIdeaId(null); draftIdeaRef.current = null; } }}><form className="board-dialog" onSubmit={saveEdit} aria-label="Edit idea">
      <span className="board-eyebrow">IDEA DETAILS</span><h2>Edit idea</h2><label>Title<input ref={titleInput} value={editor.title} maxLength={120} onChange={(event) => { setEditorDraft({ ...editor, title: event.target.value }); setEditError(""); }} /></label>
      <label>Content<textarea value={editor.content} maxLength={4000} rows={6} onChange={(event) => setEditorDraft({ ...editor, content: event.target.value })} placeholder="What makes this idea useful?" /><span className="board-markdown-hint">Markdown: **bold**, *italic*, lists, and [links](https://example.com).</span></label>
      <button type="button" className="board-markdown-preview-toggle" onClick={() => setEditorPreview((value) => !value)}>{editorPreview ? "Hide preview" : "Preview Markdown"}</button>
      {editorPreview && <MarkdownText className="board-markdown-edit-preview">{editor.content || "Markdown preview will appear here."}</MarkdownText>}
      {draftIdeaId === editor.id && <label className="board-auto-place-toggle"><input type="checkbox" checked={autoPlaceNewNotes} disabled={!clusterSnapshot || clusterStale || assignmentBusy} onChange={(event) => {
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
      {editError && <p className="board-error" role="alert">{editError}</p>}<div className="board-dialog-actions"><button type="button" onClick={() => { closeEditor(); setDraftIdeaId(null); draftIdeaRef.current = null; }}>Cancel</button><button className="primary" type="submit">Save idea</button></div></form></div>}
    {(linkDraft || relationshipEditor) && <div className="board-modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelInteraction(); }}><form className="board-dialog" onSubmit={confirmLink} aria-label={relationshipEditor ? "Edit relationship" : "Choose relationship"}>
      <span className="board-eyebrow">{relationshipEditor ? "EDIT RELATIONSHIP" : "CONNECT IDEAS"}</span><h2>{relationshipEditor ? "Edit relationship" : "How are they related?"}</h2><p className="board-link-direction">{board.ideas.find((idea) => idea.id === (relationshipEditor ?? linkDraft)?.source)?.title} → {board.ideas.find((idea) => idea.id === (relationshipEditor ?? linkDraft)?.target)?.title}</p>
      <label>Relationship<select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)}>{Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {relationshipType === "extends" && <p className="board-direction-note">The first idea extends the second idea. The arrow will point to the second idea.</p>}
      {relationshipType === "conflict" && <label>Conflict condition<textarea rows={2} maxLength={600} value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="When can both ideas not hold?" />{condition.trim() && <MarkdownText className="board-link-markdown-preview">{condition}</MarkdownText>}</label>}
      <label>Explanation<textarea rows={3} maxLength={1000} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Why does this connection matter?" />{explanation.trim() && <MarkdownText className="board-link-markdown-preview">{explanation}</MarkdownText>}</label>
      {linkError && <p className="board-error" role="alert">{linkError}</p>}<div className="board-dialog-actions"><button type="button" onClick={cancelInteraction}>Cancel</button><button className="primary" type="submit">{relationshipEditor ? "Save relationship" : "Create connection"}</button></div></form></div>}
  </main>;
}
