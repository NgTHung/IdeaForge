import { z } from "zod";

export const sourceSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(4000),
});

export const MAX_MERGE_SOURCES = 8;
export const MAX_MERGE_TOTAL_CHARACTERS = 16_000;
const MAX_MERGE_RELATIONSHIPS = (MAX_MERGE_SOURCES * (MAX_MERGE_SOURCES - 1) / 2) * 6;

const mergeRelationshipSchema = z.object({
  type: z.enum(["synergy", "conflict", "extends"]),
  explanation: z.string().trim().max(500),
  condition: z.string().trim().max(600).optional(),
  sourceId: z.string().min(1).max(100),
  targetId: z.string().min(1).max(100),
});

export const mergeRequestSchema = z.object({
  goal: z.string().trim().min(1).max(500),
  sources: z.array(sourceSchema).min(2).max(MAX_MERGE_SOURCES),
  relationships: z.array(mergeRelationshipSchema).max(MAX_MERGE_RELATIONSHIPS).optional(),
  relationship: mergeRelationshipSchema.optional(),
}).superRefine(({ sources, relationships, relationship }, context) => {
  const ids = new Set(sources.map((source) => source.id));
  if (ids.size !== sources.length) {
    context.addIssue({ code: "custom", path: ["sources"], message: "Choose each source note only once." });
  }
  if (sources.reduce((total, source) => total + source.text.length, 0) > MAX_MERGE_TOTAL_CHARACTERS) {
    context.addIssue({ code: "custom", path: ["sources"], message: `Selected note text must total at most ${MAX_MERGE_TOTAL_CHARACTERS.toLocaleString()} characters.` });
  }
  if (relationships && relationship) {
    context.addIssue({ code: "custom", path: ["relationships"], message: "Send either relationships or the legacy relationship field." });
  }
  const links = relationships ?? (relationship ? [relationship] : []);
  const seen = new Set<string>();
  links.forEach((link, index) => {
    const endpointIds = new Set([link.sourceId, link.targetId]);
    if (link.sourceId === link.targetId || endpointIds.size !== 2 || [...endpointIds].some((id) => !ids.has(id))) {
      context.addIssue({ code: "custom", path: ["relationships", index], message: "Each relationship must join two selected notes." });
    }
    if (link.type === "conflict" && !link.condition?.trim()) {
      context.addIssue({ code: "custom", path: ["relationships", index, "condition"], message: "Conflict relationships need a condition." });
    }
    const endpoints = link.type === "extends" ? [link.sourceId, link.targetId] : [link.sourceId, link.targetId].sort();
    const key = JSON.stringify([link.type, ...endpoints]);
    if (seen.has(key)) context.addIssue({ code: "custom", path: ["relationships", index], message: "Relationships must be unique." });
    seen.add(key);
  });
}).transform(({ relationship, relationships, ...request }) => ({
  ...request,
  relationships: relationships ?? (relationship ? [relationship] : []),
}));

const mergeResultFields = {
  status: z.enum(["useful", "needs_clarification", "no_useful_merge"]),
  reason: z.string().trim().max(600),
  title: z.string().trim().min(1).max(120),
  concept: z.string().trim().min(1).max(2000),
  bridge: z.string().trim().min(1).max(600),
  tension: z.string().trim().min(1).max(600),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(4),
  nextExperiment: z.string().trim().min(1).max(600),
};

export const mergeProposalSchema = z.object({
  ...mergeResultFields,
  contributions: z.array(z.object({ sourceId: z.string().min(1).max(100), contribution: z.string().trim().min(1).max(600) }).strict())
    .min(2).max(MAX_MERGE_SOURCES),
  // Selected notes the concept leaves out, each with the reason it doesn't fit. Older records have none.
  // GLM often copies an empty contribution key into these items, so unknown keys are stripped instead of rejected.
  excluded: z.array(z.object({ sourceId: z.string().min(1).max(100), reason: z.string().trim().min(1).max(300) }))
    .max(MAX_MERGE_SOURCES - 2).optional(),
}).strict().superRefine(({ contributions, excluded = [] }, context) => {
  const ids = [...contributions, ...excluded].map(({ sourceId }) => sourceId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["contributions"], message: "Each source must appear once, in contributions or excluded." });
  }
});

// Returns why a proposal doesn't account for exactly the selected notes, or undefined when it does.
export function mergeCoverageProblem(proposal: MergeProposal, sourceIds: string[]): string | undefined {
  const expected = [...sourceIds].sort();
  const returned = [...proposal.contributions, ...(proposal.excluded ?? [])].map(({ sourceId }) => sourceId).sort();
  if (expected.length === returned.length && expected.every((id, index) => id === returned[index])) return undefined;
  return `every source ID (${expected.join(", ")}) must appear exactly once across contributions and excluded, but they contain ${returned.join(", ") || "none"}`;
}

export const legacyMergeResultSchema = z.object({
  ...mergeResultFields,
  contributionA: z.string().trim().min(1).max(600),
  contributionB: z.string().trim().min(1).max(600),
});

export const mergeResultSchema = z.union([mergeProposalSchema, legacyMergeResultSchema]);

export type MergeResult = z.infer<typeof mergeResultSchema>;
export type MergeProposal = z.infer<typeof mergeProposalSchema>;
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
