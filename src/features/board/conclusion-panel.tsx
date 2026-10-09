"use client";

import { useEffect, useRef, useState } from "react";
import {
  conclusionDraftProblem, conclusionDraftSchema, conclusionRequestSchema, conclusionSourceCharacters,
  MAX_CONCLUSION_TOTAL_CHARACTERS, type ConclusionDraft, type ConclusionRequest,
} from "@/lib/conclusion";
import {
  conclusionClusters, conclusionContext, conclusionExportMarkdown, conclusionFileName, conclusionMarkdown, conclusionRecord,
  setBoardConclusion, type ConclusionCluster, type ConclusionSelection,
} from "./board-conclusion";
import { scoreForIdea } from "./idea-voting";
import { MarkdownText } from "./markdown-text";
import type { Board, BoardConclusion } from "./model";
import "./conclusion-panel.css";

type ConclusionPreview = {
  selection: ConclusionSelection;
  fingerprint: string;
  request: ConclusionRequest;
  result: ConclusionDraft;
  model: string;
  generatedAt: string;
  title: string;
  markdown: string;
};

const emptySelection: ConclusionSelection = { ideaIds: [], clusterIds: [] };
// Matches the merge request budget: three provider attempts, the retry delay, and network time.
const REQUEST_TIMEOUT_MS = 96_000;

export function ConclusionTrigger({ open, hasConclusion, onToggle }: { open: boolean; hasConclusion: boolean; onToggle: () => void }) {
  return <button type="button" className="board-conclusion-trigger" aria-expanded={open} aria-controls="board-conclusion-panel"
    aria-label={hasConclusion ? "Conclusion, saved" : "Conclusion"} title={hasConclusion ? "Read the board conclusion" : "Wrap up the board with a conclusion"} onClick={onToggle}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.5h7.5L16 7v9.5H5z" /><path d="M12.5 3.5V7H16M7.5 10.5h6M7.5 13.5h4" /></svg>
    <span>Conclusion</span>{hasConclusion && <span className="board-conclusion-dot" aria-hidden="true" />}
  </button>;
}

// Stays mounted while closed, so closing the panel keeps an unsaved draft.
export function ConclusionPanel({ open, board, boardTitle, canWrite, authorName, onCommit, onClose }: {
  open: boolean;
  board: Board;
  boardTitle: string;
  canWrite: boolean;
  authorName: string;
  onCommit: (update: (board: Board) => Board) => boolean;
  onClose: () => void;
}) {
  const saved = board.conclusion ?? null;
  const [choosing, setChoosing] = useState(false);
  const [selection, setSelection] = useState<ConclusionSelection>(emptySelection);
  const [preview, setPreview] = useState<ConclusionPreview | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const clusters = conclusionClusters(board);
  const selected = conclusionContext(board, selection);
  const selectedProblem = selected ? conclusionRequestSchema.safeParse(selected.request).error?.issues[0]?.message : undefined;
  const clusteredIds = new Set(clusters.filter((cluster) => selection.clusterIds.includes(cluster.id)).flatMap((cluster) => cluster.noteIds));
  const previewStale = Boolean(preview && conclusionContext(board, preview.selection)?.fingerprint !== preview.fingerprint);

  function cancelRequest() {
    sequence.current += 1;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
  }

  function toggle(kind: keyof ConclusionSelection, id: string) {
    setError("");
    setSelection((current) => ({ ...current, [kind]: current[kind].includes(id) ? current[kind].filter((item) => item !== id) : [...current[kind], id] }));
  }

  async function generate(target: ConclusionSelection) {
    const context = conclusionContext(board, target);
    const problem = context ? conclusionRequestSchema.safeParse(context.request).error?.issues[0]?.message : "Choose at least one idea or cluster with text.";
    if (!context || problem) { setError(problem ?? "Choose at least one idea or cluster with text."); return; }
    cancelRequest();
    const request = new AbortController();
    controller.current = request;
    const current = ++sequence.current;
    const timeout = window.setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/conclusion", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal, body: JSON.stringify(context.request),
      });
      const payload: unknown = await response.json();
      if (current !== sequence.current) return;
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string" ? payload.error : "The AI could not draft a conclusion.");
      const body = payload as { result?: unknown; model?: unknown; generatedAt?: unknown };
      const parsed = conclusionDraftSchema.safeParse(body.result);
      if (!parsed.success || typeof body.model !== "string" || typeof body.generatedAt !== "string" || conclusionDraftProblem(parsed.data, context.request)) {
        throw new Error("The AI returned a conclusion that doesn't match the selected cards. Try again.");
      }
      setPreview({
        selection: target, fingerprint: context.fingerprint, request: context.request, result: parsed.data, model: body.model, generatedAt: body.generatedAt,
        title: parsed.data.title, markdown: conclusionMarkdown(parsed.data, context.request),
      });
      setEditing(false); setChoosing(false);
    } catch (caught) {
      if (current !== sequence.current) return;
      setError(request.signal.aborted ? "The conclusion request timed out. Try again." : caught instanceof Error ? caught.message : "The AI could not draft a conclusion.");
    } finally {
      window.clearTimeout(timeout);
      if (current === sequence.current) { setBusy(false); controller.current = null; }
    }
  }

  function keep() {
    if (!preview || !preview.title.trim() || !preview.markdown.trim()) { setError("Give the conclusion a title and text."); return; }
    if (conclusionContext(board, preview.selection)?.fingerprint !== preview.fingerprint) {
      setError("A selected note, cluster, link, or the goal changed. Regenerate before keeping this conclusion."); return;
    }
    if (saved && !window.confirm(`Replace the current conclusion, “${saved.title}”? The current one will be removed.`)) return;
    const record = conclusionRecord(preview, preview, authorName, new Date().toISOString());
    const committed = onCommit((current) => conclusionContext(current, preview.selection)?.fingerprint === preview.fingerprint
      ? setBoardConclusion(current, record) : current);
    if (!committed) { setError("The conclusion couldn't be saved. A selected card may have changed, or you may not have edit access."); return; }
    setPreview(null); setSelection(emptySelection); setEditing(false); setError(""); setNotice("Conclusion kept.");
  }

  function discard() {
    cancelRequest();
    setPreview(null); setEditing(false); setError("");
  }

  async function copyExport(conclusion: BoardConclusion) {
    try {
      await navigator.clipboard.writeText(conclusionExportMarkdown(conclusion, boardTitle));
      setNotice("Copied the conclusion as Markdown.");
    } catch {
      setNotice("Copy failed. Use Download .md instead.");
    }
  }

  function downloadExport(conclusion: BoardConclusion) {
    const url = URL.createObjectURL(new Blob([conclusionExportMarkdown(conclusion, boardTitle)], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = conclusionFileName(boardTitle);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice("Downloaded the conclusion.");
  }

  const heading = preview ? "Conclusion preview" : choosing ? "Choose what to conclude" : "Board conclusion";
  return <div id="board-conclusion-panel" className="board-merge-panel board-conclusion-panel" role="dialog" aria-modal="false" aria-label={heading}>
    <div className="board-merge-panel-head"><div><span className="board-eyebrow">{preview ? `${preview.request.notes.length} IDEAS USED` : "WRAP UP"}</span><h2>{heading}</h2></div>
      <button type="button" aria-label="Close conclusion" onClick={onClose}>×</button></div>
    <div className="board-merge-preview-content">
      {preview ? <>
        {previewStale && <p className="board-error" role="alert">A selected note, cluster, link, or the goal changed. Regenerate before keeping this conclusion.</p>}
        {saved && <p className="board-conclusion-note" role="note">Keeping this replaces “{saved.title}”.</p>}
        {editing ? <div className="board-merge-edit-fields">
          <label>Title<input value={preview.title} maxLength={120} onChange={(event) => setPreview({ ...preview, title: event.target.value })} /></label>
          <label>Conclusion (Markdown)<textarea value={preview.markdown} rows={18} maxLength={20_000} onChange={(event) => setPreview({ ...preview, markdown: event.target.value })} /></label>
        </div> : <article className="board-conclusion-body">
          <h3>{preview.title}</h3>
          <MarkdownText>{preview.markdown}</MarkdownText>
        </article>}
        <p className="board-conclusion-meta">AI draft from {preview.model}. Check it against the cards before keeping it.</p>
      </> : choosing ? <ConclusionChooser board={board} clusters={clusters} selection={selection} clusteredIds={clusteredIds} busy={busy} onToggle={toggle} />
        : saved ? <SavedConclusion conclusion={saved} />
          : <div className="board-conclusion-empty">
            <p>A conclusion wraps up the board. Choose the ideas and clusters that matter, and the AI drafts themes, key ideas, open questions, and next steps from them. You edit the draft before keeping it.</p>
            {!canWrite && <p>No conclusion has been kept yet. Only participants who can edit this board can create one.</p>}
          </div>}
      {choosing && !preview && selected && <p className="board-conclusion-meta">
        {selected.request.notes.length} idea{selected.request.notes.length === 1 ? "" : "s"} selected
        {selected.request.relationships.length ? `, with ${selected.request.relationships.length} link${selected.request.relationships.length === 1 ? "" : "s"} between them` : ""}.
        {" "}{conclusionSourceCharacters(selected.request.notes).toLocaleString()} of {MAX_CONCLUSION_TOTAL_CHARACTERS.toLocaleString()} characters.
      </p>}
      {choosing && !preview && selectedProblem && <p className="board-error">{selectedProblem}</p>}
      {error && <p className="board-error" role="alert">{error}</p>}
      {notice && <p className="board-conclusion-notice" role="status">{notice}</p>}
    </div>
    <div className="board-merge-actions">
      {preview ? <>
        <button type="button" onClick={discard}>Discard</button>
        <button type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Preview" : "Edit"}</button>
        <button type="button" disabled={busy} onClick={() => void generate(preview.selection)}>{busy ? "Generating…" : "Regenerate"}</button>
        <button type="button" disabled={busy} onClick={() => { setSelection(preview.selection); setPreview(null); setChoosing(true); setError(""); }}>Change selection</button>
        <button type="button" className="primary" disabled={busy || previewStale || !canWrite || !preview.title.trim() || !preview.markdown.trim()} onClick={keep}>Keep conclusion</button>
      </> : choosing ? <>
        <button type="button" onClick={() => { cancelRequest(); setChoosing(false); setError(""); }}>Cancel</button>
        {(selection.ideaIds.length > 0 || selection.clusterIds.length > 0) && <button type="button" onClick={() => setSelection(emptySelection)}>Clear</button>}
        <button type="button" className="primary" disabled={busy || !selected || Boolean(selectedProblem)} onClick={() => void generate(selection)}>{busy ? "Generating…" : "Generate conclusion"}</button>
      </> : <>
        {saved && <button type="button" onClick={() => void copyExport(saved)}>Copy Markdown</button>}
        {saved && <button type="button" onClick={() => downloadExport(saved)}>Download .md</button>}
        {canWrite && <button type="button" className="primary" onClick={() => { setChoosing(true); setNotice(""); setError(""); }}>{saved ? "New conclusion" : "Choose ideas"}</button>}
      </>}
    </div>
  </div>;

}

function ConclusionChooser({ board, clusters, selection, clusteredIds, busy, onToggle }: {
  board: Board;
  clusters: ConclusionCluster[];
  selection: ConclusionSelection;
  clusteredIds: Set<string>;
  busy: boolean;
  onToggle: (kind: keyof ConclusionSelection, id: string) => void;
}) {
  return <div className="board-conclusion-chooser">
    {clusters.length > 0 && <fieldset>
      <legend>Clusters</legend>
      {board.clusterSnapshot?.stale && <p className="board-conclusion-note">These clusters are from an earlier Organize. Run Organize again to refresh them.</p>}
      {clusters.map((cluster) => <label key={cluster.id} className="board-conclusion-option">
        <input type="checkbox" checked={selection.clusterIds.includes(cluster.id)} disabled={busy} onChange={() => onToggle("clusterIds", cluster.id)} />
        <span><strong>{cluster.name}</strong><small>{cluster.noteIds.length} idea{cluster.noteIds.length === 1 ? "" : "s"}</small></span>
      </label>)}
    </fieldset>}
    <fieldset>
      <legend>Ideas</legend>
      {board.ideas.length === 0 && <p className="board-conclusion-note">Add ideas to the board first.</p>}
      {board.ideas.map((idea) => {
        const inCluster = clusteredIds.has(idea.id);
        const upvotes = scoreForIdea(board.votes, idea.id);
        return <label key={idea.id} className="board-conclusion-option">
          <input type="checkbox" checked={inCluster || selection.ideaIds.includes(idea.id)} disabled={busy || inCluster} onChange={() => onToggle("ideaIds", idea.id)} />
          <span><strong>{idea.title.trim() || "Untitled idea"}</strong>
            <small>{idea.author?.trim() || "Unknown contributor"}{idea.merge ? " · Merged" : ""}{inCluster ? " · In a selected cluster" : ""}</small></span>
          {upvotes > 0 && <span className="board-conclusion-upvotes" title={`${upvotes} upvote${upvotes === 1 ? "" : "s"}`} aria-label={`${upvotes} upvote${upvotes === 1 ? "" : "s"}`}>▲ {upvotes}</span>}
        </label>;
      })}
    </fieldset>
  </div>;
}

function SavedConclusion({ conclusion }: { conclusion: BoardConclusion }) {
  const { request } = conclusion;
  const clustered = new Set(request.clusters.flatMap((cluster) => cluster.noteIds));
  const others = request.notes.filter((note) => !clustered.has(note.id));
  const noteName = (id: string) => {
    const note = request.notes.find((item) => item.id === id);
    return note ? `${note.title || "Untitled idea"} (${note.author})` : null;
  };
  return <article className="board-conclusion-body">
    <h3>{conclusion.title}</h3>
    <p className="board-conclusion-meta">Kept by {conclusion.keptBy} on {new Date(conclusion.keptAt).toLocaleString()}</p>
    <MarkdownText>{conclusion.markdown}</MarkdownText>
    <details className="board-merge-disclosure">
      <summary>Sources ({request.notes.length})</summary>
      <div className="board-conclusion-sources">
        {request.clusters.map((cluster) => <section key={cluster.id}><h4>Cluster: {cluster.name}</h4>
          <ul>{cluster.noteIds.flatMap((id) => noteName(id) ?? []).map((name, index) => <li key={`${cluster.id}-${index}`}>{name}</li>)}</ul></section>)}
        {others.length > 0 && <section><h4>{request.clusters.length ? "Other selected ideas" : "Selected ideas"}</h4>
          <ul>{others.map((note) => <li key={note.id}>{note.title || "Untitled idea"} ({note.author})</li>)}</ul></section>}
        <p>These are the cards as they were when the conclusion was generated.</p>
      </div>
    </details>
  </article>;
}
