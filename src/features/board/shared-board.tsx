"use client";

import { LiveMap, LiveObject } from "@liveblocks/client";
import { useCallback } from "react";
import { initialBoard } from "./fixtures";
import { BoardApp } from "./board-app";
import type { Board, ConnectionPair, Idea, Relationship } from "./model";
import type { ClusterSnapshot } from "@/lib/cluster-contract";
import { connectionPairKey } from "@/lib/connections";
import { createBoardStorage, RoomProvider, useMutation, useSelf, useStorage } from "@/lib/liveblocks";

const initialTitle = "Student collaboration ideas";

export function SharedBoardRoom({ boardId }: { boardId: string }) {
  return <RoomProvider id={`ideaforge:${boardId}`} initialStorage={createBoardStorage(
    initialTitle, initialBoard.ideas, initialBoard.relationships,
  )}>
    <SharedBoardContent />
  </RoomProvider>;
}

function SharedBoardContent() {
  const self = useSelf();
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
    if (next.goal !== current.goal) storage.set("goal", next.goal || "Help students build a consistent study habit.");
    const nextIdeas = new Map(next.ideas.map((idea) => [idea.id, idea]));
    const nextRelationships = new Map(next.relationships.map((link) => [link.id, link]));

    for (const [id, idea] of ideas.entries()) {
      const updated = nextIdeas.get(id);
      if (!updated) ideas.delete(id);
      else {
        idea.update(updated);
        nextIdeas.delete(id);
      }
    }
    for (const idea of nextIdeas.values()) ideas.set(idea.id, new LiveObject(idea));

    for (const [id, link] of relationships.entries()) {
      const updated = nextRelationships.get(id);
      if (!updated) relationships.delete(id);
      else {
        link.update(updated);
        nextRelationships.delete(id);
      }
    }
    for (const link of nextRelationships.values()) relationships.set(link.id, new LiveObject(link));

    // Dismissals are only added, so a whole-board write from a stale snapshot can't restore a pair another participant dismissed.
    const addedDismissals = (next.dismissedConnections ?? []).filter((pair) => !dismissed?.has(connectionPairKey(pair.sourceId, pair.targetId)));
    if (addedDismissals.length) {
      const target = dismissed ?? new LiveMap<string, ConnectionPair>();
      for (const pair of addedDismissals) target.set(connectionPairKey(pair.sourceId, pair.targetId), pair);
      if (!dismissed) storage.set("dismissedConnections", target);
    }
    if (JSON.stringify(next.clusterSnapshot ?? null) !== JSON.stringify(current.clusterSnapshot ?? null)) {
      storage.set("clusterSnapshot", next.clusterSnapshot ? new LiveObject(next.clusterSnapshot) : null);
    }
    return next !== current;
  }, []);
  const updateTitle = useMutation(({ storage }, title: string) => storage.set("title", title), []);
  const changeBoard = useCallback((update: (board: Board) => Board): boolean => updateBoard(update), [updateBoard]);

  if (!snapshot) return <main className="board-connection-state" aria-live="polite">Connecting to shared board…</main>;

  return <BoardApp
    sharedBoard={{ goal: snapshot.goal, ideas: snapshot.ideas as Idea[], relationships: snapshot.relationships as Relationship[], dismissedConnections: snapshot.dismissedConnections as ConnectionPair[], clusterSnapshot: snapshot.clusterSnapshot ?? null }}
    sharedTitle={snapshot.title}
    authorName={self?.info?.name?.trim() || "Unknown contributor"}
    onBoardChange={changeBoard}
    onTitleChange={updateTitle}
  />;
}
