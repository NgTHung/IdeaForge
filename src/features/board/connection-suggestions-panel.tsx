'use client';

import { useState } from 'react';
import { connectionPairKey } from '@/lib/connections';
import { acceptConnection, canAcceptConnection, type ConnectionPreview } from './connection-preview';
import { relationshipLabels, type Board, type RelationshipType } from './model';
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
      {previews.map((preview, index) => <form key={preview.id} className="connection-suggestion" aria-label={`Suggestion ${index + 1}`} onSubmit={(event) => { event.preventDefault(); accept(preview); }}>
        <p className="connection-pair"><strong>{board.ideas.find((idea) => idea.id === preview.sourceId)?.title || 'Deleted idea'}</strong><span>{preview.type === 'extends' ? ' extends ' : ' ↔ '}</span><strong>{board.ideas.find((idea) => idea.id === preview.targetId)?.title || 'Deleted idea'}</strong></p>
        <label>Relationship<select value={preview.type} onChange={(event) => { const type = event.target.value as RelationshipType; suggestions.update(preview.id, { type, condition: type === 'conflict' ? '' : null }); }}>{Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {preview.type === 'extends' && <button type="button" onClick={() => suggestions.update(preview.id, { sourceId: preview.targetId, targetId: preview.sourceId })}>Reverse direction</button>}
        <label>Explanation<textarea rows={3} required maxLength={1000} value={preview.explanation} onChange={(event) => suggestions.update(preview.id, { explanation: event.target.value })} /></label>
        {preview.type === 'conflict' && <label>When do these ideas conflict?<textarea rows={2} required maxLength={600} value={preview.condition ?? ''} onChange={(event) => suggestions.update(preview.id, { condition: event.target.value })} /></label>}
        <div className="connection-suggestion-actions"><button type="button" onClick={() => suggestions.dismiss(preview.id)}>Dismiss</button><button className="primary" type="submit" disabled={!canAcceptConnection(board, preview)}>Accept connection</button></div>
      </form>)}
      {suggestions.result?.status === 'suggestions' && !previews.length && <p>No suggestions left to review.</p>}
      <p className="connection-suggestions-hint">AI suggestions need your review. Only accepted connections are saved.</p>
    </div>}
  </aside>;
}
