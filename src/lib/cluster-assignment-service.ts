import "server-only";

import { clusterAssignmentResponseSchema, type ClusterAssignmentRequest, type ClusterAssignmentResponse } from "./cluster-contract";
import { assignCardToGroup } from "./cluster-assignment";
import { calculateSimilarity } from "./similarity";

export async function calculateClusterAssignment(request: ClusterAssignmentRequest): Promise<ClusterAssignmentResponse> {
  const cards = [request.newCard, ...request.groups.flatMap((group) => group.cards)];
  const similarity = await calculateSimilarity(cards);
  return clusterAssignmentResponseSchema.parse(assignCardToGroup(request, similarity));
}
