import type { ClusterAssignmentResponse, ClusterSnapshot } from "@/lib/cluster-contract";
import type { Idea } from "./model";
import type { ClusterBubblePosition } from "./cluster-layout";

export function renameClusterGroup(snapshot: ClusterSnapshot, groupId: string, label: string): ClusterSnapshot {
  return {
    ...snapshot,
    result: {
      ...snapshot.result,
      groups: snapshot.result.groups.map((group) => group.id === groupId ? { ...group, label } : group),
    },
    bubbles: snapshot.bubbles.map((bubble) => bubble.clusterId === groupId ? { ...bubble, label } : bubble),
  };
}

export function memberFingerprint(ideas: Idea[], snapshot: ClusterSnapshot): string {
  const ids = snapshot.result.groups.flatMap((group) => group.noteIds).sort();
  return JSON.stringify(ids.map((id) => {
    const idea = ideas.find((candidate) => candidate.id === id);
    return idea ? { id, title: idea.title, content: idea.content, pinned: idea.pinned } : { id, missing: true };
  }));
}

export function appendClusterAssignment(
  snapshot: ClusterSnapshot,
  idea: Idea,
  assignment: ClusterAssignmentResponse,
  bubble: ClusterBubblePosition | null,
  revision: string,
): ClusterSnapshot {
  const pairScores = new Map(assignment.notePairs.map((pair) => [[pair.sourceId, pair.targetId].sort().join("\u0000"), pair.similarity]));
  const score = (first: string, second: string) => first === second ? 1 : pairScores.get([first, second].sort().join("\u0000"))!;
  const average = (first: string[], second: string[]) => first.reduce((total, left) =>
    total + second.reduce((sum, right) => sum + score(left, right), 0), 0) / (first.length * second.length);
  const updatedGroups = snapshot.result.groups.map((group) => {
    if (group.id !== assignment.chosenGroupId) return group;
    return { ...group, noteIds: [...group.noteIds, idea.id].sort(), size: group.size + 1 };
  }).map((group) => {
    const pairs = group.noteIds.flatMap((first, index) => group.noteIds.slice(index + 1).map((second) => score(first, second)));
    return { ...group, meanPairSimilarity: pairs.length ? pairs.reduce((total, value) => total + value, 0) / pairs.length : null };
  });
  const updatedPairs = snapshot.result.groupPairs.map((pair) => ({
    ...pair,
    meanCrossSimilarity: average(updatedGroups.find((group) => group.id === pair.firstGroupId)!.noteIds,
      updatedGroups.find((group) => group.id === pair.secondGroupId)!.noteIds),
  }));
  const updatedAssignments = updatedGroups.flatMap((group) => group.noteIds.map((noteId) => {
    const nearest = (ids: string[]) => ids.map((id) => ({ noteId: id, similarity: score(noteId, id) }))
      .sort((left, right) => right.similarity - left.similarity || left.noteId.localeCompare(right.noteId))[0];
    const closestOutside = updatedGroups.filter((other) => other.id !== group.id)
      .flatMap((other) => other.noteIds.map((id) => ({ noteId: id, clusterId: other.id, similarity: score(noteId, id) })))
      .sort((left, right) => right.similarity - left.similarity || left.noteId.localeCompare(right.noteId))[0]!;
    const similarityToRepresentative = score(noteId, group.representativeNoteId);
    return {
      noteId, clusterId: group.id, similarityToRepresentative,
      distanceToRepresentative: 1 - similarityToRepresentative,
      closestMember: nearest(group.noteIds.filter((id) => id !== noteId)) ?? null,
      closestOutside,
    };
  })).sort((left, right) => left.noteId.localeCompare(right.noteId));
  return {
    revision,
    stale: false,
    result: {
      ...snapshot.result,
      noteCount: assignment.noteCount,
      scoreMethod: assignment.scoreMethod,
      embeddingModel: assignment.embeddingModel,
      groups: updatedGroups,
      groupPairs: updatedPairs,
      notePairs: assignment.notePairs,
      assignments: updatedAssignments,
    },
    bubbles: snapshot.bubbles.map((item) => item.clusterId !== assignment.chosenGroupId ? item : bubble ?? { ...item, size: item.size + 1 }),
  };
}
