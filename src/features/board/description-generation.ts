import type { Board, Idea } from "./model";

export type IdeaDescriptionRequestState = {
  ideaId: string;
  title: string;
  goal: string;
  token: number;
};

export function ideaDescriptionGoal(board: Pick<Board, "goal">, boardTitle: string): string {
  return board.goal?.trim() || boardTitle.trim();
}

export function canApplyIdeaDescription(
  board: Board,
  request: IdeaDescriptionRequestState,
  activeToken: number | undefined,
  currentGoal: string,
  canWrite: boolean,
): boolean {
  if (!canWrite || activeToken !== request.token || currentGoal !== request.goal) return false;
  const idea = board.ideas.find((candidate) => candidate.id === request.ideaId);
  return Boolean(idea && idea.title === request.title && !idea.content.trim());
}

export function isTitleOnlyIdea(idea: Pick<Idea, "title" | "content">): boolean {
  const title = idea.title.trim();
  return Boolean(title && !idea.content.trim() && title.toLocaleLowerCase() !== "new idea");
}
