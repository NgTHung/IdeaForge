"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { IdeaVote } from "./model";
import { voterNameFor } from "./idea-voting";
import "./idea-upvote.css";

export type IdeaUpvoteProps = {
  ideaTitle: string;
  upvoters: IdeaVote[];
  voterId: string;
  canWrite: boolean;
  onUpvote: () => void;
  showUpvoters?: boolean;
};

export function IdeaUpvote({ ideaTitle, upvoters, voterId, canWrite, onUpvote, showUpvoters = true }: IdeaUpvoteProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = upvoters.some((vote) => vote.voterId === voterId);
  const title = ideaTitle.trim() || "untitled idea";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    rootRef.current?.addEventListener("keydown", onKeyDown);
    const root = rootRef.current;
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      root?.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <div ref={rootRef} className="idea-upvote nodrag nopan nowheel"
    onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}>
    <button type="button" className="idea-upvote-button" disabled={!canWrite} aria-pressed={selected}
      aria-label={`${selected ? "Remove upvote from" : "Upvote"} ${title}. ${upvoters.length} ${upvoters.length === 1 ? "upvote" : "upvotes"}.`}
      title={canWrite ? selected ? "Remove your upvote" : "Upvote this idea" : "Only editors can upvote"}
      onClick={() => { setOpen(false); onUpvote(); }}>
      <span aria-hidden="true">{selected ? "♥" : "♡"}</span>{(!showUpvoters || upvoters.length === 0) && <span>{upvoters.length}</span>}
    </button>
    {showUpvoters && upvoters.length > 0 && <button ref={triggerRef} type="button" className="idea-upvoters-trigger idea-upvote-count" aria-expanded={open} aria-controls={popoverId}
      aria-label={`View upvoters for ${title}`} title="See who upvoted" onClick={() => setOpen((current) => !current)}>
      {upvoters.length}
    </button>}
    {open && showUpvoters && upvoters.length > 0 && <section id={popoverId} className="idea-upvoters-popover" aria-label={`Upvoters for ${title}`}>
      <strong>Upvoted by</strong>
      {upvoters.length ? <ul>{upvoters.map((vote) => <li key={vote.voterId}>
        {voterNameFor(vote)}{vote.voterId === voterId && <small> (you)</small>}
      </li>)}</ul> : <p>No upvotes yet.</p>}
    </section>}
  </div>;
}
