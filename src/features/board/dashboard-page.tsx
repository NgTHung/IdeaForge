"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { loadDashboardBoards } from "@/lib/board-api-client";
import type { DashboardBoard } from "@/lib/board-directory";
import "./board-pages.css";

type Boards = { owned: DashboardBoard[]; shared: DashboardBoard[] };

function boardDateLabel(board: DashboardBoard) {
  const joined = board.role !== "owner" && board.joinedAt;
  const value = joined || board.createdAt;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return joined ? "Join date unavailable" : "Creation date unavailable";
  return `${joined ? "Joined" : "Created"} ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)}`;
}

export function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [boards, setBoards] = useState<Boards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const retry = useCallback(async () => {
    setLoading(true); setError("");
    try { setBoards(await loadDashboardBoards()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your boards could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!isPending && !session) router.replace("/login?returnTo=%2Fdashboard"); }, [isPending, router, session]);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void loadDashboardBoards(controller.signal).then((result) => {
      if (!controller.signal.aborted) setBoards(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your boards could not be loaded.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session]);

  if (isPending || !session) return <main className="board-page-loading" aria-live="polite">Loading your dashboard…</main>;
  return <main className="board-page-shell board-dashboard-shell">
    <header className="board-page-header"><Link href="/" className="board-page-brand"><span aria-hidden="true">✳</span> IdeaForge</Link>
      <span className="board-dashboard-user">{session.user.name?.trim() || session.user.email}</span></header>
    <section className="board-dashboard-heading"><div><p className="board-page-eyebrow">YOUR WORKSPACE</p><h1>My dashboard</h1>
      <p>Pick up an idea session or start a new board.</p></div><Link className="board-page-primary board-dashboard-create" href="/boards/new">＋ Create board</Link></section>
    {loading ? <p className="board-dashboard-state" aria-live="polite">Loading your boards…</p> : error ? <div className="board-dashboard-state board-page-error" role="alert">
      <p>{error}</p><button className="board-page-secondary" type="button" onClick={() => void retry()}>Try again</button></div> : <>
      <BoardSection title="My boards" boards={boards?.owned ?? []} empty="Boards you create will appear here." />
      <BoardSection title="Shared with me" boards={boards?.shared ?? []} empty="Boards shared with you will appear here." />
    </>}
  </main>;
}

function BoardSection({ title, boards, empty }: { title: string; boards: DashboardBoard[]; empty: string }) {
  return <section className="board-dashboard-section"><h2>{title}</h2>{boards.length ? <div className="board-dashboard-grid">
    {boards.map((board) => <article className="board-dashboard-card" key={board.id}>
      <div><span className="board-dashboard-role">{board.role === "owner" ? "Owner" : board.role === "editor" ? "Editor" : "Viewer"}</span>
        <h3>{board.title}</h3>{board.description && <p className="board-dashboard-description">{board.description}</p>}
        <p className="board-dashboard-date">{boardDateLabel(board)}</p></div>
      <Link className="board-page-secondary" href={`/board/${encodeURIComponent(board.id)}`}>Open board <span aria-hidden="true">→</span></Link>
    </article>)}
  </div> : <p className="board-dashboard-empty">{empty}</p>}</section>;
}
