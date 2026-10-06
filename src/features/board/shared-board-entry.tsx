"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { SharedBoardRoom } from "./shared-board";
import "./guest-entry.css";

const savedNameKey = "ideaforge-guest-name";

export function SharedBoardEntry({ boardId }: { boardId: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);
  const [entered, setEntered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const profileStarted = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setName(window.localStorage.getItem(savedNameKey) ?? "");
      setNameLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (isPending || !nameLoaded || !session || entered || profileStarted.current || error) return;
    profileStarted.current = true;
    const accountName = session.user.name?.trim().slice(0, 60) || session.user.email?.trim().slice(0, 60) || "Guest";
    let cancelled = false;
    void saveDisplayName(accountName).then(() => {
      if (!cancelled) setEntered(true);
    }).catch(() => {
      if (!cancelled) setError("Could not prepare your board session. Please reload to try again.");
    });
    return () => { cancelled = true; };
  }, [entered, error, isPending, nameLoaded, session]);

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim();
    if (!displayName || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveDisplayName(displayName);
      window.localStorage.setItem(savedNameKey, displayName);
      setName(displayName);
      setEntered(true);
    } catch {
      setError("Could not save your name. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (entered) return <SharedBoardRoom boardId={boardId} />;
  if (isPending || !nameLoaded || session && !error || busy && !error) {
    return <main className="guest-entry-loading" aria-live="polite">Preparing your board…</main>;
  }

  return <main className="guest-entry-shell">
    <header className="guest-entry-header">
      <Link className="guest-entry-brand" href="/" aria-label="IdeaForge home">
        <span className="guest-entry-brand-mark" aria-hidden="true">✳</span>
        <span>IdeaForge</span>
      </Link>
      <Link className="guest-entry-signin" href="/login">Sign in</Link>
    </header>
    <section className="guest-entry-content" aria-label="Join shared board">
      <div className="guest-entry-preview" aria-hidden="true">
        <div className="guest-entry-preview-top"><span /><span /><span /></div>
        <div className="guest-entry-preview-canvas">
          <div className="guest-preview-note guest-preview-note-one"><i />Shared study rooms</div>
          <div className="guest-preview-note guest-preview-note-two"><i />Idea sessions</div>
          <div className="guest-preview-note guest-preview-note-three"><i />Team workshops</div>
          <svg viewBox="0 0 560 260" preserveAspectRatio="none">
            <path d="M140 116 C210 66 260 72 304 116 S405 166 444 110" />
          </svg>
          <div className="guest-entry-preview-message">
            <span className="guest-entry-preview-symbol">✳</span>
            <strong>Your team’s ideas are waiting</strong>
            <small>Join the board to think together</small>
          </div>
        </div>
        <div className="guest-entry-preview-footer"><span /> Live collaboration <span /> Saved automatically</div>
      </div>
      <div className="guest-entry-form-panel">
        <h1>What’s your name?</h1>
        <form onSubmit={join}>
          <label htmlFor="guest-display-name">Your name</label>
          <input id="guest-display-name" name="name" autoComplete="name" autoFocus maxLength={60}
            value={name} onChange={(event) => { setName(event.target.value); setError(""); }} />
          <span className="guest-entry-count" aria-live="off">{name.length}/60</span>
          {error && <p className="guest-entry-error" role="alert">{error}</p>}
          <button className="guest-entry-join" type="submit" disabled={!name.trim() || busy}>
            {busy ? "Joining…" : "Join board"}
          </button>
        </form>
        <p className="guest-entry-signin-note">Have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </section>
    <footer className="guest-entry-footer">Ideas grow when people connect them.</footer>
  </main>;
}

async function saveDisplayName(name: string) {
  const response = await fetch("/api/guest-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Could not save display name.");
}
