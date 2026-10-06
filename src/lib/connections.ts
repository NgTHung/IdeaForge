import { z } from "zod";
import { sourceSchema } from "./ideas.ts";

export const connectionRequestSchema = z.object({
  goal: z.string().trim().min(1).max(500),
  cards: z.array(sourceSchema).min(2).max(50),
  existingLinks: z.array(z.object({ sourceId: z.string().min(1).max(100), targetId: z.string().min(1).max(100) })).max(2500).default([]),
}).superRefine(({ cards, existingLinks }, context) => {
  if (new Set(cards.map((card) => card.id)).size !== cards.length) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Card IDs must be unique." });
  }
  const ids = new Set(cards.map((card) => card.id));
  if (existingLinks.some(({ sourceId, targetId }) => sourceId === targetId || !ids.has(sourceId) || !ids.has(targetId))) {
    context.addIssue({ code: "custom", path: ["existingLinks"], message: "Links must connect two different cards on the board." });
  }
});

export const connectionResultSchema = z.object({
  status: z.enum(["suggestions", "none", "needs_clarification"]),
  explanation: z.string().trim().min(1).max(1000),
  question: z.string().trim().min(1).max(600).nullable(),
  suggestions: z.array(z.object({
    sourceId: z.string().min(1).max(100),
    targetId: z.string().min(1).max(100),
    type: z.enum(["synergy", "conflict", "extends"]),
    explanation: z.string().trim().min(1).max(1000),
    condition: z.string().trim().min(1).max(600).nullable(),
  })).max(3),
}).superRefine((result, context) => {
  if ((result.status === "suggestions") !== (result.suggestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["suggestions"], message: "Only a suggestions result can contain links, and it must contain at least one." });
  }
  if ((result.status === "needs_clarification") !== (result.question !== null)) {
    context.addIssue({ code: "custom", path: ["question"], message: "Only a clarification result must include a question." });
  }
  result.suggestions.forEach((suggestion, index) => {
    if ((suggestion.type === "conflict") !== (suggestion.condition !== null)) {
      context.addIssue({ code: "custom", path: ["suggestions", index, "condition"], message: "Only a conflict must state its condition." });
    }
  });
});

export type ConnectionRequest = z.infer<typeof connectionRequestSchema>;
export type ConnectionResult = z.infer<typeof connectionResultSchema>;

export function connectionPairKey(sourceId: string, targetId: string): string {
  return JSON.stringify([sourceId, targetId].sort());
}

export function validConnectionReferences(result: ConnectionResult, candidatePairs: { sourceId: string; targetId: string }[]): boolean {
  const candidates = new Set(candidatePairs.map(({ sourceId, targetId }) => connectionPairKey(sourceId, targetId)));
  const seen = new Set<string>();
  return result.suggestions.every(({ sourceId, targetId }) => {
    const key = connectionPairKey(sourceId, targetId);
    if (sourceId === targetId || !candidates.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
