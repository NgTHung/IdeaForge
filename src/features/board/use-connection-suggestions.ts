'use client';

import { useEffect, useRef, useState } from 'react';
import { connectionRequestSchema, connectionResultSchema, type ConnectionResult } from '@/lib/connections';
import { usePathname } from 'next/navigation';
import { CONNECTION_DEBOUNCE_MS, CONNECTION_TIMEOUT_MS } from '@/lib/connection-policy';
import { createIdeaId } from './id';
import { connectionInputKey, type ConnectionPreview, type IdeaSnapshot } from './connection-preview';
import type { Board } from './model';

type State = { key: string; loading: boolean; error: string; result: ConnectionResult | null; previews: ConnectionPreview[] };
const emptyState: State = { key: '', loading: false, error: '', result: null, previews: [] };

export function useConnectionSuggestions(board: Board, goal: string, editing: boolean) {
  const pathname = usePathname();
  const boardId = pathname.match(/^\/board\/([0-9a-f-]{36})$/i)?.[1];
  const [enabled, setEnabled] = useState(true);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State>(emptyState);
  const inputKey = connectionInputKey(goal, board.ideas);
  const current = useRef(board);
  useEffect(() => { current.current = board; }, [board]);

  useEffect(() => {
    if (!enabled || editing) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      const snapshot = JSON.parse(inputKey) as { goal: string; cards: IdeaSnapshot[] };
      const cards = snapshot.cards.map((idea) => ({ id: idea.id, text: [idea.title, idea.content].filter(Boolean).join('\n') }));
      if (cards.length < 2) { setState({ ...emptyState, key: inputKey }); return; }
      const parsed = connectionRequestSchema.safeParse({ boardId, goal: snapshot.goal, cards, existingLinks: current.current.relationships.map((link) => ({ sourceId: link.source, targetId: link.target })) });
      if (!parsed.success) {
        setState({ ...emptyState, key: inputKey, error: 'Use a board goal and 2–50 ideas, each with at most 4,000 characters including its title, for automatic suggestions.' });
        return;
      }
      setState({ ...emptyState, key: inputKey, loading: true });
      timeout = setTimeout(() => controller.abort('timeout'), CONNECTION_TIMEOUT_MS + 15_000);
      try {
        const response = await fetch('/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data), signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) {
          if (payload.code === 'cooldown' && !controller.signal.aborted) retry = setTimeout(() => setRevision((value) => value + 1), Math.max(1, Math.min(60, Number(payload.retryAfter) || 30)) * 1000);
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not suggest connections. Try again.');
        }
        const result = connectionResultSchema.parse(payload.result);
        const previews = result.suggestions.map((suggestion) => ({ ...suggestion, id: createIdeaId(), sources: snapshot.cards.filter((card) => card.id === suggestion.sourceId || card.id === suggestion.targetId) }));
        if (!controller.signal.aborted) setState({ key: inputKey, loading: false, error: '', result, previews });
      } catch (error) {
        if (!controller.signal.aborted || controller.signal.reason === 'timeout') setState({ ...emptyState, key: inputKey, error: controller.signal.reason === 'timeout' ? 'Connection suggestions timed out. Try again.' : error instanceof Error ? error.message : 'Could not suggest connections. Try again.' });
      } finally {
        clearTimeout(timeout);
      }
    }, CONNECTION_DEBOUNCE_MS);
    return () => { clearTimeout(timer); clearTimeout(timeout); clearTimeout(retry); controller.abort(); };
  }, [inputKey, enabled, revision, editing, boardId]);

  const visible = state.key === inputKey ? state : emptyState;
  return {
    ...visible, enabled, goal, boardId, waiting: enabled && !editing && state.key !== inputKey && board.ideas.length >= 2,
    loading: enabled && !editing && visible.loading,
    setEnabled,
    refresh: () => { setEnabled(true); setRevision((value) => value + 1); },
    dismiss: (id: string) => setState((previous) => ({ ...previous, previews: previous.previews.filter((preview) => preview.id !== id) })),
    update: (id: string, patch: Partial<ConnectionPreview>, expected?: ConnectionPreview) => setState((previous) => ({ ...previous, previews: previous.previews.map((preview) => preview.id === id && (!expected || JSON.stringify(preview) === JSON.stringify(expected)) ? { ...preview, ...patch } : preview) })),
  };
}
