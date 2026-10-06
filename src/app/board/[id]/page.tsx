import { notFound } from "next/navigation";
import { boardIdSchema } from "@/lib/rooms";
import { SharedBoardEntry } from "@/features/board/shared-board-entry";

export default async function SharedBoardPage({ params }: PageProps<"/board/[id]">) {
  const { id } = await params;
  if (!boardIdSchema.safeParse(id).success) notFound();
  return <SharedBoardEntry boardId={id} />;
}
