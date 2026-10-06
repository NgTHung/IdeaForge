import { notFound } from "next/navigation";
import { boardIdSchema } from "@/lib/rooms";
import { SharedBoardRoom } from "@/features/board/shared-board";

export default async function SharedBoardPage({ params }: PageProps<"/board/[id]">) {
  const { id } = await params;
  if (!boardIdSchema.safeParse(id).success) notFound();
  return <SharedBoardRoom boardId={id} />;
}
