import type { Board } from "./model";
import { MAX_IDEA_DESCRIPTION_REQUEST_BYTES } from "../../lib/idea-description-contract.ts";

export type IdeaDescriptionRequestState = {
  ideaId: string;
  title: string;
  content: string;
  goal: string;
  boardTitle: string;
  boardDescription?: string;
  seedContent?: string;
  clusterLabel?: string;
  token: number;
};

export type IdeaDescriptionContext = Pick<IdeaDescriptionRequestState,
  "goal" | "boardTitle" | "boardDescription" | "seedContent" | "clusterLabel">;

export function fitIdeaDescriptionContext(title: string, context: IdeaDescriptionContext): IdeaDescriptionContext {
  const fitted = { ...context };
  const byteLength = () => new TextEncoder().encode(JSON.stringify({ title, ...fitted })).byteLength;
  for (const field of ["clusterLabel", "boardDescription", "seedContent"] as const) {
    if (byteLength() <= MAX_IDEA_DESCRIPTION_REQUEST_BYTES) break;
    const value = fitted[field];
    if (!value) continue;
    const characters = Array.from(value);
    let lower = 0;
    let upper = characters.length;
    while (lower < upper) {
      const middle = Math.ceil((lower + upper) / 2);
      fitted[field] = characters.slice(0, middle).join("").trimEnd();
      if (byteLength() <= MAX_IDEA_DESCRIPTION_REQUEST_BYTES) lower = middle;
      else upper = middle - 1;
    }
    if (lower === 0) delete fitted[field];
    else fitted[field] = characters.slice(0, lower).join("").trimEnd();
  }
  return fitted;
}

export function ideaDescriptionGoal(board: Pick<Board, "goal">, boardTitle: string): string {
  return board.goal?.trim() || boardTitle.trim();
}

export function canFillEditorDescription(
  editor: { id: string; title: string; content: string } | null,
  request: IdeaDescriptionRequestState,
  activeToken: number | undefined,
  currentContext: IdeaDescriptionContext,
  canWrite: boolean,
): boolean {
  if (!canWrite || activeToken !== request.token ||
    request.goal !== currentContext.goal || request.boardTitle !== currentContext.boardTitle ||
    request.boardDescription !== currentContext.boardDescription || request.seedContent !== currentContext.seedContent ||
    request.clusterLabel !== currentContext.clusterLabel) return false;
  return Boolean(editor && editor.id === request.ideaId &&
    editor.title.trim() === request.title && editor.content === request.content);
}

export function canRequestIdeaDescription(title: string): boolean {
  const trimmed = title.trim();
  return Boolean(trimmed && trimmed.length <= 120 && trimmed.toLocaleLowerCase() !== "new idea");
}
