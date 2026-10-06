import { z } from "zod";

export const sourceSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(4000),
});

export const mergeRequestSchema = z.object({
  goal: z.string().trim().min(1).max(500),
  sources: z.tuple([sourceSchema, sourceSchema]),
}).refine(({ sources }) => sources[0].id !== sources[1].id, "Select two different notes.");

export const mergeResultSchema = z.object({
  title: z.string().trim().min(1).max(120),
  concept: z.string().trim().min(1).max(2000),
  contributionA: z.string().trim().min(1).max(600),
  contributionB: z.string().trim().min(1).max(600),
  tension: z.string().trim().min(1).max(600),
  nextExperiment: z.string().trim().min(1).max(600),
});

export type MergeResult = z.infer<typeof mergeResultSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Idea = {
  id: string;
  text: string;
  title: string;
  position: { x: number; y: number };
  parents: Source[];
  merge: MergeResult | null;
};

export const initialGoal = "Help students build a consistent study habit.";
export const initialIdeas: Idea[] = [
  { id: "study-partners", title: "", text: "Students have trouble finding study partners.", position: { x: 0, y: 0 }, parents: [], merge: null },
  { id: "daily-challenges", title: "", text: "People stay motivated through short daily challenges.", position: { x: 360, y: 90 }, parents: [], merge: null },
];
