'use client';

import { useState } from 'react';
import { connectionPairKey } from '@/lib/connections';
import { acceptConnection, type ConnectionPreview } from './connection-preview';
import type { Board } from './model';
import { ConnectionSuggestionCard } from './connection-suggestion-card';
import type { useConnectionSuggestions } from './use-connection-suggestions';
import './connection-suggestions.css';

type Props = {
  board: Board;
  suggestions: ReturnType<typeof useConnectionSuggestions>;
  onBoardChange: (update: (board: Board) => Board) => void;
};

export function ConnectionSuggestionsPanel({ board, suggestions, onBoardChange }: Props) {
  const [expanded, setExpanded] = useState(true);
  const previews = suggestions.previews.filter((preview) => !board.relationships.some((link) => connectionPairKey(link.source, link.target) === connectionPairKey(preview.sourceId, preview.targetId)));
  const busy = suggestions.loading || suggestions.waiting;
  function accept(preview: ConnectionPreview) {
    onBoardChange((current) => acceptConnection(current, preview));
    suggestions.dismiss(preview.id);
  }
  return <aside className="connection-suggestions" aria-label="Relationship suggestions">
    <header><button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Suggested connections{previews.length > 0 ? ` (${previews.length})` : ''} <span aria-hidden="true">{expanded ? '−' : '+'}</span></button></header>
    {expanded && <div className="connection-suggestions-body">
      <div className="connection-suggestions-controls"><label><input type="checkbox" checked={suggestions.enabled} onChange={(event) => suggestions.setEnabled(event.target.checked)} /> Automatic</label><button type="button" disabled={busy || board.ideas.length < 2} onClick={suggestions.refresh}>Refresh suggestions</button></div>
      <p className="connection-suggestions-status" role="status">{!suggestions.enabled ? 'Automatic suggestions paused.' : busy ? (suggestions.loading ? 'Finding useful connections…' : 'Waiting for your edits to settle…') : board.ideas.length < 2 ? 'Add at least two ideas to find connections.' : suggestions.result?.explanation || 'Connections appear here as your ideas develop.'}</p>
      {suggestions.error && <p role="alert" className="board-error">{suggestions.error}</p>}
      {suggestions.result?.question && <p className="connection-question">{suggestions.result.question}</p>}
      {previews.map((preview, index) => <ConnectionSuggestionCard key={preview.id} preview={preview} index={index} board={board} goal={suggestions.goal} boardId={suggestions.boardId} onUpdate={suggestions.update} onAccept={accept} onDismiss={suggestions.dismiss} />)}
      {suggestions.result?.status === 'suggestions' && !previews.length && <p>No suggestions left to review.</p>}
      {Boolean(suggestions.result?.remainingPairs) && <p className="connection-suggestions-hint">{suggestions.result?.reviewedPairs} candidate pairs reviewed. Additional pairs are deferred until the board changes.</p>}
      <p className="connection-suggestions-hint">Automatic analysis uses Jev. Gemini runs only when you request an explanation here.</p>
      <p className="connection-suggestions-hint">AI suggestions need your review. Only accepted connections are saved.</p>
    </div>}
  </aside>;
}
