import { boardHandlers } from "@/server/board-handlers";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/boards/[id]/context">) {
  const { id } = await context.params;
  return boardHandlers.context(request, id);
}
