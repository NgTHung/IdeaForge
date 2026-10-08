import type { MergeProposal } from "@/lib/ideas";
import { clusterLabelsFor, IDEA_CARD_SIZE, MERGED_IDEA_CARD_SIZE, ideaCardSize, type Board, type Idea, type MergeRecord, type MergeRecordV2, type MergeRelationshipSnapshot } from "./model.ts";

export function mergeText(idea: Idea): string {
  if (idea.title.trim().toLowerCase() === "new idea" && !idea.content.trim()) return "";
  return [idea.title.trim(), idea.content.trim()].filter(Boolean).join("\n\n");
}

export function mergeContext(board: Board, ids: string[]) {
  if (ids.length < 2 || ids.length > 8 || new Set(ids).size !== ids.length) return null;
  const ideaById = new Map(board.ideas.map((idea) => [idea.id, idea]));
  const sources = ids.map((id) => ideaById.get(id));
  if (sources.some((idea) => !idea)) return null;
  const selectedIds = new Set(ids);
  const relationships: MergeRelationshipSnapshot[] = board.relationships
    .filter((link) => selectedIds.has(link.source) && selectedIds.has(link.target))
    .map((link) => ({
      type: link.type,
      explanation: link.explanation,
      sourceId: link.source,
      targetId: link.target,
      ...(link.condition ? { condition: link.condition } : {}),
    }))
    .sort((left, right) => left.type.localeCompare(right.type) || left.sourceId.localeCompare(right.sourceId) ||
      left.targetId.localeCompare(right.targetId) || left.explanation.localeCompare(right.explanation));
  const goal = board.goal === undefined ? "Help students build a consistent study habit." : board.goal.trim();
  const completeSources = sources as Idea[];
  const fingerprint = JSON.stringify({ goal, sources: completeSources.map((source) => ({ id: source.id, title: source.title, content: source.content, author: source.author })), relationships });
  return { sources: completeSources, relationships, goal, fingerprint };
}

function intersects(first: Idea["position"], firstSize: { width: number; height: number }, second: Idea["position"], secondSize: { width: number; height: number }, gap: number): boolean {
  return first.x < second.x + secondSize.width + gap && first.x + firstSize.width + gap > second.x &&
    first.y < second.y + secondSize.height + gap && first.y + firstSize.height + gap > second.y;
}

export function relatedIdeaPosition(board: Board, parents: Idea[], size: { width: number; height: number } = IDEA_CARD_SIZE): Idea["position"] {
  if (parents.length === 0) return { x: 0, y: 0 };
  const minX = Math.min(...parents.map((idea) => idea.position.x));
  const maxX = Math.max(...parents.map((idea) => idea.position.x));
  const midX = (minX + maxX) / 2;
  const clusterLabels = clusterLabelsFor(board);
  const baseY = Math.max(...parents.map((idea) => idea.position.y + ideaCardSize(idea, clusterLabels.get(idea.id)).height)) + 100;
  const offsets = [0, -1, 1, -2, 2, -3, 3];
  for (let row = 0; row < 12; row += 1) {
    for (const offset of offsets) {
      const point = { x: midX + offset * (size.width + 44), y: baseY + row * (size.height + 44) };
      if (board.ideas.every((idea) => !intersects(point, size, idea.position, ideaCardSize(idea, clusterLabels.get(idea.id)), 28))) return point;
    }
  }
  return { x: midX, y: baseY + 12 * (size.height + 44) };
}

export type MergeDisplayData = {
  sources: MergeRecord["sources"];
  contributions: { sourceId: string; contribution: string }[];
  excluded: { sourceId: string; reason: string }[];
  relationships: MergeRelationshipSnapshot[];
};

export function mergeDisplayData(merge: MergeRecord): MergeDisplayData {
  if ("relationships" in merge) {
    const contributions = new Map(merge.proposal.contributions.map((item) => [item.sourceId, item.contribution]));
    return {
      sources: merge.sources,
      contributions: merge.sources.map((source) => ({ sourceId: source.id, contribution: contributions.get(source.id) ?? "Contribution unavailable." })),
      excluded: merge.proposal.excluded ?? [],
      relationships: merge.relationships,
    };
  }
  return {
    sources: merge.sources,
    contributions: merge.sources.map((source, index) => ({
      sourceId: source.id,
      contribution: index === 0 ? merge.proposal.contributionA : merge.proposal.contributionB,
    })),
    excluded: [],
    relationships: merge.relationship ? [merge.relationship] : [],
  };
}

// Only contributing notes become sources; left-out notes stay in the proposal with their reasons.
export function mergeRecordFor(
  context: NonNullable<ReturnType<typeof mergeContext>>,
  proposal: MergeProposal,
  model: string,
  generatedAt: string,
): MergeRecordV2 {
  const contributing = new Set(proposal.contributions.map((item) => item.sourceId));
  return {
    version: 2,
    sources: context.sources.filter((idea) => contributing.has(idea.id))
      .map((idea) => ({ id: idea.id, title: idea.title, content: idea.content, author: idea.author || "Unknown contributor" })),
    goal: context.goal,
    relationships: context.relationships.filter((link) => contributing.has(link.sourceId) && contributing.has(link.targetId)),
    proposal, model, generatedAt,
  };
}

export function addMergedIdea(board: Board, id: string, title: string, content: string, merge: MergeRecordV2, author: string): Board {
  const ids = merge.sources.map((source) => source.id);
  const context = mergeContext(board, ids);
  if (!context || board.ideas.some((idea) => idea.id === id) || merge.proposal.contributions.length !== ids.length ||
    merge.proposal.contributions.some((item) => !ids.includes(item.sourceId)) ||
    new Set(merge.proposal.contributions.map((item) => item.sourceId)).size !== ids.length) return board;
  const idea: Idea = {
    id, title, content, position: relatedIdeaPosition(board, context.sources, MERGED_IDEA_CARD_SIZE), pinned: false,
    parentIds: ids, merge, author,
  };
  return { ...board, ideas: [...board.ideas, idea], clusterSnapshot: board.clusterSnapshot ? { ...board.clusterSnapshot, stale: true } : board.clusterSnapshot };
}
