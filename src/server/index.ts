import "dotenv/config";
import cors from "cors";
import express from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { Liveblocks } from "@liveblocks/node";
import { auth } from "./auth";
import { createBoardDirectoryRouter } from "./board-directory-router";
import { env } from "./env";
import { connectMongo, database, mongoClient } from "./mongodb";

const app = express();
const liveblocks = process.env.LIVEBLOCKS_SECRET_KEY
  ? new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY })
  : null;

app.use(cors({ origin: env.APP_ORIGIN, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "1mb" }));
app.use("/api/boards", createBoardDirectoryRouter({
  database,
  appOrigin: env.APP_ORIGIN,
  deleteRoom: liveblocks ? (roomId) => liveblocks.deleteRoom(roomId) : undefined,
  getSession: (request) => auth.api.getSession({ headers: fromNodeHeaders(request.headers) }),
}));

app.get("/healthz", async (_request, response) => {
  await database.command({ ping: 1 });
  response.json({ status: "ok" });
});

app.get("/api/session", async (request, response, next) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    response.json({ user: session?.user ?? null });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (response.headersSent) return next(error);
  console.error("API request failed");
  response.status(500).json({ error: "The request could not be completed." });
});

async function start() {
  await connectMongo();
  const server = app.listen(env.API_PORT, () => {
    console.info(`IdeaForge API listening on port ${env.API_PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      void mongoClient.close().finally(() => process.exit(0));
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error.";
  const safeMessage = message.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, "$1[redacted]@");
  console.error(`Could not start the IdeaForge API: ${safeMessage}`);
  await mongoClient.close();
  process.exitCode = 1;
});
