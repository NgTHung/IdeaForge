import type { Board, IdeaVote } from "./model";

export function voteKey(ideaId: string, voterId: string) {
  return `${ideaId}:${voterId}`;
}

export function scoreForIdea(votes: IdeaVote[] = [], ideaId: string) {
  return upvotersForIdea(votes, ideaId).length;
}

export function upvotersForIdea(votes: IdeaVote[] = [], ideaId: string) {
  return [...new Map(votes.filter((vote) => vote.ideaId === ideaId && vote.value === 1)
    .map((vote) => [vote.voterId, vote])).values()];
}

export function voterNameFor(vote: IdeaVote) {
  return vote.voterName?.trim() || `Guest ${vote.voterId.slice(0, 4)}`;
}

export function voteByUser(votes: IdeaVote[] = [], ideaId: string, voterId: string) {
  return upvotersForIdea(votes, ideaId).some((vote) => vote.voterId === voterId);
}

export function toggleIdeaUpvote(board: Board, ideaId: string, voterId: string, voterName: string): Board {
  if (!voterId.trim() || !board.ideas.some((idea) => idea.id === ideaId)) return board;
  const votes = board.votes ?? [];
  const current = voteByUser(votes, ideaId, voterId);
  const nextVotes = votes.filter((vote) => vote.ideaId !== ideaId || vote.voterId !== voterId);
  if (!current) nextVotes.push({ ideaId, voterId, voterName: voterName.trim().slice(0, 60) || `Guest ${voterId.slice(0, 4)}`, value: 1 });
  return { ...board, votes: nextVotes };
}
