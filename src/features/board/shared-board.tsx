"use client";

import { LiveObject } from "@liveblocks/client";
import { useCallback } from "react";
import { initialBoard } from "./fixtures";
import { BoardApp } from "./board-app";
import type { Board, Idea, Relationship } from "./model";
import { createBoardStorage, RoomProvider, useMutation, useStatus, useStorage } from "@/lib/liveblocks";

const initialTitle = "Student collaboration ideas";

export function SharedBoardRoom({ boardId }: { boardId: string }) {
  return <RoomProvider id={`ideaforge:${boardId}`} initialStorage={createBoardStorage(
    initialTitle, initialBoard.ideas, initialBoard.relationships,
  )}>
    <SharedBoardContent />
  </RoomProvider>;
}

function SharedBoardContent() {
  const snapshot = useStorage((root) => ({
    title: root.title,
    ideas: Object.values(root.ideas),
    relationships: Object.values(root.relationships),
  }));
  const status = useStatus();
  const updateBoard = useMutation(({ storage }, update: (board: Board) => Board) => {
    const ideas = storage.get("ideas");
    const relationships = storage.get("relationships");
    const current: Board = {
      ideas: [...ideas.entries()].map(([, idea]) => idea.toJSON() as Idea),
      relationships: [...relationships.entries()].map(([, link]) => link.toJSON() as Relationship),
    };
    const next = update(current);
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
  }, []);
  const updateTitle = useMutation(({ storage }, title: string) => storage.set("title", title), []);
  const changeBoard = useCallback((update: (board: Board) => Board) => updateBoard(update), [updateBoard]);

  if (!snapshot) return <main className="board-connection-state" aria-live="polite">Connecting to shared board…</main>;

  return <BoardApp
    sharedBoard={{ ideas: snapshot.ideas as Idea[], relationships: snapshot.relationships as Relationship[] }}
    sharedTitle={snapshot.title}
    onBoardChange={changeBoard}
    onTitleChange={updateTitle}
    roomStatus={status}
  />;
}
