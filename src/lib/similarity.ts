import "server-only";

import { z } from "zod";
import { embedTexts } from "./ai.ts";

export const similarityCardSchema = z.object({
  id: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(4000),
});

export const similarityRequestSchema = z.object({
  cards: z.array(similarityCardSchema).min(2).max(50),
  compareMethods: z.boolean().optional(),
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

const pairScoreSchema = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  score: z.number().finite().min(-1).max(1),
});

export const similarityResultSchema = z.object({
  method: z.enum(["mean_centered_cosine", "nearest_neighbor_rank"]),
  centeredThreshold: z.number().int().min(2).max(50),
  scores: z.array(pairScoreSchema),
});

export const similarityComparisonResultSchema = z.object({
  method: z.literal("cosine_comparison"),
  model: z.string().min(1),
  centeredThreshold: z.number().int().min(2).max(50),
  rawScores: z.array(pairScoreSchema),
  centeredScores: z.array(pairScoreSchema),
});

export type SimilarityCard = z.infer<typeof similarityCardSchema>;
export type SimilarityResult = z.infer<typeof similarityResultSchema>;
export type SimilarityComparisonResult = z.infer<typeof similarityComparisonResultSchema>;

const EMBEDDING_DIMENSIONS = 768;
const MAX_CACHED_TEXTS = 2_000;
const DEFAULT_CENTERED_THRESHOLD = 8;
const MIN_CENTERED_THRESHOLD = 2;
const MAX_CENTERED_THRESHOLD = 50;

type CachedEmbedding = { model: string; vector: number[] };
type EmbeddingCache = Map<string, Promise<CachedEmbedding>>;
type CacheGlobal = typeof globalThis & { __IDEAFORGE_EMBEDDING_CACHE_V2__?: EmbeddingCache };
const cacheGlobal = globalThis as CacheGlobal;
const embeddingCache = cacheGlobal.__IDEAFORGE_EMBEDDING_CACHE_V2__ ??= new Map<string, Promise<CachedEmbedding>>();

function centeredThreshold(): number {
  const value = Number(process.env.SIMILARITY_MIN_CENTERED_CARDS);
  if (!Number.isInteger(value) || value < MIN_CENTERED_THRESHOLD || value > MAX_CENTERED_THRESHOLD) {
    return DEFAULT_CENTERED_THRESHOLD;
  }
  return value;
}

function trimEmbeddingCache(): void {
  while (embeddingCache.size > MAX_CACHED_TEXTS) {
    const oldest = embeddingCache.keys().next().value;
    if (oldest === undefined) break;
    embeddingCache.delete(oldest);
  }
}

function rememberEmbedding(text: string, cached: Promise<CachedEmbedding>): void {
  embeddingCache.delete(text);
  embeddingCache.set(text, cached);
  trimEmbeddingCache();
  void cached.catch(() => {
    if (embeddingCache.get(text) === cached) embeddingCache.delete(text);
  });
}

function touchCachedEmbeddings(texts: string[], cached: Promise<CachedEmbedding>[]): void {
  texts.forEach((text, index) => {
    const entry = cached[index];
    if (entry && embeddingCache.get(text) === entry) {
      embeddingCache.delete(text);
      embeddingCache.set(text, entry);
    }
  });
}

async function embedAndCache(texts: string[]): Promise<CachedEmbedding[]> {
  const batch = embedTexts(texts, { outputDimensionality: EMBEDDING_DIMENSIONS });
  const cached = texts.map((text, index) => {
    const entry = batch.then(({ model, vectors }) => ({ model, vector: vectors[index] }));
    rememberEmbedding(text, entry);
    return entry;
  });
  return Promise.all(cached);
}

function sameModel(entries: CachedEmbedding[]): boolean {
  return entries.length > 0 && entries.every((entry) => entry.model === entries[0].model);
}

function vectorsForTexts(
  texts: string[],
  uniqueTexts: string[],
  entries: CachedEmbedding[],
): number[][] {
  const byText = new Map<string, number[]>(uniqueTexts.map((text, index) => [text, entries[index].vector]));
  return texts.map((text) => byText.get(text)!);
}

async function embeddingsFor(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
  const uniqueTexts = [...new Set(texts)];
  const cachedByText = uniqueTexts.map((text) => embeddingCache.get(text));
  const missing = uniqueTexts.filter((_, index) => !cachedByText[index]);
  const hits = uniqueTexts.flatMap((text, index) =>
    cachedByText[index] ? [{ text, entry: cachedByText[index]! }] : [],
  );

  if (missing.length === 0) {
    const cachedEntries = await Promise.all(cachedByText as Promise<CachedEmbedding>[]);
    if (sameModel(cachedEntries)) {
      touchCachedEmbeddings(uniqueTexts, cachedByText as Promise<CachedEmbedding>[]);
      return { vectors: vectorsForTexts(texts, uniqueTexts, cachedEntries), model: cachedEntries[0].model };
    }
    const freshEntries = await embedAndCache(uniqueTexts);
    return { vectors: vectorsForTexts(texts, uniqueTexts, freshEntries), model: freshEntries[0].model };
  }

  if (hits.length > 0) {
    const hitEntries = await Promise.all(hits.map(({ entry }) => entry));
    if (sameModel(hitEntries)) {
      touchCachedEmbeddings(hits.map(({ text }) => text), hits.map(({ entry }) => entry));
      const missingEntries = await embedAndCache(missing);
      if (missingEntries.every((entry) => entry.model === hitEntries[0].model)) {
        const byText = new Map<string, CachedEmbedding>(
          hits.map(({ text }, index) => [text, hitEntries[index]]),
        );
        missing.forEach((text, index) => byText.set(text, missingEntries[index]));
        return { vectors: texts.map((text) => byText.get(text)!.vector), model: hitEntries[0].model };
      }
    }
  }

  const freshEntries = await embedAndCache(uniqueTexts);
  return { vectors: vectorsForTexts(texts, uniqueTexts, freshEntries), model: freshEntries[0].model };
}

export async function embedSimilarityCards(cards: SimilarityCard[]): Promise<{ vectors: number[][]; model: string }> {
  return embeddingsFor(cards.map(({ text }) => text));
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

function pairwiseScores(cards: SimilarityCard[], matrix: number[][]): SimilarityComparisonResult["rawScores"] {
  const scores: SimilarityComparisonResult["rawScores"] = [];
  for (let sourceIndex = 0; sourceIndex < cards.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < cards.length; targetIndex += 1) {
      scores.push({
        sourceId: cards[sourceIndex].id,
        targetId: cards[targetIndex].id,
        score: matrix[sourceIndex][targetIndex],
      });
    }
  }
  return scores;
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
  const { vectors } = await embeddingsFor(cards.map((card) => card.text));
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

export async function compareSimilarityMethods(cards: SimilarityCard[]): Promise<SimilarityComparisonResult> {
  const { vectors, model } = await embeddingsFor(cards.map((card) => card.text));
  return {
    method: "cosine_comparison",
    model,
    centeredThreshold: centeredThreshold(),
    rawScores: pairwiseScores(cards, cosineMatrix(vectors)),
    centeredScores: pairwiseScores(cards, cosineMatrix(centeredVectors(vectors))),
  };
}
