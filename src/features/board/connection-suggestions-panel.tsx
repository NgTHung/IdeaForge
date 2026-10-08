'use client';

import { useEffect, useState } from 'react';
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
};

export function ConnectionSuggestionsPanel({ board, suggestions, onBoardChange, minimized = false, authorName }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState(0);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(0), 4_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const isExpanded = expanded && !minimized;
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
  return <aside className="connection-suggestions" aria-label="Suggested links">
    <header><button type="button" aria-expanded={isExpanded} onClick={() => { if (!minimized) setExpanded(!expanded); }}>Suggested Links{previews.length > 0 ? ` (${previews.length})` : ''} <span aria-hidden="true">{isExpanded ? '−' : '+'}</span></button></header>
    {isExpanded && <div className="connection-suggestions-body">
      <div className="connection-suggestions-controls"><label><input type="checkbox" checked={suggestions.enabled} onChange={(event) => suggestions.setEnabled(event.target.checked)} /> Automatic</label><button type="button" disabled={busy || board.ideas.length < 2} onClick={suggestions.refresh}>Refresh links</button></div>
      {(busy || suggestions.cooldown || noGoodLinks) && <p className={`connection-suggestions-status${!busy && !suggestions.cooldown && noGoodLinks ? ' is-empty-guidance' : ''}`} role="status">{busy ? (suggestions.loading ? 'Finding useful links…' : 'Waiting for your edits to settle…') : suggestions.cooldown ? 'Another analysis of this board started recently. Suggestions refresh within 30 seconds.' : 'Add more ideas!'}</p>}
      {notice > 0 && <div key={notice} className="connection-accepted-notice" role="status" aria-live="polite"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg><span>Connection accepted.</span><button type="button" aria-label="Dismiss confirmation" onClick={() => setNotice(0)}>×</button></div>}
      {suggestions.error && <p role="alert" className="board-error">{suggestions.error}</p>}
      {!noGoodLinks && suggestions.result?.question && <p className="connection-question">{suggestions.result.question}</p>}
      {previews.map((preview, index) => <ConnectionSuggestionCard key={preview.id} preview={preview} index={index} board={board} goal={suggestions.goal} boardId={suggestions.boardId} onUpdate={suggestions.update} onAccept={accept} onDismiss={dismiss} />)}
      {suggestions.result?.status === 'suggestions' && !previews.length && <p>No links left to review.</p>}
      {Boolean(suggestions.result?.remainingPairs) && <p className="connection-suggestions-hint">{suggestions.result?.reviewedPairs} candidate pairs reviewed. Additional pairs are deferred until the board changes.</p>}
    </div>}
  </aside>;
}
