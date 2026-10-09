"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Idea, IdeaVote } from "./model";
import { upvotersForIdea, toggleIdeaUpvote, voterNameFor } from "./idea-voting";
import { IdeaUpvote } from "./idea-upvote";
import type { Board } from "./model";
import "./idea-votes.css";

export function IdeaVotes({ ideas, votes = [], voterId, voterName, canWrite, onBoardChange }: {
  ideas: Idea[];
  votes?: IdeaVote[];
  voterId: string;
  voterName: string;
  canWrite: boolean;
  onBoardChange: (update: (board: Board) => Board) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rows = useMemo(() => [...ideas].sort((left, right) => left.title.localeCompare(right.title)), [ideas]);

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
      aria-controls="idea-votes-popover" aria-label={`Vote on ideas. ${totalVotes} ${totalVotes === 1 ? "vote" : "votes"} cast.`}
      title="Vote on ideas" onClick={() => setOpen((current) => !current)}>
      <span aria-hidden="true">☷</span><span>Vote</span>
    </button>
    {open && <section id="idea-votes-popover" className="idea-votes-popover" aria-label="Vote on ideas">
      <header className="idea-votes-header"><strong>Vote on ideas</strong><span>{rows.length}</span></header>
      {rows.length ? <ul>{rows.map((idea) => {
        const upvoters = upvotersForIdea(votes, idea.id);
        return <li key={idea.id}>
          <div className="idea-votes-details">
            <span className="idea-votes-title" title={idea.title}>{idea.title.trim() || "Untitled idea"}</span>
            <small className="idea-votes-names">{upvoters.length ? upvoters.map(voterNameFor).join(", ") : "No upvotes yet"}</small>
          </div>
          <IdeaUpvote ideaTitle={idea.title} upvoters={upvoters} voterId={voterId} canWrite={canWrite} showUpvoters={false}
            onUpvote={() => onBoardChange((board) => toggleIdeaUpvote(board, idea.id, voterId, voterName))} />
        </li>;
      })}</ul> : <p className="idea-votes-empty">Add an idea to start voting.</p>}
    </section>}
  </div>;
}
