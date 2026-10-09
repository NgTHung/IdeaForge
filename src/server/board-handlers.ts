import "server-only";
import { Liveblocks } from "@liveblocks/node";
import { getAuth } from "./auth";
import { createBoardDirectoryHandlers } from "./board-directory";
import { getServerEnv } from "./env";
import { HttpError } from "./http";
import { getMongo } from "./mongodb";

export const boardHandlers = createBoardDirectoryHandlers({
  getDatabase: () => getMongo().database,
  getAppOrigin: () => getServerEnv().APP_ORIGIN,
  getSession: (request) => getAuth().api.getSession({ headers: request.headers }),
  deleteRoom: async (roomId) => {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) throw new HttpError(503, "Board deletion is temporarily unavailable.");
    await new Liveblocks({ secret }).deleteRoom(roomId);
  },
});
