import { getAuth } from "@/server/auth";
import { getServerEnv } from "@/server/env";
import { getMongo } from "@/server/mongodb";
import { createBoardStarterIdeasHandlers } from "@/server/board-starter-ideas";

export const runtime = "nodejs";
export const maxDuration = 195;

const handlers = createBoardStarterIdeasHandlers({
  getDatabase: () => getMongo().database,
  getAppOrigin: () => getServerEnv().APP_ORIGIN,
  getSession: (request) => getAuth().api.getSession({ headers: request.headers }),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handlers.generate(request, (await context.params).id);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handlers.finish(request, (await context.params).id);
}
