import { connectionPairKey, type ConnectionResult } from '../../lib/connections.ts';
import { createRelationship, type Board, type ConnectionPair, type Idea, type Relationship } from './model.ts';

export type IdeaSnapshot = Pick<Idea, 'id' | 'title' | 'content'>;
export type ConnectionPreview = ConnectionResult['suggestions'][number] & { id: string; sources: IdeaSnapshot[]; explanationSource?: 'ai' | 'user' };

export function ideaSnapshotsMatch(sources: IdeaSnapshot[], ideas: Idea[]): boolean {
  return sources.every((source) => ideas.some((idea) => idea.id === source.id && idea.title === source.title && idea.content === source.content));
}

export function connectionInputKey(goal: string, ideas: Idea[]): string {
  return JSON.stringify({ goal, cards: ideas.map(({ id, title, content }) => ({ id, title, content })).sort((a, b) => a.id.localeCompare(b.id)) });
}

// Saved links, merge lineage, and dismissed suggestions already record a decision about a pair, so suggestions skip them.
export function excludedConnectionPairs(board: Board): ConnectionPair[] {
  const present = new Map(board.ideas.map((idea) => [idea.id, idea]));
  const pairs = new Map<string, ConnectionPair>();
  const add = (first: string, second: string) => {
    if (first === second || !present.has(first) || !present.has(second)) return;
    const [sourceId, targetId] = [first, second].sort();
    pairs.set(connectionPairKey(sourceId, targetId), { sourceId, targetId });
  };
  for (const link of board.relationships) add(link.source, link.target);
  for (const pair of board.dismissedConnections ?? []) add(pair.sourceId, pair.targetId);
  for (const idea of board.ideas) {
    idea.parentIds.forEach((parent, index) => idea.parentIds.slice(index + 1).forEach((other) => add(parent, other)));
    const seen = new Set<string>();
    const pending = [...idea.parentIds];
    while (pending.length) {
      const ancestor = pending.pop()!;
      if (seen.has(ancestor)) continue;
      seen.add(ancestor);
      add(idea.id, ancestor);
      pending.push(...present.get(ancestor)?.parentIds ?? []);
    }
  }
  return [...pairs.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.targetId.localeCompare(b.targetId));
}

export function isExcludedConnection(board: Board, pair: ConnectionPair): boolean {
  const key = connectionPairKey(pair.sourceId, pair.targetId);
  return excludedConnectionPairs(board).some(({ sourceId, targetId }) => connectionPairKey(sourceId, targetId) === key);
}

export function isCurrentConnection(board: Board, preview: ConnectionPreview): boolean {
  return preview.sources.length === 2 && preview.sourceId !== preview.targetId &&
    preview.sources.some((source) => source.id === preview.sourceId) && preview.sources.some((source) => source.id === preview.targetId) &&
    ideaSnapshotsMatch(preview.sources, board.ideas) && !isExcludedConnection(board, preview);
}

export function dismissConnection(board: Board, pair: ConnectionPair): Board {
  if (pair.sourceId === pair.targetId || isExcludedConnection(board, pair)) return board;
  const [sourceId, targetId] = [pair.sourceId, pair.targetId].sort();
  return { ...board, dismissedConnections: [...board.dismissedConnections ?? [], { sourceId, targetId }] };
}

export function canAcceptConnection(board: Board, preview: ConnectionPreview): boolean {
  return isCurrentConnection(board, preview) &&
    (preview.type !== 'conflict' || Boolean(preview.condition?.trim()));
}

export function acceptConnection(board: Board, preview: ConnectionPreview): Board {
  if (!canAcceptConnection(board, preview)) return board;
  const relationship: Relationship = {
    id: preview.id, source: preview.sourceId, target: preview.targetId, type: preview.type,
    explanation: preview.explanation.trim(),
    ...(preview.type === 'conflict' ? { condition: preview.condition!.trim() } : {}),
  };
  return createRelationship(board, relationship);
}
