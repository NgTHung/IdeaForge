"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Idea, IdeaVote } from "./model";
import { MAX_UPVOTES_PER_PARTICIPANT, upvotersForIdea, toggleIdeaUpvote, voterNameFor, votesByUser } from "./idea-voting";
import { IdeaUpvote } from "./idea-upvote";
import type { Board } from "./model";
import "./idea-votes.css";

export function IdeaVotes({ ideas, votes = [], voterId, voterName, canWrite, onBoardChange, onUpvote, onFocusIdea }: {
  ideas: Idea[];
  votes?: IdeaVote[];
  voterId: string;
  voterName: string;
  canWrite: boolean;
  onBoardChange: (update: (board: Board) => Board) => boolean;
  onUpvote?: (ideaId: string) => void;
  onFocusIdea?: (ideaId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rows = useMemo(() => [...ideas].sort((left, right) =>
    upvotersForIdea(votes, right.id).length - upvotersForIdea(votes, left.id).length
    || left.title.localeCompare(right.title)), [ideas, votes]);
  const usedVotes = votesByUser(votes, voterId);
  const voteLimitReached = usedVotes >= MAX_UPVOTES_PER_PARTICIPANT;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const totalVotes = rows.reduce((total, idea) => total + upvotersForIdea(votes, idea.id).length, 0);
  return <div className="idea-votes" ref={rootRef}>
    <button ref={triggerRef} className="idea-votes-trigger" type="button" aria-expanded={open}
      aria-controls="idea-votes-popover" aria-label={`Top ideas. ${totalVotes} ${totalVotes === 1 ? "vote" : "votes"} cast.`}
      title="Top ideas" onClick={() => setOpen((current) => !current)}>
      <span aria-hidden="true">☷</span><span>Top ideas</span>
    </button>
    {open && <section id="idea-votes-popover" className="idea-votes-popover" aria-label="Top ideas">
      <header className="idea-votes-header"><strong>Top ideas</strong><span>{rows.length}</span></header>
      <p className="idea-votes-limit" role="status">{usedVotes} of {MAX_UPVOTES_PER_PARTICIPANT} votes used</p>
      {rows.length ? <ul>{rows.map((idea) => {
        const upvoters = upvotersForIdea(votes, idea.id);
        return <li key={idea.id}>
          <button type="button" className="idea-votes-focus" title={`Focus ${idea.title.trim() || "Untitled idea"}`} onClick={() => { setOpen(false); onFocusIdea?.(idea.id); }}>
            <span className="idea-votes-title">{idea.title.trim() || "Untitled idea"}</span>
            <small className="idea-votes-names">{upvoters.length ? upvoters.map(voterNameFor).join(", ") : "No upvotes yet"}</small>
          </button>
          <IdeaUpvote ideaTitle={idea.title} upvoters={upvoters} voterId={voterId} canWrite={canWrite} voteLimitReached={voteLimitReached} showUpvoters={false}
            onUpvote={() => onUpvote ? onUpvote(idea.id) : onBoardChange((board) => toggleIdeaUpvote(board, idea.id, voterId, voterName))} />
        </li>;
      })}</ul> : <p className="idea-votes-empty">Add an idea to start voting.</p>}
    </section>}
  </div>;
}
