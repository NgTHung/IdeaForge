import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";
import type { ConnectionPair, FreeDrawStroke, Idea, IdeaVote, Relationship } from "@/features/board/model";
import type { ClusterSnapshot } from "@/lib/cluster-contract";
import type { CursorStyle } from "@/features/board/personalization";

export type BoardStorage = {
  title: string;
  goal?: string;
  ideas: LiveMap<string, LiveObject<Idea>>;
  relationships: LiveMap<string, LiveObject<Relationship>>;
  // Rooms created before idea voting can lack this map until the first vote.
  votes?: LiveMap<string, IdeaVote>;
  // Rooms created before free drawing can lack this map until the first stroke.
  drawings?: LiveMap<string, LiveObject<FreeDrawStroke>>;
  // Rooms created before dismissals were shared don't have this map until the first dismissal.
  dismissedConnections?: LiveMap<string, ConnectionPair>;
  clusterSnapshot: LiveObject<ClusterSnapshot> | null;
};
type BoardPresence = { editingIdeaId?: string | null; drawing?: FreeDrawStroke | null; cursor?: { x: number; y: number } | null; cursorStyle?: CursorStyle };
type BoardUserMeta = { id?: string; info?: { name?: string; avatar?: string } };

const client = createClient({ authEndpoint: "/api/liveblocks-auth" });

export const { RoomProvider, useMutation, useStatus, useStorage, useOthers, useSelf, useUpdateMyPresence,
  useHistory, useUndo, useRedo, useCanUndo, useCanRedo } =
  createRoomContext<BoardPresence, BoardStorage, BoardUserMeta>(client);

export function createBoardStorage(title: string, ideas: Idea[], relationships: Relationship[], goal = "Help students build a consistent study habit.") {
  return {
    title,
    goal,
    ideas: new LiveMap(ideas.map((idea) => [idea.id, new LiveObject(idea)])),
    relationships: new LiveMap(relationships.map((link) => [link.id, new LiveObject(link)])),
    votes: new LiveMap<string, IdeaVote>(),
    drawings: new LiveMap<string, LiveObject<FreeDrawStroke>>(),
    dismissedConnections: new LiveMap<string, ConnectionPair>(),
    clusterSnapshot: null,
  };
}
