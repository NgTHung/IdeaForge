import type { SimilarityResult } from "./similarity";
import type { ClusterCard, ClusterResponse } from "./cluster-contract";

type Cluster = { members: ClusterCard[]; key: string };
const compareId = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const pairKey = (left: string, right: string) => compareId(left, right) < 0 ? `${left}\u0000${right}` : `${right}\u0000${left}`;

export function clusterCards(
  cards: ClusterCard[],
  similarity: SimilarityResult,
  clusterCount: number,
): ClusterResponse {
  const scores = new Map(similarity.scores.map(({ sourceId, targetId, score }) => [pairKey(sourceId, targetId), score]));
  const score = (left: string, right: string) => {
    if (left === right) return 1;
    const value = scores.get(pairKey(left, right));
    if (value === undefined) throw new Error(`Missing similarity score for ${left} and ${right}.`);
    return value;
  };
  const orderedCards = [...cards].sort((left, right) => compareId(left.id, right.id));
  const notePairs = orderedCards.flatMap((first, index) => orderedCards.slice(index + 1).map((second) => ({
    sourceId: first.id, targetId: second.id,
    similarity: score(first.id, second.id), distance: 1 - score(first.id, second.id),
  })));
  const meanScore = (left: ClusterCard[], right: ClusterCard[]) => {
    let total = 0;
    for (const first of left) for (const second of right) total += score(first.id, second.id);
    return total / (left.length * right.length);
  };
  const clusters: Cluster[] = [...cards]
    .sort((left, right) => compareId(left.id, right.id))
    .map((card) => ({ members: [card], key: card.id }));

  while (clusters.length > clusterCount) {
    let best: { left: number; right: number; value: number; tie: string } | null = null;
    for (let left = 0; left < clusters.length; left += 1) {
      for (let right = left + 1; right < clusters.length; right += 1) {
        const a = clusters[left];
        const b = clusters[right];
        const value = meanScore(a.members, b.members);
        const tie = `${a.key}\u0001${b.key}`;
        if (!best || value > best.value || value === best.value && compareId(tie, best.tie) < 0) best = { left, right, value, tie };
      }
    }
    if (!best) throw new Error("Could not build the requested groups.");
    const mergedMembers = [...clusters[best.left].members, ...clusters[best.right].members].sort((a, b) => compareId(a.id, b.id));
    const merged = { members: mergedMembers, key: mergedMembers.map((card) => card.id).join("\u0000") };
    clusters.splice(best.right, 1);
    clusters.splice(best.left, 1, merged);
    clusters.sort((a, b) => compareId(a.key, b.key));
  }

  const groups = clusters.map((cluster) => {
    const memberMean = (card: ClusterCard) => cluster.members.length === 1 ? 1 :
      cluster.members.filter((member) => member.id !== card.id).reduce((total, member) => total + score(card.id, member.id), 0) / (cluster.members.length - 1);
    const representative = [...cluster.members].sort((left, right) =>
      memberMean(right) - memberMean(left) || compareId(left.id, right.id),
    )[0];
    let pairTotal = 0;
    let pairCount = 0;
    for (let left = 0; left < cluster.members.length; left += 1) {
      for (let right = left + 1; right < cluster.members.length; right += 1) {
        pairTotal += score(cluster.members[left].id, cluster.members[right].id);
        pairCount += 1;
      }
    }
    return { members: cluster.members, representative, meanPairSimilarity: pairCount ? pairTotal / pairCount : null };
  }).sort((left, right) => compareId(left.representative.id, right.representative.id));
  const groupIds = new Map<string, string>();
  const responseGroups = groups.map((group, index) => {
    const id = `group-${index + 1}`;
    for (const member of group.members) groupIds.set(member.id, id);
    return {
      id, label: `Group ${index + 1}`, noteIds: group.members.map((member) => member.id),
      size: group.members.length, representativeNoteId: group.representative.id,
      meanPairSimilarity: group.meanPairSimilarity,
    };
  });
  const representativeByGroup = new Map(responseGroups.map((group) => [group.id, group.representativeNoteId]));
  const membersByGroup = new Map(responseGroups.map((group) => [group.id, group.noteIds]));
  const groupPairs = responseGroups.flatMap((first, firstIndex) => responseGroups.slice(firstIndex + 1).map((second) => ({
    firstGroupId: first.id,
    secondGroupId: second.id,
    meanCrossSimilarity: meanScore(
      first.noteIds.map((id) => cards.find((card) => card.id === id)!),
      second.noteIds.map((id) => cards.find((card) => card.id === id)!),
    ),
  })));
  const assignments = [...cards].sort((a, b) => compareId(a.id, b.id)).map((card) => {
    const clusterId = groupIds.get(card.id)!;
    const representativeId = representativeByGroup.get(clusterId)!;
    const ownMembers = membersByGroup.get(clusterId)!;
    const otherMembers = responseGroups.filter((group) => group.id !== clusterId).flatMap((group) => group.noteIds.map((noteId) => ({ noteId, clusterId: group.id })));
    const closestMember = ownMembers.filter((id) => id !== card.id).map((noteId) => ({ noteId, similarity: score(card.id, noteId) }))
      .sort((a, b) => b.similarity - a.similarity || compareId(a.noteId, b.noteId))[0] ?? null;
    const closestOutside = otherMembers.map((candidate) => ({ ...candidate, similarity: score(card.id, candidate.noteId) }))
      .sort((a, b) => b.similarity - a.similarity || compareId(a.noteId, b.noteId))[0];
    const similarityToRepresentative = score(card.id, representativeId);
    return {
      noteId: card.id, clusterId, similarityToRepresentative,
      distanceToRepresentative: 1 - similarityToRepresentative,
      closestMember, closestOutside,
    };
  });
  return {
    algorithm: "average_linkage", scoreMethod: similarity.method, embeddingModel: similarity.embeddingModel,
    clusterCount: responseGroups.length, noteCount: cards.length, groups: responseGroups, groupPairs, notePairs, assignments,
  };
}
