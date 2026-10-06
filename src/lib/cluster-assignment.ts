import type { SimilarityResult } from "./similarity";
import type { ClusterAssignmentRequest, ClusterAssignmentResponse } from "./cluster-contract";

function compareId(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function pairKey(left: string, right: string) {
  return compareId(left, right) < 0 ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

export function assignCardToGroup(
  request: ClusterAssignmentRequest,
  similarity: SimilarityResult,
): ClusterAssignmentResponse {
  const scoreByPair = new Map(similarity.scores.map(({ sourceId, targetId, score }) => [pairKey(sourceId, targetId), score]));
  const score = (left: string, right: string) => {
    if (left === right) return 1;
    const value = scoreByPair.get(pairKey(left, right));
    if (value === undefined) throw new Error(`Missing similarity score for ${left} and ${right}.`);
    return value;
  };
  const orderedCards = [request.newCard, ...request.groups.flatMap((group) => group.cards)].sort((left, right) => compareId(left.id, right.id));
  const notePairs = orderedCards.flatMap((first, index) => orderedCards.slice(index + 1).map((second) => ({
    sourceId: first.id, targetId: second.id,
    similarity: score(first.id, second.id), distance: 1 - score(first.id, second.id),
  })));
  const groups = request.groups.map((group) => {
    const members = group.cards.map((card) => ({ noteId: card.id, similarity: score(request.newCard.id, card.id) }))
      .sort((left, right) => right.similarity - left.similarity || compareId(left.noteId, right.noteId));
    return {
      groupId: group.id,
      meanSimilarity: members.reduce((total, member) => total + member.similarity, 0) / members.length,
      similarityToRepresentative: score(request.newCard.id, group.representativeNoteId),
      closestMember: members[0],
    };
  }).sort((left, right) => right.meanSimilarity - left.meanSimilarity || compareId(left.groupId, right.groupId));
  return {
    revision: request.revision,
    scoreMethod: similarity.method,
    embeddingModel: similarity.embeddingModel,
    newNoteId: request.newCard.id,
    noteCount: orderedCards.length,
    chosenGroupId: groups[0].groupId,
    notePairs,
    groups: [...groups].sort((left, right) => compareId(left.groupId, right.groupId)),
  };
}
