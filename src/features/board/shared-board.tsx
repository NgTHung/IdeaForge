"use client";

import { LiveMap, LiveObject, type LsonObject } from "@liveblocks/client";
import { useCallback } from "react";
import { initialBoard } from "./fixtures";
import { BoardApp } from "./board-app";
import type { Board, ConnectionPair, Idea, Relationship } from "./model";
import type { ClusterSnapshot } from "@/lib/cluster-contract";
import { connectionPairKey } from "@/lib/connections";
import type { BoardMetadata } from "@/lib/board-directory";
import { boardApiUrl } from "@/lib/board-api-client";
import { createBoardStorage, RoomProvider, useCanRedo, useCanUndo, useHistory, useMutation, useOthers, useRedo, useSelf, useStorage, useUndo, useUpdateMyPresence } from "@/lib/liveblocks";

const initialTitle = "Student collaboration ideas";

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function updateFields<T extends LsonObject>(target: LiveObject<T>, next: T): boolean {
  const current = target.toJSON() as Record<string, unknown>;
  const updated = next as Record<string, unknown>;
  let changed = false;
  for (const key of new Set([...Object.keys(current), ...Object.keys(updated)])) {
    const before = current[key];
    const after = updated[key];
    if (sameValue(before, after)) continue;
    changed = true;
    if (after === undefined) target.delete(key as keyof T);
    else target.set(key as keyof T, after as T[keyof T]);
  }
  return changed;
}

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
    dismissedConnections: Object.values(root.dismissedConnections ?? {}),
    clusterSnapshot: root.clusterSnapshot as ClusterSnapshot | undefined,
  }));
  const updateBoard = useMutation(({ storage }, update: (board: Board) => Board) => {
    const ideas = storage.get("ideas");
    const relationships = storage.get("relationships");
    const savedClusterSnapshot = storage.get("clusterSnapshot");
    const dismissed = storage.get("dismissedConnections");
    const current: Board = {
      goal: storage.get("goal"),
      ideas: [...ideas.entries()].map(([, idea]) => idea.toJSON() as Idea),
      relationships: [...relationships.entries()].map(([, link]) => link.toJSON() as Relationship),
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
    const nextIdeas = new Map(next.ideas.map((idea) => [idea.id, idea]));
    const nextRelationships = new Map(next.relationships.map((link) => [link.id, link]));

    for (const [id, idea] of ideas.entries()) {
      const updated = nextIdeas.get(id);
      if (!updated) { ideas.delete(id); changed = true; }
      else {
        changed = updateFields(idea, updated) || changed;
        nextIdeas.delete(id);
      }
    }
    for (const idea of nextIdeas.values()) { ideas.set(idea.id, new LiveObject(idea)); changed = true; }

    for (const [id, link] of relationships.entries()) {
      const updated = nextRelationships.get(id);
      if (!updated) { relationships.delete(id); changed = true; }
      else {
        changed = updateFields(link, updated) || changed;
        nextRelationships.delete(id);
      }
    }
    for (const link of nextRelationships.values()) { relationships.set(link.id, new LiveObject(link)); changed = true; }

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
      const response = await fetch(boardApiUrl(`/api/boards/${encodeURIComponent(boardId)}/title`), {
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
    sharedBoard={{ goal: snapshot.goal, ideas: snapshot.ideas as Idea[], relationships: snapshot.relationships as Relationship[], dismissedConnections: snapshot.dismissedConnections as ConnectionPair[], clusterSnapshot: snapshot.clusterSnapshot ?? null }}
    sharedTitle={snapshot.title}
    authorName={self?.info?.name?.trim() || "Unknown contributor"}
    boardDescription={metadata?.description ?? ""}
    editingLocks={editingLocks}
    onEditingIdeaChange={updateEditingIdea}
    onBoardChange={changeBoard}
    onBackgroundBoardChange={changeBoardWithoutHistory}
    onTitleChange={updateTitle}
    historyActions={{ undo, redo, canUndo, canRedo, canWrite }}
  />;
}
