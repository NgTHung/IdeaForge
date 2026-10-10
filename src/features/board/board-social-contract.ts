import { z } from "zod";
import type { Board } from "./model";

export const reactions = { heart: "❤️", clap: "👏", spark: "✨", laugh: "😂", think: "🤔", celebrate: "🎉" } as const;
export const stickerCatalog = {
  star: { glyph: "⭐", label: "Star" }, heart: { glyph: "💗", label: "Heart" },
  cat: { glyph: "🐈", label: "Cat" }, flower: { glyph: "🌼", label: "Flower" },
  cloud: { glyph: "☁️", label: "Cloud" }, rainbow: { glyph: "🌈", label: "Rainbow" },
  spark: { glyph: "⚡", label: "First spark" }, combo: { glyph: "🧩", label: "Unexpected combo" },
  gardener: { glyph: "🌱", label: "Idea gardener" },
} as const;
export type StickerKind = keyof typeof stickerCatalog;
const positionSchema = z.object({ x: z.number().finite().min(-100000).max(100000), y: z.number().finite().min(-100000).max(100000) });
const signalBase = { id: z.string().min(1).max(100), position: positionSchema };
export const socialSignalSchema = z.discriminatedUnion("kind", [
  z.object({ ...signalBase, kind: z.literal("reaction"), value: z.enum(["heart", "clap", "spark", "laugh", "think", "celebrate"]) }),
  z.object({ ...signalBase, kind: z.literal("chat"), value: z.string().trim().min(1).max(140) }),
]);
export type SocialSignal = z.infer<typeof socialSignalSchema>;
export type NamedSignal = SocialSignal & { name: string; connectionId: number; expiresAt: number };
export function signalLifetime(signal: SocialSignal) { return signal.kind === "chat" ? 6000 : 3000; }
export function appendSignal(current: NamedSignal[], signal: NamedSignal, now: number): NamedSignal[] {
  const active = current.filter((item) => item.expiresAt > now);
  if (active.some((item) => item.id === signal.id && item.connectionId === signal.connectionId)) return active;
  return [...active.slice(-19), signal];
}
export const decorationSchema = z.object({
  id: z.string().min(1).max(100), kind: z.enum(["star", "heart", "cat", "flower", "cloud", "rainbow", "spark", "combo", "gardener"]),
  position: positionSchema, author: z.string().trim().min(1).max(100),
});
export type BoardDecoration = z.infer<typeof decorationSchema>;
export function addDecoration(board: Board, input: BoardDecoration): Board {
  const result = decorationSchema.safeParse(input);
  if (!result.success || (board.decorations?.length ?? 0) >= 200 || board.decorations?.some((item) => item.id === result.data.id)) return board;
  return { ...board, decorations: [...board.decorations ?? [], result.data] };
}
export function moveDecoration(board: Board, id: string, position: BoardDecoration["position"]): Board {
  const result = positionSchema.safeParse(position);
  const existing = board.decorations?.find((item) => item.id === id);
  if (!result.success || !existing || existing.position.x === result.data.x && existing.position.y === result.data.y) return board;
  return { ...board, decorations: board.decorations?.map((item) => item.id === id ? { ...item, position: result.data } : item) };
}
export function removeDecoration(board: Board, id: string): Board {
  if (!board.decorations?.some((item) => item.id === id)) return board;
  return { ...board, decorations: board.decorations.filter((item) => item.id !== id) };
}
export function canOpenCursorChat(target: Element | null, blocked: boolean): boolean {
  return !blocked && !target?.closest("input,textarea,select,button,a,summary,[role='dialog'],[role='group'],[role='button'],[contenteditable]:not([contenteditable='false'])");
}
