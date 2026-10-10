import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { z } from "zod";
import { aiErrorResponse } from "@/lib/ai";
import { boardIdSchema } from "@/lib/rooms";
import { starterIdeasResponseSchema } from "@/lib/starter-ideas-contract";
import { apiResponse, HttpError, readJson, requireOrigin } from "./http";
import type { BoardDocument } from "./board-directory";
import { generateStarterIdeas } from "@/lib/starter-ideas";

const finishSchema = z.object({ attemptId: z.uuid(), status: z.enum(["completed", "failed"]) }).strict();
const leaseMs = 4 * 60 * 1000;

export function createBoardStarterIdeasHandlers({ getDatabase, getSession, getAppOrigin, generate = generateStarterIdeas }: {
  getDatabase: () => Db;
  getSession: (request: Request) => Promise<{ user?: { id?: string } } | null>;
  getAppOrigin: () => string;
  generate?: typeof generateStarterIdeas;
}) {
  async function authorizedBoard(request: Request, value: string) {
    requireOrigin(request, getAppOrigin());
    const id = boardIdSchema.safeParse(value);
    if (!id.success) throw new HttpError(400, "Invalid board ID.");
    const userId = (await getSession(request))?.user?.id;
    if (!userId) throw new HttpError(401, "Sign in to generate starting ideas.");
    const boards = getDatabase().collection<BoardDocument>("boards");
    const board = await boards.findOne({ id: id.data, ownerId: userId, starterIdeas: true });
    if (!board) throw new HttpError(404, "This board is not available for starting ideas.");
    return { boards, board, userId };
  }

  return {
    generate: (request: Request, value: string) => apiResponse(async () => {
      const { boards, board, userId } = await authorizedBoard(request, value);
      const attemptId = randomUUID();
      const claimed = await boards.findOneAndUpdate({
        id: board.id, ownerId: userId, starterIdeas: true,
        $or: [
          { "starterIdeasJob.status": "pending" },
          { "starterIdeasJob.status": "failed" },
          { "starterIdeasJob.status": "running", "starterIdeasJob.leaseUntil": { $lt: new Date() } },
        ],
      }, { $set: { starterIdeasJob: { status: "running", attemptId, leaseUntil: new Date(Date.now() + leaseMs) } } },
      { returnDocument: "after" });
      if (!claimed) {
        if (board.starterIdeasJob?.status === "completed") {
          return Response.json({ code: "already_completed", error: "Starting ideas were already generated for this board." }, { status: 409 });
        }
        return Response.json({ code: "in_progress", error: "Starting ideas are already being generated." }, { status: 409 });
      }
      try {
        const generated = await generate(claimed.title, claimed.description);
        const current = await boards.findOne({ id: board.id, ownerId: userId, starterIdeas: true });
        if (!current || current.title !== claimed.title || current.description !== claimed.description ||
          current.starterIdeasJob?.attemptId !== attemptId) {
          throw new HttpError(409, "The board details changed. Try generating ideas again.");
        }
        const result = starterIdeasResponseSchema.parse({
          attemptId, title: claimed.title, description: claimed.description,
          ...generated, generatedAt: new Date().toISOString(),
        });
        return Response.json(result);
      } catch (error) {
        await boards.updateOne({ id: board.id, "starterIdeasJob.attemptId": attemptId },
          { $set: { starterIdeasJob: { status: "failed" } } });
        if (error instanceof HttpError) throw error;
        return aiErrorResponse(error);
      }
    }),
    finish: (request: Request, value: string) => apiResponse(async () => {
      const { boards, board, userId } = await authorizedBoard(request, value);
      const parsed = finishSchema.safeParse(await readJson(request));
      if (!parsed.success) throw new HttpError(400, "Provide a valid generation attempt and status.");
      const result = await boards.updateOne({
        id: board.id, ownerId: userId, "starterIdeasJob.status": "running",
        "starterIdeasJob.attemptId": parsed.data.attemptId,
      }, { $set: { starterIdeasJob: { status: parsed.data.status, attemptId: parsed.data.attemptId } } });
      if (!result.matchedCount && !(board.starterIdeasJob?.attemptId === parsed.data.attemptId &&
        board.starterIdeasJob.status === parsed.data.status)) {
        throw new HttpError(409, "This generation attempt is no longer active.");
      }
      return new Response(null, { status: 204 });
    }),
  };
}
