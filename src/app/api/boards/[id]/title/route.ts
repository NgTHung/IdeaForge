import { boardHandlers } from "@/server/board-handlers";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/boards/[id]/title">) {
  const { id } = await context.params;
  return boardHandlers.title(request, id);
}
