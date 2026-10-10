"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { authClient } from "@/lib/auth-client";
import { deleteDashboardBoard, loadDashboardBoards } from "@/lib/board-api-client";
import type { DashboardBoard } from "@/lib/board-directory";
import { AccountMenu } from "./account-menu";
import {
  dashboardBoardDescription,
  dashboardBoardMatches,
  dashboardBoardTitle,
  mostRecentlyEditedBoard,
  sortDashboardBoards,
  type DashboardSort,
} from "./dashboard-data";
import "./board-pages.css";

type Boards = { owned: DashboardBoard[]; shared: DashboardBoard[] };

function relativeTime(value: string) {
  const timestamp = new Date(value).valueOf();
  if (Number.isNaN(timestamp)) return "Date unavailable";
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  if (elapsed < 2_592_000_000) return `${Math.floor(elapsed / 86_400_000)}d ago`;
  if (elapsed < 31_536_000_000) return `${Math.floor(elapsed / 2_592_000_000)}mo ago`;
  return `${Math.floor(elapsed / 31_536_000_000)}y ago`;
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function boardRoleLabel(role: DashboardBoard["role"]) {
  if (role === "owner") return null;
  if (role === "editor") return "Editor";
  if (role === "viewer") return "Viewer";
  return "Shared";
}

export function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [boards, setBoards] = useState<Boards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DashboardSort>("edited");
  const [greeting, setGreeting] = useState("Good afternoon");
  const [deletingBoardId, setDeletingBoardId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const retry = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBoards(await loadDashboardBoards());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your boards could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function deleteBoard(board: DashboardBoard) {
    const title = dashboardBoardTitle(board);
    if (!window.confirm(`Delete “${title}”? This permanently deletes the board and its ideas. This cannot be undone.`)) return;
    setDeletingBoardId(board.id);
    setDeleteError("");
    try {
      await deleteDashboardBoard(board.id);
      setBoards((current) => current ? {
        owned: current.owned.filter((item) => item.id !== board.id),
        shared: current.shared.filter((item) => item.id !== board.id),
      } : current);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "The board could not be deleted. Try again.");
    } finally {
      setDeletingBoardId(null);
    }
  }

  useEffect(() => {
    if (!isPending && !session) router.replace("/login?returnTo=%2Fdashboard");
  }, [isPending, router, session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setGreeting(greetingForHour(new Date().getHours()));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    function focusSearch(event: globalThis.KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && (
        event.target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
      )) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void loadDashboardBoards(controller.signal).then((result) => {
      if (!controller.signal.aborted) setBoards(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your boards could not be loaded.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [session]);

  const query = search.trim().toLocaleLowerCase();
  if (isPending || !session) {
    return <main className="board-page-loading" aria-live="polite">Loading your dashboard…</main>;
  }

  const allBoards = [...(boards?.owned ?? []), ...(boards?.shared ?? [])];
  const filteredOwned = (boards?.owned ?? []).filter((board) => dashboardBoardMatches(board, query));
  const filteredShared = (boards?.shared ?? []).filter((board) => dashboardBoardMatches(board, query));
  const ownedBoards = sortDashboardBoards(filteredOwned, sort);
  const sharedBoards = sortDashboardBoards(filteredShared, sort);
  const latestBoard = mostRecentlyEditedBoard([...filteredOwned, ...filteredShared]);
  const hasAnyBoards = allBoards.length > 0;
  const showSharedSection = filteredShared.length > 0 || (!query && hasAnyBoards);
  const noResults = Boolean(query) && filteredOwned.length === 0 && filteredShared.length === 0;
  const firstName = session.user.name?.trim().split(/\s+/)[0] || session.user.email?.split("@")[0] || "there";
  return (
    <main className="board-page-shell board-dashboard-shell" aria-labelledby="dashboard-title">
      <header className="board-page-header">
        <Link href="/" className="board-page-brand">
          <span aria-hidden="true">✳</span> IdeaForge
        </Link>
        <AccountMenu showName />
      </header>

      <section className="board-dashboard-intro" aria-labelledby="dashboard-title">
        <div className="board-dashboard-intro-copy">
          <h1 id="dashboard-title">{greeting}, {firstName}</h1>
        </div>
        <Link className="board-dashboard-create-button" href="/boards/new">
          <span aria-hidden="true">+</span> Create board
        </Link>
      </section>

      {deleteError && <p className="board-dashboard-delete-error" role="alert">{deleteError}</p>}

      {loading ? (
        <BoardSection
          id="my-boards"
          title="My boards"
          boards={[]}
          empty="You haven’t created a board yet."
          loading
          query={query}
          search={search}
          searchInputRef={searchInputRef}
          onSearch={setSearch}
          sort={sort}
          onSort={setSort}
        />
      ) : error ? (
        <div className="board-dashboard-state board-page-error" role="alert">
          <p>{error}</p>
          <button className="board-page-secondary" type="button" onClick={() => void retry()}>
            Try again
          </button>
        </div>
      ) : !hasAnyBoards ? (
        <DashboardEmptyState />
      ) : (
        <>
          {latestBoard && <FeaturedBoardSection board={latestBoard} />}
          <BoardSection
            id="my-boards"
            title="My boards"
            boards={ownedBoards}
            empty="You haven’t created a board yet."
            loading={false}
            query={query}
            search={search}
            searchInputRef={searchInputRef}
            onSearch={setSearch}
            sort={sort}
            onSort={setSort}
            noResults={noResults}
            deletingBoardId={deletingBoardId}
            onDeleteBoard={deleteBoard}
          />
          {showSharedSection && (
            <BoardSection
              id="shared-boards"
              title="Shared with me"
              boards={sharedBoards}
              empty="Boards shared with you will appear here when you’re invited."
              loading={false}
              query={query}
              deletingBoardId={deletingBoardId}
              onDeleteBoard={deleteBoard}
            />
          )}
        </>
      )}
    </main>
  );
}

type BoardSectionProps = {
  id: string;
  title: string;
  boards: DashboardBoard[];
  empty: string;
  loading: boolean;
  query: string;
  search?: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onSearch?: (value: string) => void;
  sort?: DashboardSort;
  onSort?: (value: DashboardSort) => void;
  noResults?: boolean;
  deletingBoardId?: string | null;
  onDeleteBoard?: (board: DashboardBoard) => void;
};

function BoardSection({
  id,
  title,
  boards,
  empty,
  loading,
  query,
  search,
  searchInputRef,
  onSearch,
  sort,
  onSort,
  noResults = false,
  deletingBoardId = null,
  onDeleteBoard,
}: BoardSectionProps) {
  const isOwned = id === "my-boards";

  return (
    <section className="board-dashboard-section" aria-labelledby={`${id}-title`}>
      <header className="board-dashboard-section-header">
        <div className="board-dashboard-section-title-group">
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        {isOwned && (
          <div className="board-dashboard-toolbar">
            <label className="board-dashboard-visually-hidden" htmlFor="dashboard-search">Search all boards</label>
            <div className="board-dashboard-search">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <circle cx="10.8" cy="10.8" r="6.3" />
                <path d="m15.5 15.5 4.2 4.2" />
              </svg>
              <input
                id="dashboard-search"
                ref={searchInputRef}
                type="search"
                value={search ?? ""}
                onChange={(event) => onSearch?.(event.target.value)}
                placeholder="Search all boards…"
                title="Search boards (/)"
                aria-keyshortcuts="/"
              />
            </div>
            <label className="board-dashboard-visually-hidden" htmlFor="dashboard-sort">Sort boards</label>
            <div className="board-dashboard-sort">
              <select id="dashboard-sort" value={sort} onChange={(event) => onSort?.(event.target.value as DashboardSort)}>
                <option value="edited">Recently edited</option>
                <option value="name">Name A–Z</option>
                <option value="created">Date created</option>
              </select>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </div>
          </div>
        )}
      </header>

      {loading ? (
        <ul className="board-dashboard-grid" aria-label="Loading boards" aria-busy="true">
          {[0, 1, 2].map((index) => <BoardSkeleton key={index} index={index} />)}
        </ul>
      ) : boards.length > 0 ? (
        <ul className="board-dashboard-grid" aria-labelledby={`${id}-title`}>
          {boards.map((board, index) => (
            <li
              className="board-dashboard-list-item board-dashboard-enter"
              key={board.id}
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            >
              <BoardCard
                board={board}
                isDeleting={deletingBoardId === board.id}
                onDelete={onDeleteBoard}
              />
            </li>
          ))}
        </ul>
      ) : noResults ? (
        <div className="board-dashboard-no-results" role="status">
          <p>No boards match your search.</p>
          <button className="board-dashboard-clear-search" type="button" onClick={() => onSearch?.("")}>
            Clear search
          </button>
        </div>
      ) : query ? null : isOwned ? (
        <p className="board-dashboard-empty">{empty}</p>
      ) : (
        <SharedEmptyPanel />
      )}
    </section>
  );
}

function BoardCard({ board, isDeleting, onDelete }: {
  board: DashboardBoard;
  isDeleting: boolean;
  onDelete?: (board: DashboardBoard) => void;
}) {
  const title = dashboardBoardTitle(board);
  const description = dashboardBoardDescription(board);
  const roleLabel = boardRoleLabel(board.role);
  const edited = relativeTime(board.updatedAt);
  const canDelete = board.role === "owner" && onDelete;

  return (
    <article className="board-dashboard-card-shell">
      <Link
        className={`board-dashboard-card${canDelete ? " board-dashboard-card-has-delete" : ""}`}
        href={`/board/${encodeURIComponent(board.id)}`}
        aria-label={`${title}. Edited ${edited}. Open board.`}
      >
        <span className="board-dashboard-card-accent" aria-hidden="true" />
        <div className="board-dashboard-card-content">
          {roleLabel && <span className="board-dashboard-role">{roleLabel}</span>}
          <h3 className="board-dashboard-title" title={title}>{title}</h3>
          {description && <p className="board-dashboard-description">{description}</p>}
          <footer className="board-dashboard-card-footer">
            <time className="board-dashboard-date" dateTime={board.updatedAt}>Edited {edited}</time>
            <span className="board-dashboard-card-open">
              <svg className="board-dashboard-open-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h15m-6-7 7 7-7 7" />
              </svg>
            </span>
          </footer>
        </div>
      </Link>
      {canDelete && (
        <button
          className="board-dashboard-delete-button"
          type="button"
          aria-label={isDeleting ? `Deleting ${title}` : `Delete ${title}`}
          title={isDeleting ? "Deleting board" : "Delete board"}
          disabled={isDeleting}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete?.(board);
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M9 7V4h6v3m3 0-.9 13H6.9L6 7m4 4v6m4-6v6" />
          </svg>
        </button>
      )}
    </article>
  );
}

function BoardSkeleton({ index }: { index: number }) {
  return (
    <li
      className="board-dashboard-list-item board-dashboard-enter"
      aria-hidden="true"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="board-dashboard-card board-dashboard-card-skeleton">
        <span className="board-dashboard-skeleton-accent" />
        <div className="board-dashboard-skeleton-content">
          <span className="board-dashboard-skeleton-title" />
          <span className="board-dashboard-skeleton-description" />
          <span className="board-dashboard-skeleton-footer" />
        </div>
      </div>
    </li>
  );
}

function FeaturedBoardSection({ board }: { board: DashboardBoard }) {
  const title = dashboardBoardTitle(board);
  const description = dashboardBoardDescription(board);
  const edited = relativeTime(board.updatedAt);

  return (
    <section className="board-dashboard-featured-section" aria-labelledby="recently-edited-title">
      <Link
        className="board-dashboard-featured-card"
        href={`/board/${encodeURIComponent(board.id)}`}
        aria-label={`${title}. Edited ${edited}. Resume board.`}
      >
        <div className="board-dashboard-featured-copy">
          <h2 id="recently-edited-title">Recently edited</h2>
          <h3 title={title}>{title}</h3>
          {description && <p>{description}</p>}
          <time dateTime={board.updatedAt}>Edited {edited}</time>
        </div>
        <span className="board-dashboard-featured-action">
          Resume board
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M4 12h15m-6-7 7 7-7 7" />
          </svg>
        </span>
      </Link>
    </section>
  );
}

function DashboardEmptyState() {
  return (
    <section className="board-dashboard-empty-start" aria-labelledby="empty-dashboard-title">
      <h2 id="empty-dashboard-title">No boards yet</h2>
      <p>Create a board to start collecting and combining ideas.</p>
      <Link className="board-page-primary" href="/boards/new">Create your first board</Link>
    </section>
  );
}

function SharedEmptyPanel() {
  return (
    <div className="board-dashboard-shared-empty-panel">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M2.5 19c.5-3.4 2.3-5 5.5-5s5 1.6 5.5 5M14 14.5c3-.5 5.2 1 5.7 4.2" />
      </svg>
      <div>
        <h3>Nothing shared yet</h3>
        <p>Boards you’re invited to will appear here.</p>
      </div>
    </div>
  );
}
