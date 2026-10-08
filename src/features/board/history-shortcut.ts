export type HistoryShortcutInput = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode: number;
  targetIsEditable: boolean;
};

export function historyShortcut(input: HistoryShortcutInput): "undo" | "redo" | null {
  if (input.isComposing || input.keyCode === 229 || input.targetIsEditable) return null;
  const key = input.key.toLowerCase();
  if ((input.ctrlKey || input.metaKey) && key === "z") return input.shiftKey ? "redo" : "undo";
  if (input.ctrlKey && !input.metaKey && key === "y") return "redo";
  return null;
}
