import { aiErrorResponse } from "@/lib/ai";
import { calculateClusterAssignment } from "@/lib/cluster-assignment-service";
import { clusterAssignmentRequestSchema } from "@/lib/cluster-contract";

export const runtime = "nodejs";
export const maxDuration = 95;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Send valid JSON." }, { status: 400 });
  }

  const parsed = clusterAssignmentRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({
      error: "Provide one new note and 2 to 10 existing groups with unique notes, nonempty text up to 4,000 characters, and no more than 50 notes in total.",
    }, { status: 400 });
  }

  try {
    return Response.json(await calculateClusterAssignment(parsed.data));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
