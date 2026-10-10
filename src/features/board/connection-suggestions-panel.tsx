'use client';

import { useEffect, useState } from 'react';
import { BoardIcon } from './board-icons';
import { acceptConnection, canAcceptConnection, dismissConnection, excludedConnectionPairs, type ConnectionPreview } from './connection-preview';
import { connectionPairKey } from '@/lib/connections';
import type { Board } from './model';
import { ConnectionSuggestionCard } from './connection-suggestion-card';
import type { useConnectionSuggestions } from './use-connection-suggestions';
import './connection-suggestions.css';

type Props = {
  board: Board;
  suggestions: ReturnType<typeof useConnectionSuggestions>;
  onBoardChange: (update: (board: Board) => Board) => void;
  minimized?: boolean;
  authorName?: string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  showTrigger?: boolean;
};

export function ConnectionSuggestionsPanel({ board, suggestions, onBoardChange, minimized = false, authorName, expanded, onExpandedChange, showTrigger = true }: Props) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const [notice, setNotice] = useState(0);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(0), 4_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const isExpanded = (expanded ?? localExpanded) && !minimized;
  function toggleExpanded() {
    const next = !isExpanded;
    if (onExpandedChange) onExpandedChange(next);
    else setLocalExpanded(next);
  }
  const excluded = new Set(excludedConnectionPairs(board).map(({ sourceId, targetId }) => connectionPairKey(sourceId, targetId)));
  const previews = suggestions.previews.filter((preview) => !excluded.has(connectionPairKey(preview.sourceId, preview.targetId)));
  const busy = suggestions.loading || suggestions.waiting;
  const noGoodLinks = board.ideas.length < 2 || suggestions.result?.status === 'none' || suggestions.result?.status === 'needs_clarification';
  function accept(preview: ConnectionPreview) {
    if (!canAcceptConnection(board, preview)) return;
    onBoardChange((current) => acceptConnection(current, preview, authorName));
    suggestions.remove(preview.id);
    setNotice((current) => current + 1);
  }
  function dismiss(id: string) {
    const preview = suggestions.previews.find((item) => item.id === id);
    if (preview) onBoardChange((current) => dismissConnection(current, preview));
    suggestions.remove(id);
  }
  if (!showTrigger && !isExpanded) return null;
  return <aside className="connection-suggestions" aria-label="Suggested links">
    {showTrigger ? <header><button type="button" aria-expanded={isExpanded} onClick={() => { if (!minimized) toggleExpanded(); }}>Suggested Links{previews.length > 0 ? ` (${previews.length})` : ''} <span aria-hidden="true">{isExpanded ? '−' : '+'}</span></button></header>
      : isExpanded && <header className="connection-suggestions-heading"><strong>Suggested Links</strong><button type="button" aria-label="Close suggested links" onClick={() => toggleExpanded()}><BoardIcon name="close" /></button></header>}
    {isExpanded && <div className="connection-suggestions-body">
      <div className="connection-suggestions-controls"><label><input type="checkbox" checked={suggestions.enabled} onChange={(event) => suggestions.setEnabled(event.target.checked)} /> Automatic</label><button type="button" disabled={busy || board.ideas.length < 2} onClick={suggestions.refresh}>Refresh links</button></div>
      {(busy || suggestions.cooldown || noGoodLinks) && <p className={`connection-suggestions-status${!busy && !suggestions.cooldown && noGoodLinks ? ' is-empty-guidance' : ''}`} role="status">{busy ? (suggestions.loading ? 'Finding useful links…' : 'Waiting for your edits to settle…') : suggestions.cooldown ? 'Suggestions refresh in 30 seconds.' : board.ideas.length < 2 ? 'Add at least two ideas to get suggestions.' : suggestions.result?.explanation}</p>}
      {notice > 0 && <div key={notice} className="connection-accepted-notice" role="status" aria-live="polite"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg><span>Link accepted.</span><button type="button" aria-label="Dismiss confirmation" onClick={() => setNotice(0)}>×</button></div>}
      {suggestions.error && <p role="alert" className="board-error">{suggestions.error}</p>}
      {!busy && !suggestions.cooldown && board.ideas.length >= 2 && suggestions.result?.status === 'needs_clarification' && <p className="connection-question">{suggestions.result.question}</p>}
      {previews.map((preview, index) => <ConnectionSuggestionCard key={preview.id} preview={preview} index={index} board={board} goal={suggestions.goal} boardId={suggestions.boardId} onUpdate={suggestions.update} onAccept={accept} onDismiss={dismiss} />)}
      {suggestions.result?.status === 'suggestions' && !previews.length && <p>No links left to review.</p>}
      {Boolean(suggestions.result?.remainingPairs) && <p className="connection-suggestions-hint">More suggestions after the next edit.</p>}
    </div>}
  </aside>;
}
