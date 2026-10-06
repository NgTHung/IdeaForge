import { aiErrorResponse } from "@/lib/ai";
import { calculateSimilarity, compareSimilarityMethods, similarityRequestSchema } from "@/lib/similarity";

export const runtime = "nodejs";
export const maxDuration = 95;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Send valid JSON." }, { status: 400 });
  }

  const parsed = similarityRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({
      error: "Provide 2 to 50 cards with unique IDs and nonempty text up to 4,000 characters.",
    }, { status: 400 });
  }

  try {
    if (parsed.data.compareMethods) {
      return Response.json(await compareSimilarityMethods(parsed.data.cards));
    }
    return Response.json(await calculateSimilarity(parsed.data.cards));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
