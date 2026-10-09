import { z } from "zod";
import type { Board } from "./model";

export const palette = { mint: "#32856a", lavender: "#8066b3", peach: "#b35d46", blue: "#397aab", rose: "#af537e" } as const;
export const colorSchema = z.enum(["default", "mint", "lavender", "peach", "blue", "rose"]);
export const borderSchema = z.enum(["plain", "cat", "rainbow"]);
export const objectStyleSchema = z.object({ color: colorSchema, border: borderSchema });
export const relationshipStyleSchema = z.object({ color: colorSchema, stroke: z.enum(["solid", "dashed", "dotted"]) });
export const clusterStyleSchema = objectStyleSchema.extend({ boundary: z.boolean() });
export const cursorStyleSchema = z.object({ color: colorSchema, shape: z.enum(["dot", "arrow", "cat"]) });
export type ObjectStyle = z.infer<typeof objectStyleSchema>;
export type RelationshipStyle = z.infer<typeof relationshipStyleSchema>;
export type ClusterStyle = z.infer<typeof clusterStyleSchema>;
export type CursorStyle = z.infer<typeof cursorStyleSchema>;
export const effectLabels = { merge: "Merge celebrations", vote: "Upvote reactions", entrance: "Contributor entrances", thinking: "AI thinking", undo: "Undo time travel", milestone: "Team milestones", achievement: "Achievement stickers", share: "Share-link delivery", mood: "Board mood" } as const;
export type EffectKind = keyof typeof effectLabels;
const effectsSchema = z.object({ merge: z.boolean(), vote: z.boolean(), entrance: z.boolean(), thinking: z.boolean(), undo: z.boolean(), milestone: z.boolean(), achievement: z.boolean(), share: z.boolean(), mood: z.boolean() });
export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark"]), accent: colorSchema, background: z.enum(["plain", "dots", "grid"]),
  animations: z.boolean(), cursor: cursorStyleSchema, effects: effectsSchema,
  reaction: z.enum(["heart", "cat", "frog"]), thinking: z.enum(["hamster", "cat", "cauldron"]), milestone: z.enum(["confetti", "ducks"]),
});
export type Personalization = z.infer<typeof preferencesSchema>;
export const defaultPreferences: Personalization = {
  theme: "light", accent: "default", background: "dots", animations: true,
  cursor: { color: "default", shape: "dot" },
  effects: { merge: true, vote: true, entrance: true, thinking: true, undo: true, milestone: true, achievement: true, share: true, mood: true },
  reaction: "heart", thinking: "cauldron", milestone: "confetti",
};
export const defaultObjectStyle: ObjectStyle = { color: "default", border: "plain" };
export const defaultClusterStyle: ClusterStyle = { ...defaultObjectStyle, boundary: false };
export const defaultRelationshipStyle: RelationshipStyle = { color: "default", stroke: "solid" };
export function styleColor(color: z.infer<typeof colorSchema>) { return color === "default" ? undefined : palette[color]; }
export function parsePreferences(value: string | null, legacyTheme?: string | null): Personalization {
  try {
    const parsed = preferencesSchema.safeParse(value ? JSON.parse(value) : null);
    if (parsed.success) return parsed.data;
  } catch { /* A damaged browser preference uses the defaults. */ }
  return { ...defaultPreferences, theme: legacyTheme === "dark" ? "dark" : "light" };
}
export function setObjectAppearance(board: Board, kind: "idea" | "relationship" | "cluster", id: string, input: unknown): Board {
  if (kind === "idea") {
    const parsed = objectStyleSchema.safeParse(input);
    if (!parsed.success || !board.ideas.some((idea) => idea.id === id)) return board;
    return { ...board, ideas: board.ideas.map((idea) => idea.id === id ? { ...idea, appearance: parsed.data } : idea) };
  }
  if (kind === "relationship") {
    const parsed = relationshipStyleSchema.safeParse(input);
    if (!parsed.success || !board.relationships.some((link) => link.id === id)) return board;
    return { ...board, relationships: board.relationships.map((link) => link.id === id ? { ...link, appearance: parsed.data } : link) };
  }
  const parsed = clusterStyleSchema.safeParse(input);
  const snapshot = board.clusterSnapshot;
  if (!parsed.success || !snapshot?.result.groups.some((group) => group.id === id)) return board;
  return { ...board, clusterSnapshot: { ...snapshot, result: { ...snapshot.result,
    groups: snapshot.result.groups.map((group) => group.id === id ? { ...group, appearance: parsed.data } : group) } } };
}
export type AchievementLedger = { ideas: string[]; crossClusterMerge: boolean };
export const achievementLedgerSchema = z.object({ ideas: z.array(z.string()).max(1000), crossClusterMerge: z.boolean() });
export const emptyLedger: AchievementLedger = { ideas: [], crossClusterMerge: false };
export const achievementLabels = { spark: "First spark", combo: "Unexpected combo", gardener: "Idea gardener" } as const;
export function earnedAchievements(ledger: AchievementLedger) {
  return [ledger.ideas.length > 0 ? "spark" : null, ledger.crossClusterMerge ? "combo" : null, ledger.ideas.length >= 5 ? "gardener" : null].filter((value): value is keyof typeof achievementLabels => value !== null);
}
export function recordContribution(ledger: AchievementLedger, ideaId: string, board: Board, sources?: string[]): AchievementLedger {
  const groups = new Set(board.clusterSnapshot?.result.groups.filter((group) => sources?.some((id) => group.noteIds.includes(id))).map((group) => group.id));
  return { ideas: sources || ledger.ideas.includes(ideaId) ? ledger.ideas : [...ledger.ideas, ideaId].slice(-1000),
    crossClusterMerge: ledger.crossClusterMerge || Boolean(sources && groups.size > 1) };
}
export function boardMood(board: Board) { return board.ideas.some((idea) => idea.merge) ? "bloom" : board.ideas.length >= 10 ? "grown" : board.ideas.length ? "sprout" : "seed"; }
export type Milestone = "ten" | "merge";
export function reachedMilestones(board: Board): Milestone[] {
  return [...(board.ideas.length >= 10 ? ["ten" as const] : []), ...(board.ideas.some((idea) => idea.merge) ? ["merge" as const] : [])];
}
export function advanceMilestones(board: Board, previous: readonly Milestone[]) {
  const current = reachedMilestones(board);
  return { reached: [...new Set([...previous, ...current])], celebrate: current.filter((milestone) => !previous.includes(milestone)) };
}
