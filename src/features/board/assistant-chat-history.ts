export type AssistantChatTurn =
  | { role: "user"; text: string; completed: boolean }
  | { role: "assistant"; text: string };

export function assistantHistoryFor(turns: AssistantChatTurn[]): { role: "user" | "assistant"; text: string }[] {
  return turns.filter((turn) => turn.role === "assistant" || turn.completed)
    .map(({ role, text }) => ({ role, text }))
    .filter(({ text }) => text.trim())
    .slice(-10);
}
