import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import envPackage from "@next/env";

const { loadEnvConfig } = envPackage;
loadEnvConfig(process.cwd());

const datasetPath = path.resolve("data/similarity-evaluation/notes.json");
const reviewPath = path.resolve("data/similarity-evaluation/review-pairs.csv");
const rankingPath = path.resolve("data/similarity-evaluation/candidate-rankings.csv");
const resultsPath = path.resolve("data/similarity-evaluation/results.json");
const embeddingModel = "gemini-embedding-001";
const dimensions = 768;
const nearestCount = 2;
const crossThemeCount = 1;

if (!process.env.GEMINI_API_KEY?.trim()) {
  throw new Error("Set GEMINI_API_KEY in .env before running this evaluation.");
}

// The app expects one embedding per text. Keep this run on its text-only model.
process.env.GEMINI_EMBEDDING_MODEL = embeddingModel;
process.env.GEMINI_EMBEDDING_FALLBACK_MODEL = embeddingModel;

const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
if (!Array.isArray(dataset.notes) || dataset.notes.length < 40) {
  throw new Error("The evaluation requires at least 40 notes.");
}

let providerRequests = 0;
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  if (providerRequests >= 1) {
    throw new Error("This evaluation is capped at one live provider request.");
  }
  providerRequests += 1;
  return nativeFetch(input, init);
};

const { embedTexts } = await import("../src/lib/ai.ts");
const embedded = await embedTexts(dataset.notes.map(({ text }) => text), {
  outputDimensionality: dimensions,
});
if (embedded.model !== embeddingModel || embedded.vectors.length !== dataset.notes.length) {
  throw new Error("Gemini returned an unexpected model or number of note vectors.");
}
if (embedded.vectors.some((vector) => vector.length !== dimensions)) {
  throw new Error("Gemini returned a vector with an unexpected dimension.");
}

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftNorm * rightNorm);
  return denominator === 0 ? 0 : dot / denominator;
}

function scoreMatrix(vectors) {
  return vectors.map((left) => vectors.map((right) => cosine(left, right)));
}

const mean = embedded.vectors[0].map((_, dimension) =>
  embedded.vectors.reduce((sum, vector) => sum + vector[dimension], 0) / embedded.vectors.length,
);
const centered = embedded.vectors.map((vector) => vector.map((value, dimension) => value - mean[dimension]));
const rawScores = scoreMatrix(embedded.vectors);
const centeredScores = scoreMatrix(centered);
const scoreMatrices = { raw: rawScores, centered: centeredScores };
const pairRows = new Map();

function rankedNeighbors(sourceIndex, matrix, crossThemeOnly = false) {
  const source = dataset.notes[sourceIndex];
  return matrix[sourceIndex]
    .map((score, targetIndex) => ({ score, targetIndex }))
    .filter(({ targetIndex }) => {
      if (targetIndex === sourceIndex) return false;
      return !crossThemeOnly || dataset.notes[targetIndex].theme !== source.theme;
    })
    .sort((left, right) =>
      right.score - left.score || dataset.notes[left.targetIndex].id.localeCompare(dataset.notes[right.targetIndex].id),
    );
}

function pairRow(leftIndex, rightIndex) {
  const a = Math.min(leftIndex, rightIndex);
  const b = Math.max(leftIndex, rightIndex);
  const key = `${a}:${b}`;
  if (!pairRows.has(key)) {
    pairRows.set(key, {
      pairId: `P${String(pairRows.size + 1).padStart(3, "0")}`,
      a,
      b,
      rawNearestRankA: "",
      rawNearestRankB: "",
      centeredNearestRankA: "",
      centeredNearestRankB: "",
      rawCrossThemeRankA: "",
      rawCrossThemeRankB: "",
      centeredCrossThemeRankA: "",
      centeredCrossThemeRankB: "",
    });
  }
  return pairRows.get(key);
}

for (const [method, matrix] of Object.entries(scoreMatrices)) {
  for (let sourceIndex = 0; sourceIndex < dataset.notes.length; sourceIndex += 1) {
    const nearest = rankedNeighbors(sourceIndex, matrix).slice(0, nearestCount);
    nearest.forEach(({ targetIndex }, rank) => {
      const row = pairRow(sourceIndex, targetIndex);
      const suffix = method === "raw" ? "RawNearestRank" : "CenteredNearestRank";
      row[`${suffix}${row.a === sourceIndex ? "A" : "B"}`] = String(rank + 1);
    });

    const crossTheme = rankedNeighbors(sourceIndex, matrix, true).slice(0, crossThemeCount);
    crossTheme.forEach(({ targetIndex }, rank) => {
      const row = pairRow(sourceIndex, targetIndex);
      const suffix = method === "raw" ? "RawCrossThemeRank" : "CenteredCrossThemeRank";
      row[`${suffix}${row.a === sourceIndex ? "A" : "B"}`] = String(rank + 1);
    });
  }
}

const rows = [...pairRows.values()].sort((left, right) => left.a - right.a || left.b - right.b);
const reviewOrder = [...rows].sort((left, right) => {
  const hash = (value) => [...value].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return hash(left.pairId) - hash(right.pairId);
});

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

const reviewHeader = [
  "pair_id", "note_a_id", "note_a_text", "note_b_id", "note_b_text",
  "human_judgment_related_unrelated_unclear", "reviewer", "reviewer_notes",
];
const reviewLines = [reviewHeader, ...reviewOrder.map((row) => [
  row.pairId,
  dataset.notes[row.a].id,
  dataset.notes[row.a].text,
  dataset.notes[row.b].id,
  dataset.notes[row.b].text,
  "",
  "",
  "",
])].map((line) => line.map(csvCell).join(","));

const rankingHeader = [
  "pair_id", "note_a_id", "note_b_id", "raw_cosine", "centered_cosine",
  "raw_nearest_rank_a", "raw_nearest_rank_b", "centered_nearest_rank_a", "centered_nearest_rank_b",
  "raw_cross_theme_rank_a", "raw_cross_theme_rank_b", "centered_cross_theme_rank_a",
  "centered_cross_theme_rank_b",
];
const rankingLines = [rankingHeader, ...rows.map((row) => [
  row.pairId,
  dataset.notes[row.a].id,
  dataset.notes[row.b].id,
  rawScores[row.a][row.b].toFixed(6),
  centeredScores[row.a][row.b].toFixed(6),
  row.rawNearestRankA,
  row.rawNearestRankB,
  row.centeredNearestRankA,
  row.centeredNearestRankB,
  row.rawCrossThemeRankA,
  row.rawCrossThemeRankB,
  row.centeredCrossThemeRankA,
  row.centeredCrossThemeRankB,
])].map((line) => line.map(csvCell).join(","));

function themeAgreement(matrix) {
  let matching = 0;
  let reviewed = 0;
  for (let sourceIndex = 0; sourceIndex < dataset.notes.length; sourceIndex += 1) {
    for (const { targetIndex } of rankedNeighbors(sourceIndex, matrix).slice(0, nearestCount)) {
      reviewed += 1;
      if (dataset.notes[sourceIndex].theme === dataset.notes[targetIndex].theme) matching += 1;
    }
  }
  return { matching, reviewed, rate: matching / reviewed };
}

const result = {
  datasetId: dataset.dataset_id,
  source: dataset.source,
  noteCount: dataset.notes.length,
  goal: dataset.goal,
  model: embedded.model,
  dimensions,
  providerRequests,
  methods: ["raw cosine", "cosine after subtracting the board mean vector"],
  reviewCandidatePolicy: { nearestPerNotePerMethod: nearestCount, crossThemePerNotePerMethod: crossThemeCount },
  uniqueCandidatePairsForReview: rows.length,
  syntheticThemeAgreementAtTop2: {
    raw: themeAgreement(rawScores),
    centered: themeAgreement(centeredScores),
    caveat: "Creator-assigned synthetic themes are a rough proxy, not human relevance judgments.",
  },
  productionSettings: {
    currentSmallBoardThreshold: Number(process.env.SIMILARITY_MIN_CENTERED_CARDS) || 8,
    recommendedNearestCount: null,
    recommendedCrossThemeCount: null,
    status: "Awaiting human review; do not treat synthetic results as final settings.",
  },
};

await writeFile(reviewPath, `${reviewLines.join("\n")}\n`, "utf8");
await writeFile(rankingPath, `${rankingLines.join("\n")}\n`, "utf8");
await writeFile(resultsPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
