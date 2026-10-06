import "server-only";

import { z } from "zod";
import { embedTexts } from "./ai.ts";

export const similarityCardSchema = z.object({
  id: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(4000),
});

export const similarityRequestSchema = z.object({
  cards: z.array(similarityCardSchema).min(2).max(50),
}).superRefine(({ cards }, context) => {
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

export const similarityResultSchema = z.object({
  method: z.enum(["mean_centered_cosine", "nearest_neighbor_rank"]),
  centeredThreshold: z.number().int().min(2).max(50),
  scores: z.array(z.object({
    sourceId: z.string(),
    targetId: z.string(),
    score: z.number().finite().min(-1).max(1),
  })),
});

export type SimilarityCard = z.infer<typeof similarityCardSchema>;
export type SimilarityResult = z.infer<typeof similarityResultSchema>;

const EMBEDDING_DIMENSIONS = 768;
const DEFAULT_CENTERED_THRESHOLD = 8;
const MIN_CENTERED_THRESHOLD = 2;
const MAX_CENTERED_THRESHOLD = 50;

type EmbeddingCache = Map<string, Promise<number[]>>;
type CacheGlobal = typeof globalThis & { __IDEAFORGE_EMBEDDING_CACHE__?: EmbeddingCache };
const cacheGlobal = globalThis as CacheGlobal;
const embeddingCache = cacheGlobal.__IDEAFORGE_EMBEDDING_CACHE__ ??= new Map<string, Promise<number[]>>();

function centeredThreshold(): number {
  const value = Number(process.env.SIMILARITY_MIN_CENTERED_CARDS);
  if (!Number.isInteger(value) || value < MIN_CENTERED_THRESHOLD || value > MAX_CENTERED_THRESHOLD) {
    return DEFAULT_CENTERED_THRESHOLD;
  }
  return value;
}

async function embeddingsFor(texts: string[]): Promise<number[][]> {
  const uniqueTexts = [...new Set(texts)];
  const missing = uniqueTexts.filter((text) => !embeddingCache.has(text));

  if (missing.length) {
    const batch = embedTexts(missing, { outputDimensionality: EMBEDDING_DIMENSIONS });
    missing.forEach((text, index) => {
      const cached = batch.then((vectors) => vectors[index]);
      embeddingCache.set(text, cached);
      void cached.catch(() => {
        if (embeddingCache.get(text) === cached) embeddingCache.delete(text);
      });
    });
  }

  const vectors = await Promise.all(uniqueTexts.map((text) => {
    const cached = embeddingCache.get(text);
    if (!cached) throw new Error("Embedding cache entry was removed before it could be read.");
    embeddingCache.delete(text);
    embeddingCache.set(text, cached);
    return cached;
  }));

  const byText = new Map<string, number[]>(uniqueTexts.map((text, index) => [text, vectors[index]]));
  return texts.map((text) => byText.get(text)!);
}

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftNorm * rightNorm);
  if (denominator === 0) return 0;
  return Math.max(-1, Math.min(1, dot / denominator));
}

function cosineMatrix(vectors: number[][]): number[][] {
  return vectors.map((left) => vectors.map((right) => cosine(left, right)));
}

function centeredVectors(vectors: number[][]): number[][] {
  const mean = vectors[0].map((_, dimension) =>
    vectors.reduce((sum, vector) => sum + vector[dimension], 0) / vectors.length,
  );
  return vectors.map((vector) => vector.map((value, dimension) => value - mean[dimension]));
}

function rankedScores(cards: SimilarityCard[], rawScores: number[][]): SimilarityResult["scores"] {
  const rankBySource = rawScores.map((row, sourceIndex) => {
    const neighbors = row
      .map((score, targetIndex) => ({ score, targetIndex }))
      .filter(({ targetIndex }) => targetIndex !== sourceIndex)
      .sort((left, right) =>
        right.score - left.score || cards[left.targetIndex].id.localeCompare(cards[right.targetIndex].id),
      );
    return new Map<number, number>(neighbors.map(({ targetIndex }, rank) => [targetIndex, rank]));
  });
  const neighborCount = cards.length - 1;
  const scores: SimilarityResult["scores"] = [];
  for (let sourceIndex = 0; sourceIndex < cards.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < cards.length; targetIndex += 1) {
      const sourceRank = rankBySource[sourceIndex].get(targetIndex)!;
      const targetRank = rankBySource[targetIndex].get(sourceIndex)!;
      const score = 1 - (sourceRank + targetRank) / (2 * neighborCount);
      scores.push({ sourceId: cards[sourceIndex].id, targetId: cards[targetIndex].id, score });
    }
  }
  return scores;
}

export async function calculateSimilarity(cards: SimilarityCard[]): Promise<SimilarityResult> {
  const threshold = centeredThreshold();
  const vectors = await embeddingsFor(cards.map((card) => card.text));
  const rawScores = cosineMatrix(vectors);

  if (cards.length < threshold) {
    return {
      method: "nearest_neighbor_rank",
      centeredThreshold: threshold,
      scores: rankedScores(cards, rawScores),
    };
  }

  const centeredScores = cosineMatrix(centeredVectors(vectors));
  const scores: SimilarityResult["scores"] = [];
  for (let sourceIndex = 0; sourceIndex < cards.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < cards.length; targetIndex += 1) {
      scores.push({
        sourceId: cards[sourceIndex].id,
        targetId: cards[targetIndex].id,
        score: centeredScores[sourceIndex][targetIndex],
      });
    }
  }
  return { method: "mean_centered_cosine", centeredThreshold: threshold, scores };
}
