import { aiErrorResponse } from "@/lib/ai";
import { clusterNamesRequestSchema } from "@/lib/cluster-contract";
import { suggestClusterNames } from "@/lib/cluster-naming";

export const runtime = "nodejs";
export const maxDuration = 95;
const MAX_REQUEST_BYTES = 250_000;

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "The naming request is too large." }, { status: 413 });
  }

  let text: string;
  try { text = await request.text(); }
  catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "The naming request is too large." }, { status: 413 });
  }

  let payload: unknown;
  try { payload = JSON.parse(text); }
  catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }
  const parsed = clusterNamesRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({
      error: "Provide 2 to 10 unique groups containing 2 to 50 unique, nonempty notes and valid representative IDs.",
    }, { status: 400 });
  }

  try {
    return Response.json(await suggestClusterNames(parsed.data));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
