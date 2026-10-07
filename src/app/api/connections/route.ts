import { connectionErrorResponse } from '@/lib/connection-errors';
import { connectionRequestSchema } from '@/lib/connections';
import { suggestConnections } from '@/lib/connection-suggestions';

export const runtime = 'nodejs';
export const maxDuration = 35;

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return Response.json({ error: 'Send valid JSON.' }, { status: 400 }); }
  const parsed = connectionRequestSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Provide a goal up to 500 characters, 2 to 50 unique cards with nonempty text up to 4,000 characters, and excluded pairs between those cards.' }, { status: 400 });
  try { return Response.json({ result: await suggestConnections(parsed.data) }); }
  catch (error) { return connectionErrorResponse(error); }
}
