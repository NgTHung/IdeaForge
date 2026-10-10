import type { Metadata } from "next";
import { BoardApp } from "@/features/board/board-app";

export const metadata: Metadata = {
  title: "Try IdeaForge",
  description: "A sandbox board with sample ideas. Nothing you change is saved.",
};

export default function TryPage() {
  return <BoardApp sandbox />;
}
