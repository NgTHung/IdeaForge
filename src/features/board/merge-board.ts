import { IDEA_CARD_SIZE, type Board, type Idea, type MergeRecord } from "./model";

export function mergeText(idea: Idea): string {
  if (idea.title.trim().toLowerCase() === "new idea" && !idea.content.trim()) return "";
  return [idea.title.trim(), idea.content.trim()].filter(Boolean).join("\n\n");
}

export function mergeContext(board: Board, ids: [string, string]) {
  if (ids[0] === ids[1]) return null;
  const first = board.ideas.find((idea) => idea.id === ids[0]);
  const second = board.ideas.find((idea) => idea.id === ids[1]);
  if (!first || !second) return null;
  const sources: [Idea, Idea] = [first, second];
  const relationship = board.relationships.find((link) =>
    link.source === ids[0] && link.target === ids[1] || link.source === ids[1] && link.target === ids[0]);
  const goal = board.goal === undefined ? "Help students build a consistent study habit." : board.goal.trim();
  const fingerprint = JSON.stringify({ goal, sources: sources.map((source) => ({ id: source.id, title: source.title, content: source.content, author: source.author })),
    relationship: relationship ? { id: relationship.id, source: relationship.source, target: relationship.target, type: relationship.type, explanation: relationship.explanation, condition: relationship.condition } : null });
  return { sources, relationship, goal, fingerprint };
}

function intersects(first: Idea["position"], second: Idea["position"], gap: number): boolean {
  return first.x < second.x + IDEA_CARD_SIZE.width + gap && first.x + IDEA_CARD_SIZE.width + gap > second.x &&
    first.y < second.y + IDEA_CARD_SIZE.height + gap && first.y + IDEA_CARD_SIZE.height + gap > second.y;
}

export function relatedIdeaPosition(board: Board, parents: Idea[]): Idea["position"] {
  if (parents.length === 0) return { x: 0, y: 0 };
  const midX = parents.reduce((sum, idea) => sum + idea.position.x, 0) / parents.length;
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

export function mergedIdeaPosition(board: Board, parents: [Idea, Idea]): Idea["position"] {
  return relatedIdeaPosition(board, parents);
}

export function addMergedIdea(board: Board, id: string, title: string, content: string, merge: MergeRecord, author: string): Board {
  const ids: [string, string] = [merge.sources[0].id, merge.sources[1].id];
  const context = mergeContext(board, ids);
  if (!context || board.ideas.some((idea) => idea.id === id)) return board;
  const idea: Idea = {
    id, title, content, position: mergedIdeaPosition(board, context.sources), pinned: false,
    parentIds: ids, merge, author,
  };
  return { ...board, ideas: [...board.ideas, idea], clusterSnapshot: board.clusterSnapshot ? { ...board.clusterSnapshot, stale: true } : board.clusterSnapshot };
}
