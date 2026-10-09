"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { BOARD_DESCRIPTION_MAX_LENGTH, BOARD_TITLE_MAX_LENGTH, createBoardSchema } from "@/lib/board-directory";
import "./board-pages.css";

export function CreateBoardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login?returnTo=%2Fboards%2Fnew");
  }, [isPending, router, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const parsed = createBoardSchema.safeParse({ title, description });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the board details."); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/boards", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Your board could not be created. Try again.");
      router.replace(`/board/${encodeURIComponent(result.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your board could not be created. Try again.");
      submitting.current = false;
      setBusy(false);
    }
  }

  if (isPending || !session) return <main className="board-page-loading" aria-live="polite">Preparing board creation…</main>;
  return <main className="board-page-shell">
    <header className="board-page-header"><Link href="/" className="board-page-brand"><span aria-hidden="true">✳</span> IdeaForge</Link>
      <Link className="board-page-secondary" href="/dashboard">My dashboard</Link></header>
    <section className="board-form-card">
      <p className="board-page-eyebrow">START A SHARED WORKSPACE</p>
      <h1>Create a board</h1>
      <p className="board-page-intro">Name the outcome you want your team to explore. You can invite others with the board link.</p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <label htmlFor="new-board-title">Goal or topic <span>Required</span></label>
        <input id="new-board-title" value={title} maxLength={BOARD_TITLE_MAX_LENGTH} required autoFocus
          aria-invalid={Boolean(error)} aria-describedby="new-board-title-help" onChange={(event) => { setTitle(event.target.value); setError(""); }} />
        <small id="new-board-title-help">{title.length}/{BOARD_TITLE_MAX_LENGTH} characters</small>
        <label htmlFor="new-board-description">Description <span>Optional</span></label>
        <textarea id="new-board-description" value={description} maxLength={BOARD_DESCRIPTION_MAX_LENGTH} rows={5}
          aria-describedby="new-board-description-help" onChange={(event) => { setDescription(event.target.value); setError(""); }} />
        <small id="new-board-description-help">Add useful background or the outcome you want. {description.length}/{BOARD_DESCRIPTION_MAX_LENGTH}</small>
        {error && <p className="board-page-error" role="alert">{error}</p>}
        <div className="board-page-actions"><Link className="board-page-secondary" href="/dashboard">Cancel</Link>
          <button className="board-page-primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create board"}</button></div>
      </form>
    </section>
  </main>;
}
