"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Board } from "@/components/board";
import { initialGoal, initialIdeas, type Idea } from "@/lib/ideas";
import { createIdeaId } from "@/lib/id";

export function LocalBoard({ collaborationEnabled }: { collaborationEnabled: boolean }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas);
  const [goal, setGoal] = useState(initialGoal);
  return <Board ideas={ideas} goal={goal} onGoalChange={setGoal}
    onAdd={(idea) => setIdeas((current) => [...current, idea])}
    onUpdate={(id, patch) => setIdeas((current) => current.map((idea) => idea.id === id ? { ...idea, ...patch } : idea))}
    status="Local draft · changes last until you reload"
    onShare={collaborationEnabled ? () => router.push(`/board/${createIdeaId()}`) : undefined} />;
}
