'use client';

import { useEffect, useRef, useState } from 'react';
import { connectionExplanationSchema } from '@/lib/connections';
import { canAcceptConnection, type ConnectionPreview } from './connection-preview';
import { relationshipLabels, type Board, type RelationshipType } from './model';

type Props = {
  preview: ConnectionPreview; index: number; board: Board; goal: string; boardId?: string;
  onUpdate: (id: string, patch: Partial<ConnectionPreview>, expected?: ConnectionPreview) => void;
  onAccept: (preview: ConnectionPreview) => void; onDismiss: (id: string) => void;
};

export function ConnectionSuggestionCard({ preview, index, board, goal, boardId, onUpdate, onAccept, onDismiss }: Props) {
  const [generation, setGeneration] = useState({ key: '', loading: false, error: '' });
  const active = useRef<AbortController | null>(null);
  const key = JSON.stringify({ goal, preview });
  useEffect(() => () => { active.current?.abort(); active.current = null; }, [key]);
  const busy = generation.key === key && generation.loading;
  const error = generation.key === key ? generation.error : '';
  const change = (patch: Partial<ConnectionPreview>) => {
    active.current?.abort(); active.current = null;
    onUpdate(preview.id, { ...patch, explanationSource: 'user' });
  };
  async function explain() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), 40_000);
    setGeneration({ key, loading: true, error: '' });
    try {
      const sources = [preview.sourceId, preview.targetId].map((id) => {
        const source = preview.sources.find((card) => card.id === id)!;
        return { id, text: [source.title, source.content].filter(Boolean).join('\n') };
      });
      const response = await fetch('/api/connections/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boardId, goal, sources, type: preview.type }), signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not explain this connection.');
      const result = connectionExplanationSchema.parse(payload.result);
      if (!result.supported) throw new Error(result.explanation);
      if (!controller.signal.aborted) {
        onUpdate(preview.id, { explanation: result.explanation, condition: preview.condition?.trim() ? preview.condition : result.condition, explanationSource: 'ai' }, preview);
        setGeneration({ key, loading: false, error: '' });
      }
    } catch (error) {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setGeneration({ key, loading: false, error: controller.signal.reason === 'timeout' ? 'Explanation timed out. Try again.' : error instanceof Error ? error.message : 'Could not explain this connection.' });
    } finally { clearTimeout(timeout); if (active.current === controller) active.current = null; }
  }
  return <form className="connection-suggestion" aria-label={`Suggestion ${index + 1}`} onSubmit={(event) => { event.preventDefault(); onAccept(preview); }}>
    <p className="connection-pair"><strong>{board.ideas.find((idea) => idea.id === preview.sourceId)?.title || 'Deleted idea'}</strong><span className="connection-pair-connector">{preview.type === 'extends' ? 'extends' : '↔'}{'\u00a0'}</span><strong>{board.ideas.find((idea) => idea.id === preview.targetId)?.title || 'Deleted idea'}</strong></p>
    <div className="connection-suggestion-fields">
      <label className="connection-suggestion-field">Relationship<select value={preview.type} onChange={(event) => change({ type: event.target.value as RelationshipType, condition: event.target.value === 'conflict' ? preview.condition : null, explanation: preview.explanationSource === 'ai' ? '' : preview.explanation })}>{Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {preview.explanation && <p className="connection-explanation">{preview.explanation}</p>}
      {error && <p role="alert" className="board-error">{error}</p>}
      {preview.type === 'conflict' && <label className="connection-suggestion-field">When do these ideas conflict?<textarea rows={2} required maxLength={600} value={preview.condition ?? ''} onChange={(event) => change({ condition: event.target.value })} /></label>}
    </div>
    <div className="connection-suggestion-actions">
      <div className="connection-suggestion-utilities">
        {!preview.explanation.trim() && <button type="button" disabled={busy} onClick={() => void explain()}><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 2 1.5 5.5L17 9l-5.5 1.5L10 16l-1.5-5.5L3 9l5.5-1.5L10 2Z" /><path d="m16 15 .5 1.5L18 17l-1.5.5L16 19l-.5-1.5L14 17l1.5-.5L16 15Z" /></svg>{busy ? 'Explaining…' : 'Explain with AI'}</button>}
        {preview.type === 'extends' && <button type="button" onClick={() => change({ sourceId: preview.targetId, targetId: preview.sourceId, explanation: preview.explanationSource === 'ai' ? '' : preview.explanation, condition: null })}><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h13m-3-3 3 3-3 3M17 14H4m3-3-3 3 3 3" /></svg>Reverse direction</button>}
      </div>
      <div className="connection-suggestion-primary-actions"><button type="button" onClick={() => onDismiss(preview.id)}>Dismiss</button><button className="primary" type="submit" disabled={!canAcceptConnection(board, preview)}>Accept connection</button></div>
    </div>
  </form>;
}
