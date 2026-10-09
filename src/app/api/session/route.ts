import { getAuth } from "@/server/auth";
import { apiResponse } from "@/server/http";

export const runtime = "nodejs";

export function GET(request: Request) {
  return apiResponse(async () => {
    const session = await getAuth().api.getSession({ headers: request.headers });
    return Response.json({ user: session?.user ?? null });
  });
}
