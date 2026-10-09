import type { BoardMetadata, DashboardBoard } from "./board-directory";

export async function loadBoardContext(boardId: string): Promise<BoardMetadata | null> {
  const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/context`, { credentials: "include" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Board details are temporarily unavailable.");
  return await response.json() as BoardMetadata;
}

export async function joinBoardByLink(boardId: string): Promise<void> {
  const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/join`, {
    method: "POST", credentials: "include",
  });
  if (!response.ok) throw new Error("Board membership could not be saved.");
}

export async function loadDashboardBoards(signal?: AbortSignal): Promise<{ owned: DashboardBoard[]; shared: DashboardBoard[] }> {
  const response = await fetch("/api/boards", { credentials: "include", signal });
  if (response.status === 401) throw new Error("Sign in to view your boards.");
  if (!response.ok) throw new Error("Your boards could not be loaded.");
  return await response.json() as { owned: DashboardBoard[]; shared: DashboardBoard[] };
}
