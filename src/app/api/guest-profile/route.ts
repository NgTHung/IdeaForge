import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }

  const name = typeof (payload as { name?: unknown } | null)?.name === "string"
    ? (payload as { name: string }).name.trim()
    : "";
  if (!name || name.length > 60) {
    return Response.json({ error: "Enter a name with 1 to 60 characters." }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set("ideaforge-guest-name", name, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ name }, { headers: { "Cache-Control": "no-store" } });
}
