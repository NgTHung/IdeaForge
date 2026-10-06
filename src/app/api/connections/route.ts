import { aiErrorResponse } from "@/lib/ai";
import { connectionRequestSchema } from "@/lib/connections";
import { suggestConnections } from "@/lib/connection-suggestions";

export const runtime = "nodejs";
// Similarity can re-embed after a cache/model mismatch, followed by generation.
// Allow all three calls to use the shared retry and fallback policy.
export const maxDuration = 285;

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }
  const parsed = connectionRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Provide a goal up to 500 characters, 2 to 50 unique cards with nonempty text up to 4,000 characters, and existing links between those cards." }, { status: 400 });
  }
  try {
    return Response.json({ result: await suggestConnections(parsed.data) });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
