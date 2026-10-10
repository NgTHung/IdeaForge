"use client";

import { LiveMap, LiveObject } from "@liveblocks/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { initialBoard } from "./fixtures";
import { BoardApp } from "./board-app";
import type { Board, BoardConclusion, ConnectionPair, FreeDrawStroke, Idea, IdeaVote, Relationship, StarterIdeasState } from "./model";
import type { ClusterSnapshot } from "@/lib/cluster-contract";
import { connectionPairKey } from "@/lib/connections";
import { sameValue, updateFields, syncObjectMap } from "./shared-object-map";
import { syncIdeaVotes } from "./shared-votes";
import { syncBoardConclusion } from "./shared-conclusion";
import { cursorColorForMember } from "./cursor-color";
import type { LiveCursor } from "./live-cursors";
import { cursorStyleSchema, styleColor, type CursorStyle } from "./personalization";
import type { BoardMetadata } from "@/lib/board-directory";
import { starterIdeasResponseSchema, type StarterIdeasResponse } from "@/lib/starter-ideas-contract";
import { commitStarterIdeas as commitStarterIdeaBatch } from "./starter-ideas";
import { useSignalQueue } from "./board-social";
import { socialSignalSchema, signalLifetime, type BoardDecoration, type SocialSignal } from "./board-social-contract";
import { createBoardStorage, RoomProvider, useCanRedo, useCanUndo, useHistory, useMutation, useOthers, useRedo, useSelf, useStorage, useUndo, useUpdateMyPresence, useBroadcastEvent, useEventListener } from "@/lib/liveblocks";

const initialTitle = "Student collaboration ideas";

export function SharedBoardRoom({ boardId, metadata }: { boardId: string; metadata?: BoardMetadata | null }) {
  return <RoomProvider key={`ideaforge:${boardId}`} id={`ideaforge:${boardId}`} initialStorage={createBoardStorage(
    metadata?.title ?? initialTitle, metadata ? [] : initialBoard.ideas, metadata ? [] : initialBoard.relationships, metadata?.title, metadata?.description,
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
  const [starterBusy, setStarterBusy] = useState(false);
  const [starterError, setStarterError] = useState("");
  const starterAttempted = useRef(false);
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
    description: root.description ?? metadata?.description ?? "",
    goal: root.goal,
    ideas: Object.values(root.ideas),
    relationships: Object.values(root.relationships),
    votes: Object.values(root.votes ?? {}),
    drawings: Object.values(root.drawings ?? {}),
    decorations: Object.values(root.decorations ?? {}),
    dismissedConnections: Object.values(root.dismissedConnections ?? {}),
    clusterSnapshot: root.clusterSnapshot as ClusterSnapshot | undefined,
    conclusion: (root.conclusion ?? null) as BoardConclusion | null,
    starterIdeasState: (root.starterIdeasState ?? null) as StarterIdeasState | null,
  }));
  const commitStarterIdeas = useMutation(({ storage, self }, result: StarterIdeasResponse) => {
    return self?.canWrite ? commitStarterIdeaBatch(storage, result, metadata?.description ?? "") : false;
  }, [metadata?.description]);
  const markStarterIdeasFailed = useMutation(({ storage, self }) => {
    if (!self?.canWrite || storage.get("starterIdeasState")?.get("status") === "completed") return;
    storage.set("starterIdeasState", new LiveObject({
      status: "failed", title: storage.get("title"), description: storage.get("description") ?? metadata?.description ?? "",
    }));
  }, [metadata?.description]);
  const finishStarterAttempt = useCallback(async (attemptId: string, status: "completed" | "failed") => {
    try {
      await fetch(`/api/boards/${encodeURIComponent(boardId)}/starter-ideas`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, status }),
      });
    } catch {
      // The room marker remains authoritative; an expired server lease allows recovery.
    }
  }, [boardId]);
  const requestStarterIdeas = useCallback(async () => {
    if (!metadata?.canGenerateStarterIdeas || starterBusy) return;
    setStarterBusy(true);
    setStarterError("");
    let attemptId: string | undefined;
    try {
      const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/starter-ideas`, {
        method: "POST", credentials: "include",
      });
      const payload: unknown = await response.json();
      if (response.status === 409 && (payload as { code?: string })?.code === "in_progress") {
        setStarterError("Starting ideas are being generated in another tab. Retry after a few minutes if they do not appear.");
        return;
      }
      if (!response.ok) throw new Error((payload as { error?: string })?.error || "Starting ideas could not be generated.");
      const result = starterIdeasResponseSchema.safeParse(payload);
      if (!result.success) throw new Error("The provider returned an invalid set of starting ideas.");
      attemptId = result.data.attemptId;
      if (!history.disable(() => commitStarterIdeas(result.data))) {
        throw new Error("The board changed while ideas were generating. Retry with its current title.");
      }
      void finishStarterAttempt(attemptId, "completed");
    } catch (error) {
      if (attemptId) void finishStarterAttempt(attemptId, "failed");
      history.disable(() => markStarterIdeasFailed());
      setStarterError(error instanceof Error ? error.message : "Starting ideas could not be generated.");
    } finally {
      setStarterBusy(false);
    }
  }, [boardId, commitStarterIdeas, finishStarterAttempt, history, markStarterIdeasFailed, metadata?.canGenerateStarterIdeas, starterBusy]);
  useEffect(() => {
    if (!snapshot || !metadata?.canGenerateStarterIdeas || !canWrite || snapshot.starterIdeasState || starterAttempted.current) return;
    starterAttempted.current = true;
    void requestStarterIdeas();
  }, [canWrite, metadata?.canGenerateStarterIdeas, requestStarterIdeas, snapshot]);
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
      conclusion: (storage.get("conclusion")?.toJSON() ?? null) as BoardConclusion | null,
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
    changed = syncBoardConclusion(storage, next.conclusion ?? null) || changed;
    return changed;
  }, []);
  const updateMetadataMutation = useMutation(({ storage }, next: { title: string; description: string }) => {
    if (storage.get("title") !== next.title) storage.set("title", next.title);
    if (storage.get("description") !== next.description) storage.set("description", next.description);
  }, []);
  const updateMetadata = useCallback(async (next: { title: string; description: string }) => {
    if (metadata) {
      const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/title`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("The board details could not be saved. Please try again.");
    }
    updateMetadataMutation(next);
  }, [boardId, metadata, updateMetadataMutation]);
  const changeBoard = useCallback((update: (board: Board) => Board): boolean => updateBoard(update), [updateBoard]);
  const changeBoardWithoutHistory = useCallback((update: (board: Board) => Board): boolean =>
    history.disable(() => updateBoard(update)), [history, updateBoard]);

  if (!snapshot) return <main className="board-connection-state" aria-live="polite">Connecting to shared board…</main>;

  return <BoardApp
    sharedBoard={{ decorations: snapshot.decorations as BoardDecoration[], goal: snapshot.goal, ideas: snapshot.ideas as Idea[], relationships: snapshot.relationships as Relationship[], votes: snapshot.votes as IdeaVote[], drawings: snapshot.drawings as FreeDrawStroke[], dismissedConnections: snapshot.dismissedConnections as ConnectionPair[], clusterSnapshot: snapshot.clusterSnapshot ?? null, conclusion: snapshot.conclusion }}
    sharedTitle={snapshot.title}
    authorName={self?.info?.name?.trim() || "Unknown contributor"}
    voteUserId={self?.id}
    boardScope={boardId}
    connectedMembers={others.map((other) => ({ id: other.id ?? String(other.connectionId), name: other.info?.name?.trim() || "Guest" }))}
    onCursorStyleChange={updateCursorStyle}
    signalCursorPositions={Object.fromEntries([...(self ? [self] : []), ...others].flatMap((member) => member.presence.cursor ? [[member.connectionId, member.presence.cursor]] : []))}
    socialSignals={signals}
    onSocialSignal={sendSignal}
    liveCursors={liveCursors}
    onCursorMove={updateCursorPresence}
    boardDescription={snapshot.description}
    starterIdeasNotice={metadata?.canGenerateStarterIdeas && snapshot.starterIdeasState?.status !== "completed"
      ? starterBusy ? { kind: "pending" } : snapshot.starterIdeasState?.status === "failed" || starterError
        ? { kind: "error", message: starterError || "Starting ideas could not be generated.", onRetry: () => void requestStarterIdeas() }
        : null : null}
    editingLocks={editingLocks}
    onEditingIdeaChange={updateEditingIdea}
    onBoardChange={changeBoard}
    onBackgroundBoardChange={changeBoardWithoutHistory}
    onMetadataChange={updateMetadata}
    historyActions={{ undo, redo, canUndo, canRedo, canWrite }}
    liveDrawings={liveDrawings}
    onDrawingPreviewChange={updateDrawingPresence}
  />;
}
