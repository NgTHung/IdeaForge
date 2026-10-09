import { z } from "zod";

export const MAX_IDEA_DESCRIPTION_REQUEST_BYTES = 8_000;

export const ideaDescriptionRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(500),
  boardTitle: z.string().trim().min(1).max(80),
  boardDescription: z.string().trim().max(600).optional(),
  seedContent: z.string().trim().max(1200).optional(),
  clusterLabel: z.string().trim().min(1).max(100).optional(),
}).strict();

export const ideaDescriptionDraftSchema = z.object({
  description: z.string().trim().min(100).max(700).nullable(),
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
  if (Boolean(output.description) === Boolean(output.question)) {
    return "Return either one content draft or one clarification question, but not both.";
  }
  return undefined;
}
