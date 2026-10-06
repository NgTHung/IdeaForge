import { aiErrorResponse } from "@/lib/ai";
import { calculateClusters } from "@/lib/clustering";
import { clusterRequestSchema } from "@/lib/cluster-contract";

export const runtime = "nodejs";
export const maxDuration = 95;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Send valid JSON." }, { status: 400 });
  }

  const parsed = clusterRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({
      error: "Provide 2 to 50 cards with unique IDs, nonempty text up to 4,000 characters, and a group count from 2 to 10 that does not exceed the card count.",
    }, { status: 400 });
  }

  try {
    return Response.json(await calculateClusters(parsed.data.cards, parsed.data.clusterCount));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
