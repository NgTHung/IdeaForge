import { connectionPairKey, type ConnectionResult } from '../../lib/connections.ts';
import { createRelationship, type Board, type Idea, type Relationship } from './model.ts';

export type IdeaSnapshot = Pick<Idea, 'id' | 'title' | 'content'>;
export type ConnectionPreview = ConnectionResult['suggestions'][number] & { id: string; sources: IdeaSnapshot[]; explanationSource?: 'gemini' | 'user' };

export function ideaSnapshotsMatch(sources: IdeaSnapshot[], ideas: Idea[]): boolean {
  return sources.every((source) => ideas.some((idea) => idea.id === source.id && idea.title === source.title && idea.content === source.content));
}

export function connectionInputKey(goal: string, ideas: Idea[]): string {
  return JSON.stringify({ goal, cards: ideas.map(({ id, title, content }) => ({ id, title, content })).sort((a, b) => a.id.localeCompare(b.id)) });
}

export function isCurrentConnection(board: Board, preview: ConnectionPreview): boolean {
  return preview.sources.length === 2 && preview.sourceId !== preview.targetId &&
    preview.sources.some((source) => source.id === preview.sourceId) && preview.sources.some((source) => source.id === preview.targetId) &&
    ideaSnapshotsMatch(preview.sources, board.ideas) &&
    !board.relationships.some((link) => connectionPairKey(link.source, link.target) === connectionPairKey(preview.sourceId, preview.targetId));
}

export function canAcceptConnection(board: Board, preview: ConnectionPreview): boolean {
  return isCurrentConnection(board, preview) && Boolean(preview.explanation.trim()) &&
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
