"use client";

import { LiveMap, LiveObject } from "@liveblocks/client";
import { useCallback, useEffect, useRef } from "react";
import { initialBoard } from "./fixtures";
import { BoardApp } from "./board-app";
import type { Board, ConnectionPair, FreeDrawStroke, Idea, IdeaVote, Relationship } from "./model";
import type { ClusterSnapshot } from "@/lib/cluster-contract";
import { connectionPairKey } from "@/lib/connections";
import { sameValue, updateFields, syncObjectMap } from "./shared-object-map";
import { syncIdeaVotes } from "./shared-votes";
import { cursorColorForMember } from "./cursor-color";
import type { LiveCursor } from "./live-cursors";
import { cursorStyleSchema, styleColor, type CursorStyle } from "./personalization";
import type { BoardMetadata } from "@/lib/board-directory";
import { useSignalQueue } from "./board-social";
import { socialSignalSchema, signalLifetime, type BoardDecoration, type SocialSignal } from "./board-social-contract";
import { createBoardStorage, RoomProvider, useCanRedo, useCanUndo, useHistory, useMutation, useOthers, useRedo, useSelf, useStorage, useUndo, useUpdateMyPresence, useBroadcastEvent, useEventListener } from "@/lib/liveblocks";

const initialTitle = "Student collaboration ideas";

export function SharedBoardRoom({ boardId, metadata }: { boardId: string; metadata?: BoardMetadata | null }) {
  return <RoomProvider key={`ideaforge:${boardId}`} id={`ideaforge:${boardId}`} initialStorage={createBoardStorage(
    metadata?.title ?? initialTitle, initialBoard.ideas, initialBoard.relationships, metadata?.title,
  )}>
    <SharedBoardContent boardId={boardId} metadata={metadata} />
  </RoomProvider>;
}

function SharedBoardContent({ boardId, metadata }: { boardId: string; metadata?: BoardMetadata | null }) {
  const self = useSelf();
  const history = useHistory();
  const undo = useUndo();
  const redo = useRedo();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const canWrite = Boolean(self?.canWrite);
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();
  const broadcast = useBroadcastEvent();
  const { signals, append } = useSignalQueue();
  useEventListener(({ event, user, connectionId }) => {
    const parsed = socialSignalSchema.safeParse(event);
    if (!parsed.success) return;
    append({ ...parsed.data, connectionId, name: user?.info?.name?.trim() || "Guest", expiresAt: Date.now() + signalLifetime(parsed.data) });
  });
  const sendSignal = useCallback((signal: SocialSignal) => {
    const parsed = socialSignalSchema.safeParse(signal);
    if (!parsed.success || !self) return;
    broadcast(parsed.data);
    append({ ...parsed.data, connectionId: self.connectionId, name: self.info?.name?.trim() || "You", expiresAt: Date.now() + signalLifetime(parsed.data) });
  }, [broadcast, append, self]);
  const updateCursorStyle = useCallback((cursorStyle: CursorStyle) => updateMyPresence({ cursorStyle }), [updateMyPresence]);
  const updateDrawingPresence = useCallback((drawing: FreeDrawStroke | null) => updateMyPresence({ drawing }), [updateMyPresence]);
  const cursorUpdateTimer = useRef<number | null>(null);
  const pendingCursor = useRef<{ x: number; y: number } | null>(null);
  const lastCursorUpdate = useRef(0);
  const hasPublishedCursor = useRef(false);
  const updateCursorPresence = useCallback((cursor: { x: number; y: number } | null) => {
    pendingCursor.current = cursor;
    if (!cursor) {
      if (cursorUpdateTimer.current !== null) window.clearTimeout(cursorUpdateTimer.current);
      cursorUpdateTimer.current = null;
      pendingCursor.current = null;
      if (hasPublishedCursor.current) updateMyPresence({ cursor: null });
      hasPublishedCursor.current = false;
      return;
    }
    if (cursorUpdateTimer.current !== null) return;
    const delay = Math.max(0, 50 - (Date.now() - lastCursorUpdate.current));
    cursorUpdateTimer.current = window.setTimeout(() => {
      cursorUpdateTimer.current = null;
      const next = pendingCursor.current;
      if (!next) return;
      updateMyPresence({ cursor: next });
      hasPublishedCursor.current = true;
      lastCursorUpdate.current = Date.now();
    }, delay);
  }, [updateMyPresence]);
  useEffect(() => {
    function clearCursor() { updateCursorPresence(null); }
    function onVisibilityChange() { if (document.visibilityState === "hidden") clearCursor(); }
    window.addEventListener("blur", clearCursor);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", clearCursor);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (cursorUpdateTimer.current !== null) window.clearTimeout(cursorUpdateTimer.current);
      cursorUpdateTimer.current = null;
      pendingCursor.current = null;
    };
  }, [updateCursorPresence]);
  const liveDrawings = others.flatMap((other) => {
    const drawing = other.presence.drawing;
    return drawing ? [{ ...drawing, id: `live-${other.id}` }] : [];
  });
  const liveCursors: LiveCursor[] = others.flatMap((other) => {
    const cursor = other.presence.cursor;
    const style = cursorStyleSchema.safeParse(other.presence.cursorStyle);
    return cursor ? [{ connectionId: other.connectionId, name: other.info?.name?.trim() || "Guest",
      color: style.success && styleColor(style.data.color) || cursorColorForMember(other.id ?? String(other.connectionId)),
      shape: style.success ? style.data.shape : "dot", x: cursor.x, y: cursor.y }] : [];
  });
  const editingLocks = Object.fromEntries(others.flatMap((other) => {
    const ideaId = other.presence.editingIdeaId;
    return ideaId ? [[ideaId, other.info?.name?.trim() || "Another participant"]] : [];
  }));
  const updateEditingIdea = useCallback((editingIdeaId: string | null) => updateMyPresence({ editingIdeaId }), [updateMyPresence]);
  const snapshot = useStorage((root) => ({
    title: root.title,
    goal: root.goal,
    ideas: Object.values(root.ideas),
    relationships: Object.values(root.relationships),
    votes: Object.values(root.votes ?? {}),
    drawings: Object.values(root.drawings ?? {}),
    decorations: Object.values(root.decorations ?? {}),
    dismissedConnections: Object.values(root.dismissedConnections ?? {}),
    clusterSnapshot: root.clusterSnapshot as ClusterSnapshot | undefined,
  }));
  const updateBoard = useMutation(({ storage, self }, update: (board: Board) => Board) => {
    if (!self?.canWrite) return false;
    const ideas = storage.get("ideas");
    const relationships = storage.get("relationships");
    const drawings = storage.get("drawings");
    const decorations = storage.get("decorations");
    const savedClusterSnapshot = storage.get("clusterSnapshot");
    const dismissed = storage.get("dismissedConnections");
    const savedVotes = storage.get("votes");
    const current: Board = {
      decorations: [...decorations?.entries() ?? []].map(([, item]) => item.toJSON() as BoardDecoration),
      goal: storage.get("goal"),
      ideas: [...ideas.entries()].map(([, idea]) => idea.toJSON() as Idea),
      relationships: [...relationships.entries()].map(([, link]) => link.toJSON() as Relationship),
      votes: [...savedVotes?.values() ?? []],
      drawings: [...drawings?.entries() ?? []].map(([, stroke]) => stroke.toJSON() as FreeDrawStroke),
      dismissedConnections: [...dismissed?.values() ?? []],
      clusterSnapshot: savedClusterSnapshot?.toJSON() as ClusterSnapshot | undefined,
    };
    const next = update(current);
    if (next === current) return false;
    let changed = false;
    if (next.goal !== current.goal) {
      if (next.goal === undefined) storage.delete("goal");
      else storage.set("goal", next.goal);
      changed = true;
    }
    changed = syncObjectMap(ideas, next.ideas) || changed;
    changed = syncObjectMap(relationships, next.relationships) || changed;
    let savedDrawings = drawings;
    if (!savedDrawings && next.drawings?.length) {
      savedDrawings = new LiveMap<string, LiveObject<FreeDrawStroke>>();
      storage.set("drawings", savedDrawings);
      changed = true;
    }
    if (savedDrawings) changed = syncObjectMap(savedDrawings, next.drawings ?? []) || changed;
    let savedDecorations = decorations;
    if (!savedDecorations && next.decorations?.length) {
      savedDecorations = new LiveMap<string, LiveObject<BoardDecoration>>();
      storage.set("decorations", savedDecorations);
      changed = true;
    }
    if (savedDecorations) changed = syncObjectMap(savedDecorations, next.decorations ?? []) || changed;

    const nextDismissals = new Map((next.dismissedConnections ?? []).map((pair) => [connectionPairKey(pair.sourceId, pair.targetId), pair]));
    if (dismissed) {
      for (const key of dismissed.keys()) {
        if (!nextDismissals.has(key)) { dismissed.delete(key); changed = true; }
        else nextDismissals.delete(key);
      }
    }
    if (nextDismissals.size) {
      const target = dismissed ?? new LiveMap<string, ConnectionPair>();
      for (const [key, pair] of nextDismissals) { target.set(key, pair); changed = true; }
      if (!dismissed) storage.set("dismissedConnections", target);
    }
    changed = syncIdeaVotes(storage, next.votes ?? []) || changed;
    const nextClusterSnapshot = next.clusterSnapshot ?? null;
    if (!sameValue(nextClusterSnapshot, current.clusterSnapshot ?? null)) {
      const currentClusterSnapshot = storage.get("clusterSnapshot");
      if (nextClusterSnapshot === null) storage.set("clusterSnapshot", null);
      else if (currentClusterSnapshot) updateFields(currentClusterSnapshot, nextClusterSnapshot);
      else storage.set("clusterSnapshot", new LiveObject(nextClusterSnapshot));
      changed = true;
    }
    return changed;
  }, []);
  const updateTitleMutation = useMutation(({ storage }, title: string) => {
    if (storage.get("title") !== title) storage.set("title", title);
  }, []);
  const updateTitle = useCallback(async (title: string) => {
    if (metadata) {
      const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/title`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("The board title could not be saved. Please try again.");
    }
    updateTitleMutation(title);
  }, [boardId, metadata, updateTitleMutation]);
  const changeBoard = useCallback((update: (board: Board) => Board): boolean => updateBoard(update), [updateBoard]);
  const changeBoardWithoutHistory = useCallback((update: (board: Board) => Board): boolean =>
    history.disable(() => updateBoard(update)), [history, updateBoard]);

  if (!snapshot) return <main className="board-connection-state" aria-live="polite">Connecting to shared board…</main>;

  return <BoardApp
    sharedBoard={{ decorations: snapshot.decorations as BoardDecoration[], goal: snapshot.goal, ideas: snapshot.ideas as Idea[], relationships: snapshot.relationships as Relationship[], votes: snapshot.votes as IdeaVote[], drawings: snapshot.drawings as FreeDrawStroke[], dismissedConnections: snapshot.dismissedConnections as ConnectionPair[], clusterSnapshot: snapshot.clusterSnapshot ?? null }}
    sharedTitle={snapshot.title}
    authorName={self?.info?.name?.trim() || "Unknown contributor"}
    voteUserId={self?.id}
    boardScope={boardId}
    connectedMembers={others.map((other) => ({ id: other.id ?? String(other.connectionId), name: other.info?.name?.trim() || "Guest" }))}
    onCursorStyleChange={updateCursorStyle}
    socialSignals={signals}
    onSocialSignal={sendSignal}
    liveCursors={liveCursors}
    onCursorMove={updateCursorPresence}
    boardDescription={metadata?.description ?? ""}
    editingLocks={editingLocks}
    onEditingIdeaChange={updateEditingIdea}
    onBoardChange={changeBoard}
    onBackgroundBoardChange={changeBoardWithoutHistory}
    onTitleChange={updateTitle}
    historyActions={{ undo, redo, canUndo, canRedo, canWrite }}
    liveDrawings={liveDrawings}
    onDrawingPreviewChange={updateDrawingPresence}
  />;
}
