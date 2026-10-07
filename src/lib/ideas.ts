import { z } from "zod";

export const sourceSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(4000),
});

export const mergeRequestSchema = z.object({
  goal: z.string().trim().min(1).max(500),
  sources: z.tuple([sourceSchema, sourceSchema]),
  relationship: z.object({
    type: z.enum(["synergy", "conflict", "extends"]),
    explanation: z.string().trim().max(500),
    sourceId: z.string().min(1).max(100),
    targetId: z.string().min(1).max(100),
  }).optional(),
}).refine(({ sources, relationship }) => sources[0].id !== sources[1].id && (!relationship ||
  relationship.sourceId !== relationship.targetId && sources.some((source) => source.id === relationship.sourceId) && sources.some((source) => source.id === relationship.targetId)),
"Select two different notes and a link between them.");

export const mergeResultSchema = z.object({
  status: z.enum(["useful", "needs_clarification", "no_useful_merge"]),
  reason: z.string().trim().max(600),
  title: z.string().trim().min(1).max(120),
  concept: z.string().trim().min(1).max(2000),
  contributionA: z.string().trim().min(1).max(600),
  contributionB: z.string().trim().min(1).max(600),
  bridge: z.string().trim().min(1).max(600),
  tension: z.string().trim().min(1).max(600),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(4),
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
