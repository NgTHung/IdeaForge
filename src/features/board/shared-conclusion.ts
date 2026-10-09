import { LiveObject } from "@liveblocks/client";
import type { BoardStorage } from "@/lib/liveblocks";
import type { BoardConclusion } from "./model";

// A kept conclusion replaces the previous one whole, so the room never mixes fields from two conclusions.
export function syncBoardConclusion(storage: LiveObject<BoardStorage>, conclusion: BoardConclusion | null): boolean {
  const saved = storage.get("conclusion")?.toJSON() ?? null;
  if (JSON.stringify(saved) === JSON.stringify(conclusion)) return false;
  storage.set("conclusion", conclusion ? new LiveObject(conclusion) : null);
  return true;
}
