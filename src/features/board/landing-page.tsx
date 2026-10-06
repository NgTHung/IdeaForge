"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { boardIdSchema } from "@/lib/rooms";
import { AccountMenu } from "./account-menu";
import "./landing.css";

export function LandingPage() {
  const router = useRouter();
  const [boardLink, setBoardLink] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const createStarted = useRef(false);
  const joinStarted = useRef(false);

  function createBoard() {
    if (createStarted.current) return;
    createStarted.current = true;
    setIsCreating(true);
    router.push(`/board/${crypto.randomUUID()}`);
  }

  function joinBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (joinStarted.current) return;
    const value = boardLink.trim();
    let boardId = value;
    if (!boardIdSchema.safeParse(value).success) {
      try {
        const url = new URL(value, window.location.origin);
        const match = url.pathname.match(/^\/board\/([^/]+)\/?$/);
        boardId = match?.[1] ?? "";
      } catch {
        boardId = "";
      }
    }
    if (!boardIdSchema.safeParse(boardId).success) {
      setJoinError("Enter a valid board link or board ID, then try again.");
      return;
    }
    joinStarted.current = true;
    setIsJoining(true);
    router.push(`/board/${boardId}`);
  }

  return <main className="landing-shell">
    <header className="landing-header">
      <Link className="landing-brand" href="/" aria-label="IdeaForge home">
        <span className="landing-brand-mark" aria-hidden="true">✳</span>
        <span>IdeaForge</span>
      </Link>
      <AccountMenu />
    </header>
    <section className="landing-content">
      <h1>Bring your team’s ideas together.</h1>
      <div className="landing-actions">
        <section className="landing-card landing-create-card">
          <span className="landing-card-icon" aria-hidden="true">＋</span>
          <h2>Create a board</h2>
          <button className="landing-primary" type="button" disabled={isCreating} onClick={createBoard}>
            {isCreating ? "Creating…" : "Create board"}
          </button>
        </section>
        <section className="landing-card">
          <span className="landing-card-icon landing-join-icon" aria-hidden="true">↗</span>
          <h2>Join a board</h2>
          <form className="landing-join-form" onSubmit={joinBoard} aria-busy={isJoining}>
            <label htmlFor="join-board">Board link or ID</label>
            <input id="join-board" value={boardLink} disabled={isJoining} aria-invalid={Boolean(joinError)}
              aria-describedby={joinError ? "join-board-error" : undefined}
              onChange={(event) => { setBoardLink(event.target.value); setJoinError(""); }}
              placeholder="Paste a board link or ID" autoComplete="url" />
            {joinError && <p id="join-board-error" className="landing-error" role="alert">{joinError}</p>}
            <button type="submit" disabled={isJoining || !boardLink.trim()}>
              {isJoining ? "Joining…" : "Join board"}
            </button>
          </form>
        </section>
      </div>
    </section>
  </main>;
}
