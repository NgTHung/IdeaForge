import { LiveObject } from "@liveblocks/client";
import type { StarterIdeasResponse } from "@/lib/starter-ideas-contract";
import type { BoardStorage } from "@/lib/liveblocks";
import { createIdeaId } from "./id.ts";
import type { Idea } from "./model.ts";
import { withResolvedNodeOverlaps } from "./node-layout.ts";

export function placeStarterIdeas(existing: Idea[], result: StarterIdeasResponse, batchId: string): Idea[] {
  const newIdeas: Idea[] = result.ideas.map((candidate, index) => ({
    id: createIdeaId(),
    title: candidate.title,
    content: candidate.description,
    position: { x: (index % 3) * 340 - 340, y: Math.floor(index / 3) * 225 - 110 },
    pinned: false,
    parentIds: [],
    author: "IdeaForge AI",
    starterIdea: {
      batchId,
      originalTitle: candidate.title,
      originalContent: candidate.description,
      approach: candidate.approach,
      model: result.model,
      generatedAt: result.generatedAt,
    },
  }));
  const fixedIds = new Set(existing.map((idea) => idea.id));
  return withResolvedNodeOverlaps({ ideas: [...existing, ...newIdeas] }, {}, fixedIds).ideas.slice(existing.length);
}

export function commitStarterIdeas(storage: LiveObject<BoardStorage>, result: StarterIdeasResponse, boardDescription: string): boolean {
  if (storage.get("starterIdeasState")?.get("status") === "completed") return false;
  if (storage.get("title") !== result.title || boardDescription !== result.description) return false;
  const savedIdeas = storage.get("ideas");
  const existing = [...savedIdeas.values()].map((idea) => idea.toJSON() as Idea);
  const created = placeStarterIdeas(existing, result, result.attemptId);
  for (const idea of created) savedIdeas.set(idea.id, new LiveObject(idea));
  storage.set("starterIdeasState", new LiveObject({
    status: "completed", title: result.title, description: result.description,
    noteIds: created.map((idea) => idea.id), generatedAt: result.generatedAt, attemptId: result.attemptId,
  }));
  return true;
}
