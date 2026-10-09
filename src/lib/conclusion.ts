import { z } from "zod";
import { markdownTextSchema } from "./markdown.ts";

export const MAX_CONCLUSION_NOTES = 50;
export const MAX_CONCLUSION_CLUSTERS = 10;
export const MAX_CONCLUSION_TOTAL_CHARACTERS = 16_000;
const MAX_CONCLUSION_RELATIONSHIPS = 300;

const cardId = z.string().min(1).max(100);

const conclusionMergeSchema = z.object({
  bridge: z.string().trim().max(600),
  tension: z.string().trim().max(600),
  assumptions: z.array(z.string().trim().max(300)).max(4),
  nextExperiment: z.string().trim().max(600),
  sources: z.array(z.object({
    id: cardId,
    title: z.string().trim().max(120),
    author: z.string().trim().max(80),
    text: z.string().trim().max(4000),
  })).max(8),
});

const conclusionNoteSchema = z.object({
  id: cardId,
  title: z.string().trim().max(120),
  text: z.string().trim().min(1).max(4000),
  author: z.string().trim().max(80),
  merge: conclusionMergeSchema.optional(),
});

const conclusionClusterSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  noteIds: z.array(cardId).min(1).max(MAX_CONCLUSION_NOTES),
});

const conclusionRelationshipSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["synergy", "conflict", "extends"]),
  explanation: z.string().trim().max(500),
  condition: z.string().trim().max(600).optional(),
  sourceId: cardId,
  targetId: cardId,
});

export type ConclusionNote = z.infer<typeof conclusionNoteSchema>;

// Counts the text the model reads, so the browser and the route apply the same limit.
export function conclusionSourceCharacters(notes: ConclusionNote[]): number {
  return notes.reduce((total, note) => total + note.title.length + note.text.length + (note.merge ? [
    note.merge.bridge, note.merge.tension, note.merge.nextExperiment, ...note.merge.assumptions, ...note.merge.sources.map((source) => source.text),
  ].reduce((sum, text) => sum + text.length, 0) : 0), 0);
}

export const conclusionRequestSchema = z.object({
  goal: z.string().trim().min(1).max(500),
  notes: z.array(conclusionNoteSchema).min(1).max(MAX_CONCLUSION_NOTES),
  clusters: z.array(conclusionClusterSchema).max(MAX_CONCLUSION_CLUSTERS),
  relationships: z.array(conclusionRelationshipSchema).max(MAX_CONCLUSION_RELATIONSHIPS),
}).superRefine(({ notes, clusters, relationships }, context) => {
  const ids = new Set(notes.map((note) => note.id));
  if (ids.size !== notes.length) context.addIssue({ code: "custom", path: ["notes"], message: "Choose each note only once." });
  if (conclusionSourceCharacters(notes) > MAX_CONCLUSION_TOTAL_CHARACTERS) {
    context.addIssue({ code: "custom", path: ["notes"], message: `Selected text must total at most ${MAX_CONCLUSION_TOTAL_CHARACTERS.toLocaleString()} characters.` });
  }
  clusters.forEach((cluster, index) => {
    if (cluster.noteIds.some((id) => !ids.has(id))) {
      context.addIssue({ code: "custom", path: ["clusters", index], message: "Each cluster may list only selected notes." });
    }
  });
  relationships.forEach((link, index) => {
    if (link.sourceId === link.targetId || !ids.has(link.sourceId) || !ids.has(link.targetId)) {
      context.addIssue({ code: "custom", path: ["relationships", index], message: "Each relationship must join two selected notes." });
    }
    if (link.type === "conflict" && !link.condition?.trim()) {
      context.addIssue({ code: "custom", path: ["relationships", index, "condition"], message: "Conflict relationships need a condition." });
    }
  });
  if (new Set(relationships.map((link) => link.id)).size !== relationships.length) {
    context.addIssue({ code: "custom", path: ["relationships"], message: "Relationships must be unique." });
  }
});

export type ConclusionRequest = z.infer<typeof conclusionRequestSchema>;

const citedIds = z.array(cardId).min(1).max(12);

// The model often adds keys the schema doesn't name, so unknown keys are stripped instead of rejected.
export const conclusionDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: markdownTextSchema(800, 1),
  themes: z.array(z.object({ title: z.string().trim().min(1).max(120), text: markdownTextSchema(800, 1), cardIds: citedIds })).min(1).max(5),
  keyIdeas: z.array(z.object({ cardId, why: markdownTextSchema(400, 1) })).min(1).max(6),
  conflicts: z.array(z.object({
    relationshipId: z.string().min(1).max(100),
    handling: z.enum(["addressed", "open_question"]),
    text: markdownTextSchema(600, 1),
  })).max(MAX_CONCLUSION_RELATIONSHIPS),
  assumptions: z.array(z.object({ text: markdownTextSchema(300, 1), cardIds: citedIds })).max(4),
  openQuestions: z.array(z.object({ text: markdownTextSchema(400, 1), cardIds: citedIds })).max(4),
  nextSteps: z.array(z.object({ text: markdownTextSchema(400, 1), cardIds: z.array(cardId).max(12) })).min(1).max(3),
});

export type ConclusionDraft = z.infer<typeof conclusionDraftSchema>;

// A draft may cite selected notes and the parents recorded in a selected merged note.
export function conclusionCitableIds(request: ConclusionRequest): Set<string> {
  return new Set(request.notes.flatMap((note) => [note.id, ...(note.merge?.sources.map((source) => source.id) ?? [])]));
}

export function conclusionCitations(draft: ConclusionDraft): string[] {
  return [
    ...draft.themes.flatMap((theme) => theme.cardIds), ...draft.keyIdeas.map((idea) => idea.cardId),
    ...draft.assumptions.flatMap((item) => item.cardIds), ...draft.openQuestions.flatMap((item) => item.cardIds),
    ...draft.nextSteps.flatMap((step) => step.cardIds),
  ];
}

// Returns why a draft can't be shown for this request, or undefined when it can. The shared AI module sends the problem back to the model once.
export function conclusionDraftProblem(draft: ConclusionDraft, request: ConclusionRequest): string | undefined {
  const citable = conclusionCitableIds(request);
  const unknown = [...new Set(conclusionCitations(draft).filter((id) => !citable.has(id)))];
  if (unknown.length) return `cite only card IDs from the request; these are not in it: ${unknown.join(", ")}`;
  const conflictIds = request.relationships.filter((link) => link.type === "conflict").map((link) => link.id);
  const handled = draft.conflicts.map((conflict) => conflict.relationshipId);
  const missing = conflictIds.filter((id) => !handled.includes(id));
  if (missing.length) return `conflicts must have one entry for each conflict relationship; missing: ${missing.join(", ")}`;
  if (handled.some((id) => !conflictIds.includes(id)) || new Set(handled).size !== handled.length) {
    return `conflicts may list only the conflict relationships ${conflictIds.join(", ") || "(none)"}, each once`;
  }
  const [only] = request.notes;
  if (request.notes.length === 1 && only.merge?.assumptions.some((assumption) => assumption.trim()) && !draft.assumptions.length) {
    return "the selected merged note records assumptions, so list them in assumptions";
  }
  return undefined;
}
