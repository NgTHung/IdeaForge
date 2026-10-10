import type { Board, Idea } from "./model";
import type { NamedSignal } from "./board-social-contract";

export type CanvasPoint = { x: number; y: number };
export function displayIdeas(ideas: Idea[], positions: Record<string, CanvasPoint>): Idea[] {
  return ideas.map((idea) => positions[idea.id] && !idea.pinned ? { ...idea, position: positions[idea.id] } : idea);
}
export function signalPosition(signal: NamedSignal, positions: Record<number, CanvasPoint>): CanvasPoint {
  return signal.kind === "chat" ? positions[signal.connectionId] ?? signal.position : signal.position;
}
export function canDragIdea(board: Board, id: string, canWrite: boolean): boolean {
  const idea = board.ideas.find((item) => item.id === id);
  return canWrite && Boolean(idea && !idea.pinned);
}
export function reactionShortcut(input: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; isComposing: boolean; repeat: boolean; blocked: boolean }): boolean {
  return input.key.toLowerCase() === "r" && !input.ctrlKey && !input.metaKey && !input.altKey && !input.shiftKey && !input.isComposing && !input.repeat && !input.blocked;
}
