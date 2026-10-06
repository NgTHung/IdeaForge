import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";
import type { Idea, Relationship } from "@/features/board/model";
import type { ClusterSnapshot } from "@/lib/cluster-contract";

type BoardStorage = {
  title: string;
  ideas: LiveMap<string, LiveObject<Idea>>;
  relationships: LiveMap<string, LiveObject<Relationship>>;
  clusterSnapshot: LiveObject<ClusterSnapshot> | null;
};
type BoardPresence = Record<string, never>;

const client = createClient({ authEndpoint: "/api/liveblocks-auth" });

export const { RoomProvider, useMutation, useStatus, useStorage } =
  createRoomContext<BoardPresence, BoardStorage>(client);

export function createBoardStorage(title: string, ideas: Idea[], relationships: Relationship[]) {
  return {
    title,
    ideas: new LiveMap(ideas.map((idea) => [idea.id, new LiveObject(idea)])),
    relationships: new LiveMap(relationships.map((link) => [link.id, new LiveObject(link)])),
    clusterSnapshot: null,
  };
}
