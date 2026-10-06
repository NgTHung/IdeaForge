import { aiErrorResponse } from "@/lib/ai";
import { embedSimilarityCards } from "@/lib/similarity";
import { fastApiClusterResponseSchema, similarityClusteringRequestSchema } from "@/lib/similarity-clustering";

export const runtime = "nodejs";
export const maxDuration = 95;

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "This development tool is unavailable." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Send valid JSON." }, { status: 400 });
  }

  const parsed = similarityClusteringRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Provide 2 to 50 cards, a group count from 2 to 10, and a valid distance method." }, { status: 400 });
  }
  const { cards, clusterCount, metric } = parsed.data;
  if (clusterCount > cards.length) {
    return Response.json({ error: "The group count cannot exceed the number of notes." }, { status: 400 });
  }

  const serviceBase = process.env.FASTAPI_CLUSTER_URL?.trim() || "http://127.0.0.1:8000";
  let serviceUrl: URL;
  try {
    serviceUrl = new URL("/clusters", serviceBase);
    if (serviceUrl.protocol !== "http:" && serviceUrl.protocol !== "https:") throw new TypeError("Use HTTP or HTTPS.");
  } catch {
    return Response.json({ error: "FASTAPI_CLUSTER_URL must be an HTTP or HTTPS URL." }, { status: 500 });
  }

  try {
    const health = await fetch(new URL("/health", serviceUrl), { signal: AbortSignal.timeout(3_000) });
    if (!health.ok) throw new Error("unhealthy");
  } catch {
    return Response.json({
      error: "The FastAPI clustering service is unavailable. Start it with `npm run cluster:dev`.",
    }, { status: 503 });
  }

  let embeddings: Awaited<ReturnType<typeof embedSimilarityCards>>;
  try {
    embeddings = await embedSimilarityCards(cards);
  } catch (error) {
    return aiErrorResponse(error);
  }

  let serviceResponse: Response;
  try {
    serviceResponse = await fetch(serviceUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notes: cards.map((card, index) => ({ id: card.id, vector: embeddings.vectors[index] })),
        cluster_count: clusterCount,
        metric,
        embedding_model: embeddings.model,
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json({
      error: timedOut
        ? "The clustering service took too long. Try again."
        : "The FastAPI clustering service is unavailable. Start it with `npm run cluster:dev`.",
    }, { status: timedOut ? 504 : 503 });
  }

  let servicePayload: unknown;
  try {
    servicePayload = await serviceResponse.json();
  } catch {
    return Response.json({ error: "The clustering service returned invalid JSON." }, { status: 502 });
  }
  if (!serviceResponse.ok) {
    const detail = typeof servicePayload === "object" && servicePayload && "detail" in servicePayload
      ? servicePayload.detail
      : undefined;
    const insufficientDistinctNotes = typeof detail === "string" && detail.includes("distinct note vectors");
    return Response.json({
      error: insufficientDistinctNotes
        ? "These notes do not contain enough distinct embeddings for that many groups. Choose fewer groups."
        : "The clustering service could not group these notes. Check the group count and try again.",
    }, { status: serviceResponse.status === 422 ? 422 : 502 });
  }

  const result = fastApiClusterResponseSchema.safeParse(servicePayload);
  if (!result.success || result.data.cluster_count !== clusterCount || result.data.metric !== metric
    || result.data.groups.length !== clusterCount) {
    return Response.json({ error: "The clustering service returned an unexpected result." }, { status: 502 });
  }

  const expectedIds = new Set(cards.map(({ id }) => id));
  const assignedIds = result.data.assignments.map(({ note_id }) => note_id);
  const groupIds = new Set(result.data.groups.map(({ id }) => id));
  const groupedIds = result.data.groups.flatMap(({ note_ids }) => note_ids);
  const validAssignments = assignedIds.length === expectedIds.size
    && new Set(assignedIds).size === expectedIds.size
    && assignedIds.every((id) => expectedIds.has(id))
    && groupIds.size === result.data.groups.length
    && groupedIds.length === expectedIds.size
    && new Set(groupedIds).size === expectedIds.size
    && groupedIds.every((id) => expectedIds.has(id))
    && result.data.assignments.every(({ note_id, group_id }) => groupIds.has(group_id)
      && result.data.groups.find(({ id }) => id === group_id)?.note_ids.includes(note_id));
  if (!validAssignments || result.data.groups.some(({ size, note_ids }) => size !== note_ids.length)) {
    return Response.json({ error: "The clustering service did not assign every note to exactly one group." }, { status: 502 });
  }

  return Response.json({
    algorithm: result.data.algorithm,
    embeddingModel: result.data.embedding_model,
    metric: result.data.metric,
    clusterCount: result.data.cluster_count,
    groups: result.data.groups.map(({ id, label, note_ids }) => ({ id, label, noteIds: note_ids })),
  });
}
