import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";
import type { Idea, Relationship } from "@/features/board/model";

type BoardStorage = {
  title: string;
  ideas: LiveMap<string, LiveObject<Idea>>;
  relationships: LiveMap<string, LiveObject<Relationship>>;
};
type BoardPresence = Record<string, never>;
type BoardUserMeta = { id?: string; info?: { name?: string; avatar?: string } };

const client = createClient({ authEndpoint: "/api/liveblocks-auth" });

export const { RoomProvider, useMutation, useStatus, useStorage, useOthers, useSelf } =
  createRoomContext<BoardPresence, BoardStorage, BoardUserMeta>(client);

export function createBoardStorage(title: string, ideas: Idea[], relationships: Relationship[]) {
  return {
    title,
    ideas: new LiveMap(ideas.map((idea) => [idea.id, new LiveObject(idea)])),
    relationships: new LiveMap(relationships.map((link) => [link.id, new LiveObject(link)])),
  };
}
