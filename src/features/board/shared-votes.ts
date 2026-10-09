import { LiveMap, type LiveObject } from "@liveblocks/client";
import type { BoardStorage } from "@/lib/liveblocks";
import type { IdeaVote } from "./model";
import { voteKey } from "./idea-voting";

export function syncIdeaVotes(storage: LiveObject<BoardStorage>, votes: IdeaVote[]) {
  const nextVotes = new Map(votes.map((vote) => [voteKey(vote.ideaId, vote.voterId), vote]));
  let target = storage.get("votes");
  let changed = false;
  if (!target && nextVotes.size) {
    target = new LiveMap<string, IdeaVote>();
    storage.set("votes", target);
    changed = true;
  }
  if (!target) return changed;
  for (const [key, vote] of target.entries()) {
    const updated = nextVotes.get(key);
    if (!updated) { target.delete(key); changed = true; }
    else {
      if (JSON.stringify(vote) !== JSON.stringify(updated)) { target.set(key, updated); changed = true; }
      nextVotes.delete(key);
    }
  }
  for (const [key, vote] of nextVotes) { target.set(key, vote); changed = true; }
  return changed;
}
