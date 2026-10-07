import 'server-only';

import { connectionResultSchema, type ConnectionRequest } from './connections.ts';
import { ConnectionError } from './connection-errors.ts';
import { connectionHash, connectionStore, type ConnectionStore } from './connection-store.ts';
import { CONNECTION_COOLDOWN_MS, CONNECTION_MAX_INPUT_BYTES, CONNECTION_MAX_PAIRS, CONNECTION_RULES_VERSION } from './connection-policy.ts';
import { classifyPairs, jevModel, jevPayload, pairJudgmentSchema, type PairJudgment } from './jev.ts';
import { localCandidatePairs } from './local-connection-candidates.ts';

const inFlight = new Map<string, Promise<ReturnType<typeof connectionResultSchema.parse>>>();

export function connectionScope(request: { boardId?: string; goal: string }) {
  return request.boardId ?? `local:${connectionHash(request.goal)}`;
}

export async function suggestConnections(request: ConnectionRequest, store: ConnectionStore = connectionStore) {
  const workKey = connectionHash({ kind: 'board-result', version: CONNECTION_RULES_VERSION, ...request, cards: [...request.cards].sort((a, b) => a.id.localeCompare(b.id)), excludedPairs: [...request.excludedPairs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), model: jevModel() });
  const cached = connectionResultSchema.safeParse((await store.get([workKey])).get(workKey));
  if (cached.success) return cached.data;
  if (store === connectionStore && inFlight.has(workKey)) return inFlight.get(workKey)!;
  const work = analyze(request, store);
  if (store === connectionStore) inFlight.set(workKey, work);
  try {
    const result = await work;
    await store.put([{ key: workKey, value: result }]);
    return result;
  }
  finally { if (store === connectionStore) inFlight.delete(workKey); }
}

async function analyze(request: ConnectionRequest, store: ConnectionStore) {
  const pairs = localCandidatePairs(request);
  const keys = pairs.map((pair) => connectionHash({ version: CONNECTION_RULES_VERSION, scope: connectionScope(request), model: jevModel(), goal: request.goal, pair }));
  const cached = await store.get(keys);
  const judgments = new Map<string, PairJudgment>();
  for (const [key, value] of cached) {
    const parsed = pairJudgmentSchema.safeParse(value);
    if (parsed.success) judgments.set(key, parsed.data);
  }
  const missing = pairs.map((pair, index) => ({ pair, key: keys[index] })).filter(({ key }) => !judgments.has(key));
  const batch: typeof missing = [];
  for (const entry of missing) {
    if (batch.length >= CONNECTION_MAX_PAIRS) break;
    if (Buffer.byteLength(JSON.stringify(jevPayload(request.goal, [...batch, entry].map(({ pair }) => pair)))) <= CONNECTION_MAX_INPUT_BYTES) batch.push(entry);
  }
  if (batch.length) {
    if (!process.env.TYPESAFE_API_KEY?.trim()) throw new ConnectionError('jev_missing_key', 'Automatic suggestions need TYPESAFE_API_KEY on the server. You can still connect ideas manually.');
    await store.reserve('jev', connectionScope(request), CONNECTION_COOLDOWN_MS);
    const results = await classifyPairs(request.goal, batch.map(({ pair }) => pair));
    await store.put(batch.map(({ key }, index) => ({ key, value: results[index] })));
    batch.forEach(({ key }, index) => judgments.set(key, results[index]));
  }
  const reviewed = pairs.flatMap((pair, index) => judgments.has(keys[index]) ? [{ pair, judgment: judgments.get(keys[index])! }] : []);
  const suggestions = reviewed.filter(({ judgment }) => !['none', 'unclear'].includes(judgment.relation) && judgment.confidence >= 0.4 && judgment.usefulness >= 0.6)
    .sort((a, b) => b.judgment.usefulness - a.judgment.usefulness || b.judgment.confidence - a.judgment.confidence).slice(0, 3)
    .map(({ pair: { a, b }, judgment }) => ({
      sourceId: judgment.relation === 'b_extends_a' ? b.id : a.id, targetId: judgment.relation === 'b_extends_a' ? a.id : b.id,
      type: judgment.relation === 'synergy' ? 'synergy' : judgment.relation === 'conflict' ? 'conflict' : 'extends',
      explanation: '', condition: null, model: judgment.model, confidence: judgment.confidence, usefulness: judgment.usefulness,
    }));
  const unclear = reviewed.some(({ judgment }) => judgment.relation === 'unclear' || judgment.confidence < 0.4);
  return connectionResultSchema.parse({
    status: suggestions.length ? 'suggestions' : unclear ? 'needs_clarification' : 'none',
    explanation: suggestions.length ? 'Possible links found. Review each one before accepting.' : unclear ? 'Some candidate pairs need more detail before a relationship can be suggested.' : pairs.length ? 'No useful relationship was identified among the pairs reviewed.' : 'Every pair is already linked, merged, or dismissed.',
    question: !suggestions.length && unclear ? 'Review prompt: what would these ideas do, and what constraints must they satisfy?' : null,
    suggestions, reviewedPairs: reviewed.length, remainingPairs: pairs.length - reviewed.length,
  });
}
