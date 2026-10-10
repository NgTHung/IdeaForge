"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { joinBoardByLink, loadBoardContext } from "@/lib/board-api-client";
import type { BoardMetadata } from "@/lib/board-directory";
import { BrandMark } from "@/features/brand/brand-mark";
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
  const [metadata, setMetadata] = useState<BoardMetadata | null>(null);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const profileStarted = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setName(window.localStorage.getItem(savedNameKey) ?? "");
      setNameLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadBoardContext(boardId).then((value) => {
      if (!cancelled) setMetadata(value);
    }).catch(() => {
      // Existing public UUID rooms without directory records stay accessible.
    }).finally(() => { if (!cancelled) setMetadataLoaded(true); });
    return () => { cancelled = true; };
  }, [boardId]);

  useEffect(() => {
    if (isPending || !nameLoaded || !session || entered || profileStarted.current || error) return;
    profileStarted.current = true;
    const accountName = session.user.name?.trim().slice(0, 60) || session.user.email?.trim().slice(0, 60) || "Guest";
    let cancelled = false;
    void joinBoardByLink(boardId).catch(() => undefined).then(() => saveDisplayName(accountName)).then(() => {
      if (!cancelled) setEntered(true);
    }).catch(() => {
      if (!cancelled) setError("Could not prepare your board session. Please reload to try again.");
    });
    return () => { cancelled = true; };
  }, [boardId, entered, error, isPending, nameLoaded, session]);

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

  if (entered && metadataLoaded) return <SharedBoardRoom boardId={boardId} metadata={metadata} />;
  if (isPending || !nameLoaded || entered && !metadataLoaded || session && !error || busy && !error) {
    return <main className="guest-entry-loading" aria-live="polite">Preparing your board…</main>;
  }

  return <main className="guest-entry-shell">
    <header className="guest-entry-header">
      <Link className="guest-entry-brand" href="/" aria-label="IdeaForge home">
        <BrandMark className="guest-entry-brand-mark" />
        <span>IdeaForge</span>
      </Link>
      <Link className="guest-entry-signin" href="/login">Sign in</Link>
    </header>
    <section className="guest-entry-content" aria-label="Join shared board">
      <div className="guest-entry-form-panel">
        {metadata && <div className="guest-entry-board-info">
          <h2>{metadata.title}</h2>
          {metadata.description?.trim() && <p>{metadata.description}</p>}
        </div>}
        <h1>What’s your name?</h1>
        <form onSubmit={join}>
          <label className="guest-entry-name-label" htmlFor="guest-display-name">Your name</label>
          <input id="guest-display-name" name="name" autoComplete="name" autoFocus maxLength={60}
            value={name} onChange={(event) => { setName(event.target.value); setError(""); }} />
          {name.length >= 54 && <span className="guest-entry-count" aria-live="off">{name.length}/60</span>}
          {error && <p className="guest-entry-error" role="alert">{error}</p>}
          <button className="guest-entry-join" type="submit" disabled={!name.trim() || busy}>
            {busy ? "Joining…" : "Join board"}
          </button>
        </form>
      </div>
    </section>
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
