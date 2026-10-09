import { boardHandlers } from "@/server/board-handlers";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: RouteContext<"/api/boards/[id]">) {
  const { id } = await context.params;
  return boardHandlers.delete(request, id);
}
