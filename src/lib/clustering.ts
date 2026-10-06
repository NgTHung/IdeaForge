import "server-only";

import { clusterResponseSchema, type ClusterCard, type ClusterResponse } from "./cluster-contract";
import { clusterCards } from "./cluster-algorithm";
import { calculateSimilarity } from "./similarity";

export async function calculateClusters(cards: ClusterCard[], clusterCount: number): Promise<ClusterResponse> {
  const similarity = await calculateSimilarity(cards);
  return clusterResponseSchema.parse(clusterCards(cards, similarity, clusterCount));
}
