import { apiResponse } from "@/server/http";
import { getMongo } from "@/server/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return apiResponse(async () => {
    await getMongo().database.command({ ping: 1 });
    return Response.json({ status: "ok" });
  });
}
