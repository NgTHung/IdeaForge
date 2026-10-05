"use client";

import { LiveMap, LiveObject } from "@liveblocks/client";
import { ClientSideSuspense, LiveblocksProvider, RoomProvider, useMutation, useOthers, useStorage, useStatus } from "@liveblocks/react/suspense";
import { Board } from "@/components/board";
import { initialGoal, initialIdeas, type Idea } from "@/lib/ideas";

function ConnectedBoard() {
  const storedIdeas = useStorage((root) => root.ideas);
  const goal = useStorage((root) => root.goal);
  const others = useOthers();
  const connection = useStatus();
  const onGoalChange = useMutation(({ storage }, value: string) => storage.set("goal", value), []);
  const onAdd = useMutation(({ storage }, idea: Idea) => storage.get("ideas").set(idea.id, new LiveObject(idea)), []);
  const onUpdate = useMutation(({ storage }, id: string, patch: Partial<Idea>) => storage.get("ideas").get(id)?.update(patch), []);
  return <Board ideas={Object.values(storedIdeas)} goal={goal} onGoalChange={onGoalChange}
    onAdd={onAdd} onUpdate={onUpdate} status={`${connection} · ${others.length + 1} collaborator(s) · share this URL`} />;
}

export function SharedBoard({ id }: { id: string }) {
  return <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
    <RoomProvider id={`ideaforge:${id}`} initialPresence={{}}
      initialStorage={{ goal: initialGoal, ideas: new LiveMap(initialIdeas.map((idea) => [idea.id, new LiveObject(idea)])) }}>
      <ClientSideSuspense fallback={<p className="p-8" role="status">Joining the shared canvas…</p>}>
        <ConnectedBoard />
      </ClientSideSuspense>
    </RoomProvider>
  </LiveblocksProvider>;
}
