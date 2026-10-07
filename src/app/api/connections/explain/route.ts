import { aiErrorResponse } from '@/lib/ai';
import { ConnectionError, connectionErrorResponse } from '@/lib/connection-errors';
import { connectionExplanationRequestSchema } from '@/lib/connections';
import { explainConnection } from '@/lib/connection-explanation';

export const runtime = 'nodejs';
export const maxDuration = 45;

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return Response.json({ error: 'Send valid JSON.' }, { status: 400 }); }
  const parsed = connectionExplanationRequestSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Provide a goal, two different source ideas, and a relationship type.' }, { status: 400 });
  try { return Response.json({ result: await explainConnection(parsed.data) }); }
  catch (error) { return error instanceof ConnectionError ? connectionErrorResponse(error) : aiErrorResponse(error); }
}
