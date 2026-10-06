import { z } from "zod";
import { similarityCardSchema } from "./similarity.ts";

export const similarityClusteringRequestSchema = z.object({
  cards: z.array(similarityCardSchema).min(2).max(50),
  clusterCount: z.number().int().min(2).max(10),
  metric: z.enum(["centered", "raw"]),
}).strict().superRefine(({ cards }, context) => {
  const ids = new Set<string>();
  for (const [index, card] of cards.entries()) {
    if (ids.has(card.id)) {
      context.addIssue({
        code: "custom",
        path: ["cards", index, "id"],
        message: "Card IDs must be unique.",
      });
    }
    ids.add(card.id);
  }
});

export const fastApiClusterResponseSchema = z.object({
  algorithm: z.literal("kmeans_l2_normalized"),
  embedding_model: z.string().min(1),
  metric: z.enum(["centered", "raw"]),
  cluster_count: z.number().int().min(2).max(10),
  groups: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    note_ids: z.array(z.string().min(1)).min(1),
    size: z.number().int().positive(),
  })).min(2).max(10),
  assignments: z.array(z.object({
    note_id: z.string().min(1),
    group_id: z.string().min(1),
  })).min(2).max(50),
}).strict();
