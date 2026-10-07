import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";
import type { ConnectionPair, Idea, Relationship } from "@/features/board/model";
import type { ClusterSnapshot } from "@/lib/cluster-contract";

type BoardStorage = {
  title: string;
  goal?: string;
  ideas: LiveMap<string, LiveObject<Idea>>;
  relationships: LiveMap<string, LiveObject<Relationship>>;
  // Rooms created before dismissals were shared don't have this map until the first dismissal.
  dismissedConnections?: LiveMap<string, ConnectionPair>;
  clusterSnapshot: LiveObject<ClusterSnapshot> | null;
};
type BoardPresence = { editingIdeaId?: string | null };
type BoardUserMeta = { id?: string; info?: { name?: string; avatar?: string } };

const client = createClient({ authEndpoint: "/api/liveblocks-auth" });

export const { RoomProvider, useMutation, useStatus, useStorage, useOthers, useSelf, useUpdateMyPresence } =
  createRoomContext<BoardPresence, BoardStorage, BoardUserMeta>(client);

export function createBoardStorage(title: string, ideas: Idea[], relationships: Relationship[]) {
  return {
    title,
    goal: "Help students build a consistent study habit.",
    ideas: new LiveMap(ideas.map((idea) => [idea.id, new LiveObject(idea)])),
    relationships: new LiveMap(relationships.map((link) => [link.id, new LiveObject(link)])),
    dismissedConnections: new LiveMap<string, ConnectionPair>(),
    clusterSnapshot: null,
  };
}
