import type { ClusterSnapshot } from "@/lib/cluster-contract";
import type { MergeResult } from "@/lib/ideas";

export type MergeSourceSnapshot = { id: string; title: string; content: string; author: string };
export type MergeRecord = {
  sources: [MergeSourceSnapshot, MergeSourceSnapshot];
  goal: string;
  relationship?: { type: RelationshipType; explanation: string; sourceId: string; targetId: string };
  proposal: MergeResult;
  model: string;
  generatedAt: string;
};

export type Idea = {
  id: string;
  title: string;
  content: string;
  position: { x: number; y: number };
  pinned: boolean;
  color?: string;
  parentIds: string[];
  author?: string;
  merge?: MergeRecord;
};

export type RelationshipType = "synergy" | "conflict" | "extends";
export type Relationship = {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  explanation: string;
  condition?: string;
};
export type ConnectionPair = { sourceId: string; targetId: string };
export type Board = { goal?: string; ideas: Idea[]; relationships: Relationship[]; dismissedConnections?: ConnectionPair[]; clusterSnapshot?: ClusterSnapshot | null };

export const IDEA_CARD_SIZE = { width: 272, height: 148 } as const;

export const relationshipLabels: Record<RelationshipType, string> = {
  synergy: "Works well together",
  conflict: "Conflicts with",
  extends: "Extends",
};

export function createIdea(board: Board, idea: Idea): Board {
  return { ...board, ideas: [...board.ideas, idea] };
}
export function updateIdea(board: Board, id: string, patch: Partial<Idea>): Board {
  const changesGroupSource = patch.title !== undefined || patch.content !== undefined || patch.pinned !== undefined;
  const isGrouped = board.clusterSnapshot?.result.groups.some((group) => group.noteIds.includes(id));
  return {
    ...board,
    ...(changesGroupSource && isGrouped && board.clusterSnapshot ? { clusterSnapshot: { ...board.clusterSnapshot, stale: true } } : {}),
    ideas: board.ideas.map((idea) => idea.id === id ? { ...idea, ...patch } : idea),
  };
}
export function deleteIdea(board: Board, id: string): Board {
  const isGrouped = board.clusterSnapshot?.result.groups.some((group) => group.noteIds.includes(id));
  return {
    ...board,
    ...(isGrouped && board.clusterSnapshot ? { clusterSnapshot: { ...board.clusterSnapshot, stale: true } } : {}),
    ideas: board.ideas.filter((idea) => idea.id !== id),
    relationships: board.relationships.filter((link) => link.source !== id && link.target !== id),
  };
}
export function moveIdea(board: Board, id: string, position: Idea["position"]): Board {
  return updateIdea(board, id, { position });
}
export function setIdeaPinned(board: Board, id: string, pinned: boolean): Board {
  return updateIdea(board, id, { pinned });
}
export function createRelationship(board: Board, relationship: Relationship): Board {
  const { source, target, type } = relationship;
  if (source === target || !board.ideas.some((idea) => idea.id === source) || !board.ideas.some((idea) => idea.id === target)) return board;
  const duplicate = board.relationships.some((link) => link.type === type &&
    (link.source === source && link.target === target || type !== "extends" && link.source === target && link.target === source));
  return duplicate ? board : { ...board, relationships: [...board.relationships, relationship] };
}
export function deleteRelationship(board: Board, id: string): Board {
  return { ...board, relationships: board.relationships.filter((link) => link.id !== id) };
}
