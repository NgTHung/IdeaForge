import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { boardIdSchema } from "@/lib/rooms";
import { boardMetadataSchema, createBoardSchema, type BoardMetadata } from "@/lib/board-directory";
import { apiResponse, HttpError, readJson, requireOrigin } from "./http";

export type BoardDocument = {
  id: string;
  title: string;
  description: string;
  starterIdeas?: true;
  starterIdeasJob?: {
    status: "pending" | "running" | "failed" | "completed";
    attemptId?: string;
    leaseUntil?: Date;
  };
  ownerId: string;
  liveblocksRoomId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MembershipDocument = {
  boardId: string;
  userId: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: Date;
};

function metadataView(board: BoardDocument): BoardMetadata {
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    ...(board.starterIdeas ? { starterIdeas: true as const } : {}),
    liveblocksRoomId: board.liveblocksRoomId,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

function parseBoardId(value: string) {
  const id = boardIdSchema.safeParse(value);
  if (!id.success) throw new HttpError(400, "Invalid board ID.");
  return id.data;
}

export function createBoardDirectoryHandlers({ getDatabase, getSession, getAppOrigin, deleteRoom }: {
  getDatabase: () => Db;
  getSession: (request: Request) => Promise<{ user?: { id?: string } } | null>;
  getAppOrigin: () => string;
  deleteRoom?: (roomId: string) => Promise<void>;
}) {
  let indexesReady: Promise<void> | undefined;

  async function collections() {
    const database = getDatabase();
    const boards = database.collection<BoardDocument>("boards");
    const memberships = database.collection<MembershipDocument>("boardMemberships");
    indexesReady ??= Promise.all([
      boards.createIndex({ id: 1 }, { unique: true }),
      boards.createIndex({ liveblocksRoomId: 1 }, { unique: true }),
      boards.createIndex({ ownerId: 1, createdAt: -1 }),
      memberships.createIndex({ boardId: 1, userId: 1 }, { unique: true }),
      memberships.createIndex({ userId: 1, joinedAt: -1 }),
    ]).then(() => undefined).catch((error: unknown) => {
      indexesReady = undefined;
      throw error;
    });
    await indexesReady;
    return { boards, memberships };
  }

  async function signedInUser(request: Request, message: string) {
    const userId = (await getSession(request))?.user?.id;
    if (typeof userId !== "string" || !userId) throw new HttpError(401, message);
    return userId;
  }

  return {
    list: (request: Request) => apiResponse(async () => {
      const userId = await signedInUser(request, "Sign in to view your boards.");
      const { boards, memberships } = await collections();
      const [ownedDocs, memberDocs] = await Promise.all([
        boards.find({ ownerId: userId }).sort({ createdAt: -1 }).toArray(),
        memberships.find({ userId, role: { $in: ["editor", "viewer"] } }).toArray(),
      ]);
      const sharedIds = [...new Set(memberDocs.map((membership) => membership.boardId))];
      const sharedDocs = sharedIds.length
        ? await boards.find({ id: { $in: sharedIds }, ownerId: { $ne: userId } }).toArray()
        : [];
      const memberByBoardId = new Map(memberDocs.map((membership) => [membership.boardId, membership]));
      return Response.json({
        owned: ownedDocs.map((board) => ({ ...metadataView(board), role: "owner" as const })),
        shared: sharedDocs.map((board) => {
          const membership = memberByBoardId.get(board.id)!;
          return { ...metadataView(board), role: membership.role, joinedAt: membership.joinedAt.toISOString() };
        }),
      });
    }),

    create: (request: Request) => apiResponse(async () => {
      requireOrigin(request, getAppOrigin());
      const userId = await signedInUser(request, "Sign in before creating a board.");
      const parsed = createBoardSchema.safeParse(await readJson(request));
      if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Check the board details and try again.");
      const { boards, memberships } = await collections();
      const id = randomUUID();
      const now = new Date();
      const board: BoardDocument = {
        id,
        title: parsed.data.title,
        description: parsed.data.description,
        starterIdeas: true,
        starterIdeasJob: { status: "pending" },
        ownerId: userId,
        liveblocksRoomId: `ideaforge:${id}`,
        createdAt: now,
        updatedAt: now,
      };
      await boards.insertOne(board);
      try {
        await memberships.insertOne({ boardId: id, userId, role: "owner", joinedAt: now });
      } catch (error) {
        await boards.deleteOne({ id });
        throw error;
      }
      return Response.json(metadataView(board), { status: 201 });
    }),

    join: (request: Request, value: string) => apiResponse(async () => {
      requireOrigin(request, getAppOrigin());
      const userId = await signedInUser(request, "Sign in to add this board to your dashboard.");
      const id = parseBoardId(value);
      const { boards, memberships } = await collections();
      const board = await boards.findOne({ id });
      if (!board) throw new HttpError(404, "Board metadata was not found.");
      if (board.ownerId !== userId) {
        await memberships.updateOne({ boardId: id, userId }, {
          $setOnInsert: { boardId: id, userId, role: "editor", joinedAt: new Date() },
        }, { upsert: true });
      }
      return new Response(null, { status: 204 });
    }),

    delete: (request: Request, value: string) => apiResponse(async () => {
      requireOrigin(request, getAppOrigin());
      const userId = await signedInUser(request, "Sign in before deleting a board.");
      const id = parseBoardId(value);
      const { boards, memberships } = await collections();
      const board = await boards.findOne({ id, ownerId: userId });
      if (!board) throw new HttpError(404, "This board is no longer available.");
      if (!deleteRoom) throw new HttpError(503, "Board deletion is temporarily unavailable.");

      try {
        await deleteRoom(board.liveblocksRoomId);
      } catch (error) {
        const roomWasAlreadyDeleted = typeof error === "object" && error !== null && "status" in error && error.status === 404;
        if (!roomWasAlreadyDeleted) throw error;
      }

      await memberships.deleteMany({ boardId: id });
      const result = await boards.deleteOne({ id, ownerId: userId });
      if (!result.deletedCount) throw new HttpError(404, "This board is no longer available.");
      return new Response(null, { status: 204 });
    }),

    // UUIDs grant link access to metadata as well as the Liveblocks room.
    context: (request: Request, value: string) => apiResponse(async () => {
      const id = parseBoardId(value);
      const { boards } = await collections();
      const board = await boards.findOne({ id });
      if (!board) throw new HttpError(404, "Board metadata was not found.");
      const userId = (await getSession(request))?.user?.id;
      return Response.json({ ...metadataView(board),
        ...(board.starterIdeas && userId === board.ownerId ? { canGenerateStarterIdeas: true } : {}),
      });
    }),

    title: (request: Request, value: string) => apiResponse(async () => {
      requireOrigin(request, getAppOrigin());
      const id = parseBoardId(value);
      const payload = await readJson(request);
      const parsed = boardMetadataSchema.safeParse(payload);
      if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Enter valid board details.");
      const { boards } = await collections();
      const result = await boards.updateOne({ id }, { $set: { ...parsed.data, updatedAt: new Date() } });
      if (!result.matchedCount) throw new HttpError(404, "Board metadata was not found.");
      return new Response(null, { status: 204 });
    }),
  };
}
