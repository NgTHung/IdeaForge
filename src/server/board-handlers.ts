import "server-only";
import { getAuth } from "./auth";
import { createBoardDirectoryHandlers } from "./board-directory";
import { getServerEnv } from "./env";
import { getMongo } from "./mongodb";

export const boardHandlers = createBoardDirectoryHandlers({
  getDatabase: () => getMongo().database,
  getAppOrigin: () => getServerEnv().APP_ORIGIN,
  getSession: (request) => getAuth().api.getSession({ headers: request.headers }),
});
