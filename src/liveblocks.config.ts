import type { LiveMap, LiveObject } from "@liveblocks/client";
import type { Idea } from "@/lib/ideas";

declare global {
  interface Liveblocks {
    Presence: Record<string, never>;
    Storage: {
      goal: string;
      ideas: LiveMap<string, LiveObject<Idea>>;
    };
    UserMeta: { id: string; info: { name: string } };
  }
}

export {};
