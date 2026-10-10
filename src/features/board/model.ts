import type { ClusterSnapshot } from "@/lib/cluster-contract";
import type { MergeProposal, MergeResult } from "@/lib/ideas";
import type { ConclusionDraft, ConclusionRequest } from "@/lib/conclusion";

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
export type IdeaDescriptionRecord = {
  generatedContent: string;
  title: string;
  goal: string;
  context?: {
    boardTitle: string;
    boardDescription?: string;
    seedContent?: string;
    clusterLabel?: string;
  };
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
  descriptionGeneration?: IdeaDescriptionRecord;
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
// Keep the legacy value so saved downvotes can be ignored without rewriting a room.
export type IdeaVote = { ideaId: string; voterId: string; voterName?: string; value: 1 | -1 };
export type FreeDrawStroke = { id: string; points: { x: number; y: number }[] };
// The request stores the selected notes, clusters, and links as they were when the draft was generated.
export type BoardConclusion = {
  version: 1;
  title: string;
  markdown: string;
  generated: ConclusionDraft;
  request: ConclusionRequest;
  model: string;
  generatedAt: string;
  keptBy: string;
  keptAt: string;
};
export type Board = { goal?: string; ideas: Idea[]; relationships: Relationship[]; votes?: IdeaVote[]; drawings?: FreeDrawStroke[]; dismissedConnections?: ConnectionPair[]; clusterSnapshot?: ClusterSnapshot | null; conclusion?: BoardConclusion | null };

export const IDEA_CARD_SIZE = { width: 272, height: 148 } as const;
export const MERGED_IDEA_CARD_SIZE = { width: 320, height: 184 } as const;

let clusterLabelContext: CanvasRenderingContext2D | null | undefined;

export function clusterLabelsFor(board: Pick<Board, "clusterSnapshot">): Map<string, string> {
  const result = board.clusterSnapshot?.result;
  if (!result) return new Map();
  const labels = new Map(result.groups.map((group) => [group.id, group.label]));
  return new Map(result.assignments.flatMap((assignment) => {
    const label = labels.get(assignment.clusterId);
    return label ? [[assignment.noteId, label] as const] : [];
  }));
}

export function ideaCardSize(idea: Pick<Idea, "merge" | "pinned">, clusterLabel?: string) {
  const base = idea.merge ? MERGED_IDEA_CARD_SIZE : IDEA_CARD_SIZE;
  if (!clusterLabel) return base;
  let labelWidth: number;
  if (typeof document !== "undefined") {
    clusterLabelContext ??= document.createElement("canvas").getContext("2d");
    if (clusterLabelContext) {
      clusterLabelContext.font = "800 9px Arial, Helvetica, sans-serif";
      labelWidth = clusterLabelContext.measureText(clusterLabel).width + Math.max(0, clusterLabel.length - 1) * 0.35;
    } else labelWidth = clusterLabel.length * 5.5;
  } else labelWidth = clusterLabel.length * 5.5;
  return { ...base, width: Math.max(base.width, Math.ceil(labelWidth + (idea.merge ? 76 : 96) + (idea.pinned ? 52 : 0))) };
}

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
    votes: board.votes?.filter((vote) => vote.ideaId !== id),
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
