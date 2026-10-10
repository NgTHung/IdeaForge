"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { boardIdSchema } from "@/lib/rooms";
import { authClient } from "@/lib/auth-client";
import { BrandMark } from "@/features/brand/brand-mark";
import { AccountMenu } from "./account-menu";
import { LandingIllustration } from "./landing-illustration";
import "./landing.css";

const steps = [
  { title: "Collect", text: "Add ideas to a shared canvas. Everyone sees each other’s cursors and edits as they happen." },
  { title: "Organize", text: "Organize sorts ideas into groups and AI suggests a name for each. Suggested Links point out related ideas." },
  { title: "Merge", text: "Select 2 to 8 ideas. AI drafts one merged idea that you edit before keeping it. The originals stay on the board." },
  { title: "Conclude", text: "Upvote the strongest ideas, draft a conclusion from the ones you choose, and export it as Markdown." },
];

export function LandingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [boardLink, setBoardLink] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [sandboxActive, setSandboxActive] = useState(false);
  const sandboxFrame = useRef<HTMLIFrameElement>(null);
  const createStarted = useRef(false);
  const joinStarted = useRef(false);

  function createBoard() {
    if (createStarted.current) return;
    createStarted.current = true;
    setIsCreating(true);
    router.push(session ? "/boards/new" : "/login?returnTo=%2Fboards%2Fnew");
  }

  // The overlay keeps wheel and touch scrolling on the page until the visitor chooses to use the board.
  function startSandbox() {
    setSandboxActive(true);
    sandboxFrame.current?.focus();
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
        <BrandMark className="landing-brand-mark" />
        <span>IdeaForge</span>
      </Link>
      <AccountMenu />
    </header>
    <section className="landing-hero">
      <div className="landing-intro">
        <h1>Put your team’s ideas on one canvas, then merge the best ones.</h1>
        <p className="landing-lede">Everyone adds ideas live. AI groups related ideas and drafts one merged idea from the ones you pick. The originals stay on the board, linked to the result.</p>
        <button className="landing-primary" type="button" disabled={isCreating || isPending} onClick={createBoard}>
          {isCreating ? "Opening…" : "Create board"}
        </button>
        <form className="landing-join-form" onSubmit={joinBoard} aria-busy={isJoining}>
          <label htmlFor="join-board">Have a board link?</label>
          <div className="landing-join-row">
            <input id="join-board" value={boardLink} disabled={isJoining} aria-invalid={Boolean(joinError)}
              aria-describedby={joinError ? "join-board-error" : undefined}
              onChange={(event) => { setBoardLink(event.target.value); setJoinError(""); }}
              placeholder="Paste a board link or ID" autoComplete="url" />
            <button type="submit" disabled={isJoining || !boardLink.trim()}>
              {isJoining ? "Joining…" : "Join"}
            </button>
          </div>
          {joinError && <p id="join-board-error" className="landing-error" role="alert">{joinError}</p>}
        </form>
      </div>
      <LandingIllustration />
    </section>
    <section className="landing-steps" aria-labelledby="landing-steps-title">
      <h2 id="landing-steps-title">How it works</h2>
      <ol>
        {steps.map((step) => <li key={step.title}>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>)}
      </ol>
    </section>
    <section className="landing-try" aria-labelledby="landing-try-title">
      <div className="landing-try-head">
        <div>
          <h2 id="landing-try-title">Try it here</h2>
          <p>This board runs in your browser with five sample ideas. Add and link ideas, then select a few and merge them with AI. You don’t need an account, and nothing is saved.</p>
        </div>
        <a className="landing-try-full" href="/try">Open full screen</a>
      </div>
      <div className="landing-try-frame">
        <iframe ref={sandboxFrame} src="/try" title="IdeaForge sandbox board" loading="lazy" tabIndex={sandboxActive ? 0 : -1} />
        {!sandboxActive && <button className="landing-try-start" type="button" onClick={startSandbox}>
          <span>Click to try the board</span>
        </button>}
      </div>
      <a className="landing-primary landing-try-mobile" href="/try">Open the sandbox</a>
    </section>
  </main>;
}
