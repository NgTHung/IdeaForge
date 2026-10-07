import { connectionPairKey, type ConnectionRequest } from './connections.ts';

export type CandidatePair = { a: ConnectionRequest['cards'][number]; b: ConnectionRequest['cards'][number] };
const stopWords = new Set('a an the and or to for of in on is are be with this that students student idea ideas và là của cho một các những với'.split(' '));

function terms(text: string): Map<string, number> {
  const words = (text.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => word.length > 1 && !stopWords.has(word));
  const counts = new Map<string, number>();
  for (const term of [...words, ...words.slice(1).map((word, index) => `${words[index]} ${word}`)]) counts.set(term, (counts.get(term) ?? 0) + 1);
  return counts;
}

export function localCandidatePairs(request: ConnectionRequest): CandidatePair[] {
  const cards = [...request.cards].sort((a, b) => a.id.localeCompare(b.id));
  const counts = cards.map((card) => terms(card.text));
  const frequencies = new Map<string, number>();
  for (const count of counts) for (const term of count.keys()) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  const vectors = counts.map((count) => {
    const vector = new Map([...count].map(([term, tf]) => [term, (1 + Math.log(tf)) * (1 + Math.log((cards.length + 1) / (frequencies.get(term)! + 1)))]));
    const norm = Math.hypot(...vector.values());
    return new Map([...vector].map(([term, value]) => [term, norm ? value / norm : 0]));
  });
  const scores = vectors.map((a) => vectors.map((b) => [...a].reduce((sum, [term, value]) => sum + value * (b.get(term) ?? 0), 0)));
  const linked = new Set(request.excludedPairs.map(({ sourceId, targetId }) => connectionPairKey(sourceId, targetId)));
  const neighbors = cards.map((card, index) => {
    const remaining = cards.map((_, i) => i).filter((i) => i !== index && !linked.has(connectionPairKey(card.id, cards[i].id)))
      .sort((a, b) => scores[index][b] - scores[index][a] || a - b);
    const chosen = remaining.splice(0, 4);
    for (let i = 0; i < 3 && remaining.length; i++) {
      const overlap = (candidate: number) => Math.max(...[index, ...chosen].map((anchor) => scores[anchor][candidate]));
      remaining.sort((a, b) => overlap(a) - overlap(b) || a - b);
      chosen.push(remaining.shift()!);
    }
    return chosen;
  });
  const pairs = new Map<string, CandidatePair>();
  // Round-robin candidates prevent a bounded batch from serving only the first card.
  for (let rank = 0; rank < 7; rank++) for (let index = 0; index < cards.length; index++) {
    const target = neighbors[index][rank];
    if (target === undefined) continue;
    const [a, b] = [cards[index], cards[target]].sort((left, right) => left.id.localeCompare(right.id));
    pairs.set(connectionPairKey(a.id, b.id), { a, b });
  }
  return [...pairs.values()];
}
