import type { ClusterSnapshot } from "@/lib/cluster-contract";
import type { MergeProposal, MergeResult } from "@/lib/ideas";

export type MergeSourceSnapshot = { id: string; title: string; content: string; author: string };
export type MergeRelationshipSnapshot = {
  type: RelationshipType;
  explanation: string;
  sourceId: string;
  targetId: string;
  condition?: string;
};
export type AssistantSourceSnapshot = MergeSourceSnapshot;
export type AssistantIdeaRecord = {
  sources: AssistantSourceSnapshot[];
  generated: { title: string; content: string };
  model: string;
  generatedAt: string;
};
export type LegacyMergeRecord = {
  version?: 1;
  sources: [MergeSourceSnapshot, MergeSourceSnapshot];
  goal: string;
  relationship?: MergeRelationshipSnapshot;
  proposal: Exclude<MergeResult, MergeProposal>;
  model: string;
  generatedAt: string;
};
export type MergeRecordV2 = {
  version: 2;
  sources: MergeSourceSnapshot[];
  goal: string;
  relationships: MergeRelationshipSnapshot[];
  proposal: MergeProposal;
  model: string;
  generatedAt: string;
};
export type MergeRecord = LegacyMergeRecord | MergeRecordV2;

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
  assistant?: AssistantIdeaRecord;
};

export type RelationshipType = "synergy" | "conflict" | "extends";
export type Relationship = {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  explanation: string;
  condition?: string;
  author?: string;
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
  if (source === target || type === "conflict" && !relationship.condition?.trim() ||
    !board.ideas.some((idea) => idea.id === source) || !board.ideas.some((idea) => idea.id === target)) return board;
  const duplicate = board.relationships.some((link) => link.type === type &&
    (link.source === source && link.target === target || type !== "extends" && link.source === target && link.target === source));
  if (duplicate) return board;
  const saved = { ...relationship };
  if (saved.type !== "conflict") delete saved.condition;
  return { ...board, relationships: [...board.relationships, saved] };
}
export function updateRelationship(board: Board, id: string, patch: Partial<Relationship>): Board {
  const existing = board.relationships.find((link) => link.id === id);
  if (!existing) return board;
  const relationship = { ...existing, ...patch, id };
  if (relationship.source === relationship.target ||
    relationship.type === "conflict" && !relationship.condition?.trim() ||
    !board.ideas.some((idea) => idea.id === relationship.source) || !board.ideas.some((idea) => idea.id === relationship.target)) return board;
  const duplicate = board.relationships.some((link) => link.id !== id && link.type === relationship.type &&
    (link.source === relationship.source && link.target === relationship.target ||
      relationship.type !== "extends" && link.source === relationship.target && link.target === relationship.source));
  if (duplicate) return board;
  if (relationship.type !== "conflict") delete relationship.condition;
  return { ...board, relationships: board.relationships.map((link) => link.id === id ? relationship : link) };
}
export function deleteRelationship(board: Board, id: string): Board {
  return { ...board, relationships: board.relationships.filter((link) => link.id !== id) };
}
