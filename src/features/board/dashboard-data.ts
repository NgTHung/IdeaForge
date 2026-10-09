import type { DashboardBoard } from "@/lib/board-directory";

export type DashboardSort = "edited" | "name" | "created";

export function dashboardBoardTitle(board: DashboardBoard) {
  return typeof board.title === "string" && board.title.trim()
    ? board.title
    : "Untitled board";
}

export function dashboardBoardDescription(board: DashboardBoard) {
  return typeof board.description === "string" ? board.description.trim() : "";
}

export function dashboardBoardMatches(board: DashboardBoard, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return !normalizedQuery || `${dashboardBoardTitle(board)}\n${dashboardBoardDescription(board)}`
    .toLocaleLowerCase()
    .includes(normalizedQuery);
}

export function sortDashboardBoards(items: DashboardBoard[], sort: DashboardSort) {
  return [...items].sort((left, right) => {
    if (sort === "name") return dashboardBoardTitle(left).localeCompare(dashboardBoardTitle(right));
    if (sort === "created") return new Date(right.createdAt).valueOf() - new Date(left.createdAt).valueOf();
    return new Date(right.updatedAt).valueOf() - new Date(left.updatedAt).valueOf();
  });
}

export function mostRecentlyEditedBoard(items: DashboardBoard[]) {
  return [...items].sort((left, right) =>
    new Date(right.updatedAt).valueOf() - new Date(left.updatedAt).valueOf(),
  )[0] ?? null;
}
