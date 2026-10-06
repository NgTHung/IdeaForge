import { cookies } from "next/headers";
import { Liveblocks } from "@liveblocks/node";
import { boardIdSchema, roomSchema } from "@/lib/rooms";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }
  const room = roomSchema.safeParse((payload as { room?: unknown } | null)?.room);
  if (!room.success) return Response.json({ error: "Invalid board room." }, { status: 400 });
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return Response.json({ error: "Liveblocks is not configured." }, { status: 503 });
  const cookieStore = await cookies();
  const existing = boardIdSchema.safeParse(cookieStore.get("ideaforge-guest")?.value);
  const guestId = existing.success ? existing.data : crypto.randomUUID();
  const displayName = cookieStore.get("ideaforge-guest-name")?.value?.trim().slice(0, 60)
    || `Guest ${guestId.slice(0, 4)}`;
  try {
    const liveblocks = new Liveblocks({ secret });
    const session = liveblocks.prepareSession(guestId, { userInfo: { name: displayName } });
    // MVP access policy: anyone with a board link may collaborate in that exact room.
    session.allow(room.data, session.FULL_ACCESS);
    const { body, status } = await session.authorize();
    const response = new Response(body, { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    if (status === 200 && !existing.success) cookieStore.set("ideaforge-guest", guestId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    return Response.json({ error: "Could not authorize this board. Check Liveblocks configuration." }, { status: 502 });
  }
}
