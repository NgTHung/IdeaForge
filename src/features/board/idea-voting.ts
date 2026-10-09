import type { Board, IdeaVote } from "./model";

export function voteKey(ideaId: string, voterId: string) {
  return `${ideaId}:${voterId}`;
}

export function scoreForIdea(votes: IdeaVote[] = [], ideaId: string) {
  return votes.reduce((score, vote) => vote.ideaId === ideaId ? score + vote.value : score, 0);
}

export function voteByUser(votes: IdeaVote[] = [], ideaId: string, voterId: string) {
  return votes.find((vote) => vote.ideaId === ideaId && vote.voterId === voterId)?.value ?? 0;
}

export function setIdeaVote(board: Board, ideaId: string, voterId: string, value: 1 | -1): Board {
  if (!board.ideas.some((idea) => idea.id === ideaId)) return board;
  const votes = board.votes ?? [];
  const current = voteByUser(votes, ideaId, voterId);
  const nextVotes = votes.filter((vote) => vote.ideaId !== ideaId || vote.voterId !== voterId);
  if (current !== value) nextVotes.push({ ideaId, voterId, value });
  return { ...board, votes: nextVotes };
}
