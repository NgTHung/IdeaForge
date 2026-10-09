import { boardHandlers } from "@/server/board-handlers";

export const runtime = "nodejs";
export const GET = boardHandlers.list;
export const POST = boardHandlers.create;
