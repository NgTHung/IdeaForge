import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import type { Db } from "mongodb";
import { boardIdSchema } from "@/lib/rooms";
import { boardTitleSchema, createBoardSchema, type BoardMetadata } from "@/lib/board-directory";

type SessionReader = (request: Request) => Promise<{ user?: { id?: string } } | null>;

type BoardDocument = {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  liveblocksRoomId: string;
  createdAt: Date;
  updatedAt: Date;
};

type MembershipDocument = {
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
    liveblocksRoomId: board.liveblocksRoomId,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

function sameOrigin(request: Request, allowedOrigin: string): boolean {
  return request.get("origin") === allowedOrigin;
}

export function createBoardDirectoryRouter({ database, getSession, appOrigin, deleteRoom }: {
  database: Db;
  getSession: SessionReader;
  appOrigin: string;
  deleteRoom?: (roomId: string) => Promise<void>;
}) {
  const router = Router();
  const boards = database.collection<BoardDocument>("boards");
  const memberships = database.collection<MembershipDocument>("boardMemberships");
  let indexesReady: Promise<void> | undefined;

  function ensureIndexes() {
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
    return indexesReady;
  }

  async function signedInUser(request: Request) {
    const session = await getSession(request);
    const userId = session?.user?.id;
    return typeof userId === "string" && userId ? userId : null;
  }

  router.get("/", (request, response, next) => {
    void (async () => {
      const userId = await signedInUser(request);
      if (!userId) { response.status(401).json({ error: "Sign in to view your boards." }); return; }
      await ensureIndexes();
      const [ownedDocs, memberDocs] = await Promise.all([
        boards.find({ ownerId: userId }).sort({ createdAt: -1 }).toArray(),
        memberships.find({ userId, role: { $in: ["editor", "viewer"] } }).toArray(),
      ]);
      const sharedIds = [...new Set(memberDocs.map((membership) => membership.boardId))];
      const sharedDocs = sharedIds.length
        ? await boards.find({ id: { $in: sharedIds }, ownerId: { $ne: userId } }).toArray()
        : [];
      const memberByBoardId = new Map(memberDocs.map((membership) => [membership.boardId, membership]));
      response.json({
        owned: ownedDocs.map((board) => ({ ...metadataView(board), role: "owner" as const })),
        shared: sharedDocs.map((board) => {
          const membership = memberByBoardId.get(board.id)!;
          return { ...metadataView(board), role: membership.role, joinedAt: membership.joinedAt.toISOString() };
        }),
      });
    })().catch(next);
  });

  router.post("/", (request, response, next) => {
    void (async () => {
      if (!sameOrigin(request, appOrigin)) { response.status(403).json({ error: "This request is not allowed." }); return; }
      const userId = await signedInUser(request);
      if (!userId) { response.status(401).json({ error: "Sign in before creating a board." }); return; }
      const parsed = createBoardSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the board details and try again." });
        return;
      }
      await ensureIndexes();
      const id = randomUUID();
      const now = new Date();
      const board: BoardDocument = {
        id,
        title: parsed.data.title,
        description: parsed.data.description,
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
      response.status(201).json(metadataView(board));
    })().catch(next);
  });

  router.post("/:id/join", (request, response, next) => {
    void (async () => {
      if (!sameOrigin(request, appOrigin)) { response.status(403).json({ error: "This request is not allowed." }); return; }
      const userId = await signedInUser(request);
      if (!userId) { response.status(401).json({ error: "Sign in to add this board to your dashboard." }); return; }
      const id = boardIdSchema.safeParse(request.params.id);
      if (!id.success) { response.status(400).json({ error: "Invalid board ID." }); return; }
      await ensureIndexes();
      const board = await boards.findOne({ id: id.data });
      if (!board) { response.status(404).json({ error: "Board metadata was not found." }); return; }
      if (board.ownerId !== userId && !await memberships.findOne({ boardId: id.data, userId })) {
        await memberships.insertOne({ boardId: id.data, userId, role: "editor", joinedAt: new Date() });
      }
      response.status(204).end();
    })().catch(next);
  });

  // Board UUIDs are bearer links today. This context read keeps that link policy intact.
  router.get("/:id/context", (request, response, next) => {
    void (async () => {
      const id = boardIdSchema.safeParse(request.params.id);
      if (!id.success) { response.status(400).json({ error: "Invalid board ID." }); return; }
      await ensureIndexes();
      const board = await boards.findOne({ id: id.data });
      if (!board) { response.status(404).json({ error: "Board metadata was not found." }); return; }
      response.json(metadataView(board));
    })().catch(next);
  });

  // Title edits already follow the public room-link policy; only board metadata is changed here.
  router.patch("/:id/title", (request, response, next) => {
    void (async () => {
      if (!sameOrigin(request, appOrigin)) { response.status(403).json({ error: "This request is not allowed." }); return; }
      const id = boardIdSchema.safeParse(request.params.id);
      if (!id.success) { response.status(400).json({ error: "Invalid board ID." }); return; }
      const parsed = boardTitleSchema.safeParse((request.body as { title?: unknown } | null)?.title);
      if (!parsed.success) { response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Enter a valid title." }); return; }
      await ensureIndexes();
      const result = await boards.updateOne({ id: id.data }, { $set: { title: parsed.data, updatedAt: new Date() } });
      if (!result.matchedCount) { response.status(404).json({ error: "Board metadata was not found." }); return; }
      response.status(204).end();
    })().catch(next);
  });

  router.delete("/:id", (request, response, next) => {
    void (async () => {
      if (!sameOrigin(request, appOrigin)) { response.status(403).json({ error: "This request is not allowed." }); return; }
      const userId = await signedInUser(request);
      if (!userId) { response.status(401).json({ error: "Sign in before deleting a board." }); return; }
      const id = boardIdSchema.safeParse(request.params.id);
      if (!id.success) { response.status(400).json({ error: "Invalid board ID." }); return; }
      await ensureIndexes();
      const board = await boards.findOne({ id: id.data, ownerId: userId });
      if (!board) { response.status(404).json({ error: "This board is no longer available." }); return; }
      if (!deleteRoom) { response.status(503).json({ error: "Board deletion is temporarily unavailable." }); return; }

      try {
        await deleteRoom(board.liveblocksRoomId);
      } catch (error) {
        const roomWasAlreadyDeleted = typeof error === "object" && error !== null && "status" in error && error.status === 404;
        if (!roomWasAlreadyDeleted) throw error;
      }

      await memberships.deleteMany({ boardId: id.data });
      const result = await boards.deleteOne({ id: id.data, ownerId: userId });
      if (!result.deletedCount) { response.status(404).json({ error: "This board is no longer available." }); return; }
      response.status(204).end();
    })().catch(next);
  });

  return router;
}

export type { BoardDocument, MembershipDocument };
