import { aiErrorResponse } from "@/lib/ai";
import { generateIdeaDescription } from "@/lib/idea-description";
import { ideaDescriptionRequestSchema, ideaDescriptionResponseSchema, MAX_IDEA_DESCRIPTION_REQUEST_BYTES } from "@/lib/idea-description-contract";

export const runtime = "nodejs";
export const maxDuration = 95;

async function readBoundedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_IDEA_DESCRIPTION_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IDEA_DESCRIPTION_REQUEST_BYTES) {
    return Response.json({ error: "The description request is too large." }, { status: 413 });
  }

  let text: string | null;
  try { text = await readBoundedBody(request); }
  catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }
  if (text === null) {
    return Response.json({ error: "The description request is too large." }, { status: 413 });
  }

  let payload: unknown;
  try { payload = JSON.parse(text); }
  catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }
  const parsed = ideaDescriptionRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Provide a title, board goal, and board title within the allowed lengths." }, { status: 400 });
  }

  try {
    const result = await generateIdeaDescription(parsed.data);
    const response = ideaDescriptionResponseSchema.parse({ ...result, generatedAt: new Date().toISOString() });
    return Response.json(response);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
