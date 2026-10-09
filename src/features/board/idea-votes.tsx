"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Idea, IdeaVote } from "./model";
import { scoreForIdea, setIdeaVote, voteByUser } from "./idea-voting";
import type { Board } from "./model";
import "./idea-votes.css";

export function IdeaVotes({ ideas, votes = [], voterId, canWrite, onBoardChange }: {
  ideas: Idea[];
  votes?: IdeaVote[];
  voterId: string;
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
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const totalVotes = votes.length;
  return <div className="idea-votes" ref={rootRef}>
    <button ref={triggerRef} className="idea-votes-trigger" type="button" aria-expanded={open}
      aria-controls="idea-votes-popover" aria-label={`Vote on ideas. ${totalVotes} ${totalVotes === 1 ? "vote" : "votes"} cast.`}
      title="Vote on ideas" onClick={() => setOpen((current) => !current)}>
      <span aria-hidden="true">☷</span><span>Vote</span>
    </button>
    {open && <section id="idea-votes-popover" className="idea-votes-popover" aria-label="Vote on ideas">
      <header className="idea-votes-header"><strong>Vote on ideas</strong><span>{rows.length}</span></header>
      {rows.length ? <ul>{rows.map((idea) => {
        const currentVote = voteByUser(votes, idea.id, voterId);
        const score = scoreForIdea(votes, idea.id);
        return <li key={idea.id}>
          <span className="idea-votes-title" title={idea.title}>{idea.title.trim() || "Untitled idea"}</span>
          <div className="idea-votes-controls" role="group" aria-label={`Vote on ${idea.title || "untitled idea"}`}>
            <button type="button" className={currentVote === 1 ? "is-selected" : ""} disabled={!canWrite}
              aria-label={`Upvote ${idea.title || "untitled idea"}`} aria-pressed={currentVote === 1}
              title="Upvote" onClick={() => onBoardChange((board) => setIdeaVote(board, idea.id, voterId, 1))}>👍</button>
            <button type="button" className={currentVote === -1 ? "is-selected" : ""} disabled={!canWrite}
              aria-label={`Downvote ${idea.title || "untitled idea"}`} aria-pressed={currentVote === -1}
              title="Downvote" onClick={() => onBoardChange((board) => setIdeaVote(board, idea.id, voterId, -1))}>👎</button>
          </div>
          <span className="idea-votes-score" aria-label={`Score ${score}`}>{score}</span>
        </li>;
      })}</ul> : <p className="idea-votes-empty">Add an idea to start voting.</p>}
    </section>}
  </div>;
}
