import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, test } from 'node:test';
import { connectionRequestSchema, connectionResultSchema, validConnectionReferences } from '../src/lib/connections.ts';
import { selectConnectionCandidates } from '../src/lib/connection-suggestions.ts';

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('@/') ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context);
} });
const { POST } = await import('../src/app/api/connections/route.ts');
const payload = { goal: 'Help students study', cards: [{ id: 'a', text: 'Study partners' }, { id: 'b', text: 'Daily challenges' }] };
const link = { sourceId: 'a', targetId: 'b', type: 'synergy', explanation: 'Mocked explanation', condition: null };
const result = { status: 'suggestions', explanation: 'Mocked overview', question: null, suggestions: [link] };
const variables = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODEL', 'GEMINI_EMBEDDING_MODEL', 'GEMINI_EMBEDDING_FALLBACK_MODEL'];
let saved;
beforeEach((t) => {
  saved = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  variables.forEach((key) => delete process.env[key]);
  process.env.GEMINI_API_KEY = 'test-only-secret';
  globalThis.__IDEAFORGE_EMBEDDING_CACHE_V2__?.clear();
  t.mock.method(console, 'error', () => {});
});
afterEach(() => {
  for (const key of variables) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});
const request = (body) => new Request('http://localhost/api/connections', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
function provider(t, output) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url: String(url), body });
    if (String(url).includes('batchEmbedContents')) return Response.json({ embeddings: body.requests.map((_, index) => ({ values: Array.from({ length: 768 }, (_, dimension) => dimension === index ? 1 : 0) })) });
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] });
  });
  return calls;
}

test('rejects malformed, oversized, empty, duplicate, and dangling input before provider calls', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Must not call provider'));
  for (const input of ['{', {}, { ...payload, goal: ' ' }, { ...payload, goal: 'x'.repeat(501) },
    { ...payload, cards: [payload.cards[0]] }, { ...payload, cards: Array(51).fill(payload.cards[0]) },
    { ...payload, cards: [payload.cards[0], payload.cards[0]] },
    { ...payload, cards: [{ id: 'a', text: ' ' }, payload.cards[1]] },
    { ...payload, cards: [{ id: 'a', text: 'x'.repeat(4001) }, payload.cards[1]] },
    { ...payload, existingLinks: [{ sourceId: 'a', targetId: 'missing' }] }]) {
    assert.equal((await POST(request(input))).status, 400);
  }
});

test('missing credentials returns a safe actionable error', async (t) => {
  delete process.env.GEMINI_API_KEY;
  t.mock.method(globalThis, 'fetch', () => assert.fail('Must not call provider'));
  const response = await POST(request(payload));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'missing_key');
});

test('uses embeddings then structured Gemini generation and returns board-wide suggestions', async (t) => {
  const calls = provider(t, result);
  const response = await POST(request(payload));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { result });
  assert.equal(calls.length, 2);
  const generation = calls[1].body;
  assert.equal(generation.generationConfig.responseMimeType, 'application/json');
  assert.ok(generation.generationConfig.responseJsonSchema);
  const context = JSON.parse(generation.contents[0].parts[0].text);
  assert.deepEqual(context.cards, payload.cards);
  assert.equal(context.candidatePairs.length, 1);
});

test('accepts either extends direction and an explicit conflict condition', async (t) => {
  for (const suggestion of [{ ...link, sourceId: 'b', targetId: 'a', type: 'extends' }, { ...link, type: 'conflict', condition: 'Only one approach can be funded.' }]) {
    provider(t, { ...result, suggestions: [suggestion] });
    const response = await POST(request(payload));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).result.suggestions, [suggestion]);
  }
});

test('supports no useful relationship and clarification without fabricating links', async (t) => {
  for (const status of ['none', 'needs_clarification']) {
    const output = { status, explanation: 'Mocked reason', question: status === 'needs_clarification' ? 'Which students?' : null, suggestions: [] };
    provider(t, output);
    const response = await POST(request(payload));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).result, output);
  }
});

test('rejects invented IDs, self links, repeated pairs, missing conditions and inconsistent states', async (t) => {
  for (const output of [
    { ...result, suggestions: [{ ...link, targetId: 'invented' }] },
    { ...result, suggestions: [{ ...link, targetId: 'a' }] },
    { ...result, suggestions: [link, { ...link, sourceId: 'b', targetId: 'a' }] },
    { ...result, suggestions: Array(4).fill(link) },
    { ...result, suggestions: [{ ...link, type: 'conflict' }] },
    { ...result, status: 'none' }, { ...result, question: 'Unexpected question?' },
    { ...result, status: 'needs_clarification', suggestions: [], question: null },
  ]) {
    provider(t, output);
    const response = await POST(request(payload));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, 'invalid_output');
  }
});

test('excludes already linked pairs in either direction', async (t) => {
  const calls = provider(t, result);
  const response = await POST(request({ ...payload, existingLinks: [{ sourceId: 'b', targetId: 'a' }] }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.status, 'none');
  assert.ok(calls.every((call) => call.url.includes('batchEmbedContents')));
});

test('candidate selection includes nearest neighbors and three different distant themes', () => {
  const cards = Array.from({ length: 12 }, (_, i) => ({ id: String(i).padStart(2, '0'), text: `Note ${i}` }));
  const scores = [];
  const group = (index) => index < 5 ? 0 : Math.floor((index - 5) / 2) + 1;
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) scores.push({ sourceId: cards[i].id, targetId: cards[j].id, score: group(i) === group(j) ? 0.9 : 0.1 });
  const input = connectionRequestSchema.parse({ goal: 'Test', cards });
  const candidates = selectConnectionCandidates(input, { scores }, '00');
  assert.deepEqual(candidates.slice(0, 4).map((card) => card.id), ['01', '02', '03', '04']);
  assert.deepEqual(candidates.slice(4).map((card) => card.id), ['05', '07', '09']);
  assert.equal(new Set(candidates.map((card) => card.id)).size, 7);
  assert.ok(!candidates.some((card) => card.id === '00'));
});

test('response reference validation restricts links to supplied candidate pairs', () => {
  assert.equal(validConnectionReferences(result, [{ sourceId: 'a', targetId: 'c' }]), false);
  assert.equal(connectionResultSchema.safeParse({ ...result, suggestions: [{ ...link, condition: 'Not a conflict' }] }).success, false);
});
