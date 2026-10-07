import { IDEA_CARD_SIZE, type Board, type Idea, type MergeRecord, type MergeRecordV2, type MergeRelationshipSnapshot } from "./model";

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

function intersects(first: Idea["position"], second: Idea["position"], gap: number): boolean {
  return first.x < second.x + IDEA_CARD_SIZE.width + gap && first.x + IDEA_CARD_SIZE.width + gap > second.x &&
    first.y < second.y + IDEA_CARD_SIZE.height + gap && first.y + IDEA_CARD_SIZE.height + gap > second.y;
}

export function relatedIdeaPosition(board: Board, parents: Idea[]): Idea["position"] {
  if (parents.length === 0) return { x: 0, y: 0 };
  const minX = Math.min(...parents.map((idea) => idea.position.x));
  const maxX = Math.max(...parents.map((idea) => idea.position.x));
  const midX = (minX + maxX) / 2;
  const baseY = Math.max(...parents.map((idea) => idea.position.y)) + IDEA_CARD_SIZE.height + 100;
  const offsets = [0, -1, 1, -2, 2, -3, 3];
  for (let row = 0; row < 12; row += 1) {
    for (const offset of offsets) {
      const point = { x: midX + offset * (IDEA_CARD_SIZE.width + 44), y: baseY + row * (IDEA_CARD_SIZE.height + 44) };
      if (board.ideas.every((idea) => !intersects(point, idea.position, 28))) return point;
    }
  }
  return { x: midX, y: baseY + 12 * (IDEA_CARD_SIZE.height + 44) };
}

export type MergeDisplayData = {
  sources: MergeRecord["sources"];
  contributions: { sourceId: string; contribution: string }[];
  relationships: MergeRelationshipSnapshot[];
};

export function mergeDisplayData(merge: MergeRecord): MergeDisplayData {
  if ("relationships" in merge) {
    const contributions = new Map(merge.proposal.contributions.map((item) => [item.sourceId, item.contribution]));
    return { sources: merge.sources, contributions: merge.sources.map((source) => ({ sourceId: source.id, contribution: contributions.get(source.id) ?? "Contribution unavailable." })), relationships: merge.relationships };
  }
  return {
    sources: merge.sources,
    contributions: merge.sources.map((source, index) => ({
      sourceId: source.id,
      contribution: index === 0 ? merge.proposal.contributionA : merge.proposal.contributionB,
    })),
    relationships: merge.relationship ? [merge.relationship] : [],
  };
}

export function addMergedIdea(board: Board, id: string, title: string, content: string, merge: MergeRecordV2, author: string): Board {
  const ids = merge.sources.map((source) => source.id);
  const context = mergeContext(board, ids);
  if (!context || board.ideas.some((idea) => idea.id === id) || merge.proposal.contributions.length !== ids.length ||
    merge.proposal.contributions.some((item) => !ids.includes(item.sourceId)) ||
    new Set(merge.proposal.contributions.map((item) => item.sourceId)).size !== ids.length) return board;
  const idea: Idea = {
    id, title, content, position: relatedIdeaPosition(board, context.sources), pinned: false,
    parentIds: ids, merge, author,
  };
  return { ...board, ideas: [...board.ideas, idea], clusterSnapshot: board.clusterSnapshot ? { ...board.clusterSnapshot, stale: true } : board.clusterSnapshot };
}
