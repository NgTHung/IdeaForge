import { z } from "zod";

export const ideaDescriptionRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(500),
}).strict();

export const ideaDescriptionDraftSchema = z.object({
  description: z.string().trim().min(1).max(400).nullable(),
  question: z.string().trim().min(1).max(200).nullable(),
}).strict();

export const ideaDescriptionResponseSchema = ideaDescriptionDraftSchema.extend({
  model: z.string().trim().min(1).max(200),
  generatedAt: z.iso.datetime(),
}).strict().refine((output) => Boolean(output.description) !== Boolean(output.question), {
  message: "Return either a description or a clarification question.",
});

export type IdeaDescriptionRequest = z.infer<typeof ideaDescriptionRequestSchema>;
export type IdeaDescriptionDraft = z.infer<typeof ideaDescriptionDraftSchema>;
export type IdeaDescriptionResponse = z.infer<typeof ideaDescriptionResponseSchema>;

export function ideaDescriptionOutputProblem(output: IdeaDescriptionDraft): string | undefined {
  return Boolean(output.description) === Boolean(output.question)
    ? "Return either one description or one clarification question, but not both."
    : undefined;
}
