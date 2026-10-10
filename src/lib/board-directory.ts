import { z } from "zod";

export const BOARD_TITLE_MAX_LENGTH = 80;
export const BOARD_DESCRIPTION_MAX_LENGTH = 2_000;

export const boardTitleSchema = z.string().trim().min(1, "Enter a goal or topic.")
  .max(BOARD_TITLE_MAX_LENGTH, `Use ${BOARD_TITLE_MAX_LENGTH} characters or fewer.`);

export const boardDescriptionSchema = z.string().trim().max(
  BOARD_DESCRIPTION_MAX_LENGTH,
  `Use ${BOARD_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters or fewer.`,
).default("");

export const boardMetadataSchema = z.object({
  title: boardTitleSchema,
  description: boardDescriptionSchema,
}).strict();

export const createBoardSchema = boardMetadataSchema;

export type BoardMetadata = {
  id: string;
  title: string;
  description: string;
  starterIdeas?: true;
  canGenerateStarterIdeas?: true;
  liveblocksRoomId: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardBoard = BoardMetadata & {
  role: "owner" | "editor" | "viewer";
  joinedAt?: string;
};

export function safeReturnPath(candidate: string | null | undefined, fallback = "/"): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  try {
    const url = new URL(candidate, "https://ideaforge.invalid");
    if (url.origin !== "https://ideaforge.invalid" || url.pathname === "/login") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
