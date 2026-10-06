import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedBoard } from "@/components/shared-board";
import { boardIdSchema } from "@/lib/rooms";

export default async function SharedBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!boardIdSchema.safeParse(id).success) notFound();
  if (!process.env.LIVEBLOCKS_SECRET_KEY) return <main className="p-8">
    <h1 className="text-2xl font-bold">Shared boards need Liveblocks</h1>
    <p className="my-4">Add LIVEBLOCKS_SECRET_KEY to .env.local and restart the app.</p>
    <Link href="/" className="underline">Open the local canvas</Link>
  </main>;
  return <SharedBoard id={id} />;
}
