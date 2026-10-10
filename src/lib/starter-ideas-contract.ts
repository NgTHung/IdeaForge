import { z } from "zod";
import { boardDescriptionSchema, boardTitleSchema } from "./board-directory.ts";

export const starterIdeaCandidateSchema = z.object({
  title: z.string().trim().min(4).max(80),
  description: z.string().trim().min(40).max(600),
  approach: z.string().trim().min(3).max(80),
}).strict();

export const starterIdeaPoolSchema = z.object({
  candidates: z.array(starterIdeaCandidateSchema).min(10).max(12),
}).strict();

export const starterIdeaSelectionSchema = z.object({
  indices: z.array(z.number().int().min(0).max(11)).length(5),
}).strict();

export const starterIdeasResponseSchema = z.object({
  attemptId: z.uuid(),
  title: boardTitleSchema,
  description: boardDescriptionSchema,
  ideas: z.array(starterIdeaCandidateSchema).length(5),
  model: z.string().min(1),
  generatedAt: z.iso.datetime(),
}).strict();

export type StarterIdeaCandidate = z.infer<typeof starterIdeaCandidateSchema>;
export type StarterIdeasResponse = z.infer<typeof starterIdeasResponseSchema>;

function normalized(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function starterIdeaSelectionProblem(candidates: StarterIdeaCandidate[], indices: number[]): string | undefined {
  if (new Set(indices).size !== 5 || indices.some((index) => index >= candidates.length)) {
    return "select five different candidate indices from the supplied pool";
  }
  const selected = indices.map((index) => candidates[index]);
  for (const field of ["title", "approach"] as const) {
    const values = selected.map((idea) => normalized(idea[field]));
    if (new Set(values).size !== 5) return `select five ideas with different ${field} values and core mechanisms`;
  }
  if (new Set(selected.map((idea) => normalized(idea.description))).size !== 5) {
    return "select five ideas with different descriptions";
  }
  return undefined;
}
