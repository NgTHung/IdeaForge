import { boardHandlers } from "@/server/board-handlers";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/boards/[id]/join">) {
  const { id } = await context.params;
  return boardHandlers.join(request, id);
}
