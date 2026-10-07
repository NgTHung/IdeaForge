import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, test } from 'node:test';
import { connectionRequestSchema, validConnectionReferences } from '../src/lib/connections.ts';
import { suggestConnections } from '../src/lib/connection-suggestions.ts';
import { connectionStore } from '../src/lib/connection-store.ts';
import { ConnectionError } from '../src/lib/connection-errors.ts';
import { localCandidatePairs } from '../src/lib/local-connection-candidates.ts';
import { classifyPairs, relationOptions } from '../src/lib/jev.ts';
import { explainConnection } from '../src/lib/connection-explanation.ts';

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('@/') ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context);
} });
const { POST } = await import('../src/app/api/connections/route.ts');
const { POST: EXPLAIN } = await import('../src/app/api/connections/explain/route.ts');
const payload = connectionRequestSchema.parse({ goal: 'Help students study', cards: [{ id: 'a', text: 'Study partners' }, { id: 'b', text: 'Daily challenges' }] });
const explanationInput = { goal: payload.goal, sources: payload.cards, type: 'synergy' };
const explanation = { supported: true, explanation: 'Mocked explanation', condition: null };
const variables = ['TYPESAFE_API_KEY', 'JEV_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODEL'];
let saved, values, reservations, calls;
beforeEach((t) => {
  saved = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  variables.forEach((key) => delete process.env[key]);
  process.env.TYPESAFE_API_KEY = 'jev-test-secret'; process.env.GEMINI_API_KEY = 'gemini-test-secret';
  values = new Map(); reservations = []; calls = [];
  t.mock.method(connectionStore, 'get', async (keys) => new Map(keys.filter((key) => values.has(key)).map((key) => [key, values.get(key)])));
  t.mock.method(connectionStore, 'put', async (entries) => { entries.forEach(({ key, value }) => values.set(key, value)); });
  t.mock.method(connectionStore, 'reserve', async (...args) => { reservations.push(args); });
  t.mock.method(console, 'error', () => {});
});
afterEach(() => {
  for (const key of variables) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
});
const request = (body) => new Request('http://test/api/connections', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
function decisionResponse(body, relation = 'synergy', usefulness = 0.9) {
  const answers = {};
  for (let index = 0; index < body.state.pairs.length; index++) {
    answers[`relation_${index}`] = { type: 'choice', choice: relation, probabilities: Object.fromEntries(relationOptions.map((option) => [option, option === relation ? 1 : 0])), confidence: 1 };
    answers[`useful_${index}`] = { type: 'noul', noul: usefulness };
  }
  return { model: 'jev-1.13.0', answers };
}
function jev(t, relation = 'synergy', usefulness = 0.9, mutate = (value) => value) {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(String(url), 'https://api.typesafe.ai/v1/systemone', 'Automatic suggestions must not call Google');
    const body = JSON.parse(init.body); calls.push(body);
    assert.equal(init.headers.Authorization, 'Bearer jev-test-secret');
    return Response.json(mutate(decisionResponse(body, relation, usefulness)));
  });
}
function gemini(t, result = explanation, status = 200) {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(String(url).includes('generateContent'));
    calls.push(JSON.parse(init.body));
    return status === 200 ? Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }) : Response.json({ error: { code: status, message: 'secret-provider-detail' } }, { status });
  });
}

test('invalid JSON, duplicate cards, invalid links and oversized text never call a provider', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Must not call provider'));
  for (const input of ['{', {}, { ...payload, goal: ' ' }, { ...payload, cards: [payload.cards[0], payload.cards[0]] }, { ...payload, cards: Array(51).fill(payload.cards[0]) }, { ...payload, cards: [{ id: 'a', text: 'x'.repeat(4001) }, payload.cards[1]] }, { ...payload, existingLinks: [{ sourceId: 'a', targetId: 'missing' }] }]) assert.equal((await POST(request(input))).status, 400);
});

test('local candidates are deterministic, exclude existing links, and contain distinct valid endpoints', () => {
  const input = { ...payload, cards: [...payload.cards, { id: 'c', text: 'Study partner matching' }], existingLinks: [{ sourceId: 'b', targetId: 'a' }] };
  const pairs = localCandidatePairs(input);
  assert.deepEqual(pairs, localCandidatePairs({ ...input, cards: [...input.cards].reverse() }));
  assert.equal(pairs.length, 2);
  assert.ok(pairs.every(({ a, b }) => a.id !== b.id && !(a.id === 'a' && b.id === 'b')));
});

test('automatic suggestions call Jev only, return ungenerated explanations, and preserve reverse extends', async (t) => {
  jev(t, 'b_extends_a');
  const response = await POST(request(payload));
  assert.equal(response.status, 200);
  const { result } = await response.json();
  assert.equal(calls.length, 1); assert.equal(reservations.length, 1); assert.equal(reservations[0][0], 'jev');
  assert.equal(result.suggestions[0].sourceId, 'b'); assert.equal(result.suggestions[0].targetId, 'a');
  assert.equal(result.suggestions[0].type, 'extends'); assert.equal(result.suggestions[0].explanation, '');
  assert.equal(result.suggestions[0].condition, null);
  assert.ok(validConnectionReferences(result, [{ sourceId: 'a', targetId: 'b' }]));
});

test('missing Jev key never falls back to Gemini', async (t) => {
  delete process.env.TYPESAFE_API_KEY;
  t.mock.method(globalThis, 'fetch', () => assert.fail('No provider calls without Jev key'));
  const response = await POST(request(payload));
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'jev_missing_key');
  assert.equal(reservations.length, 0);
});

test('no relationship, ambiguity, and low usefulness do not force suggestions', async (t) => {
  for (const [relation, usefulness, expected] of [['none', 0.9, 'none'], ['unclear', 0.9, 'needs_clarification'], ['synergy', 0.1, 'none']]) {
    values.clear(); jev(t, relation, usefulness);
    const result = await suggestConnections(payload);
    assert.equal(result.status, expected); assert.deepEqual(result.suggestions, []);
  }
});

test('malformed probabilities, answer IDs and out-of-range scores are rejected without retries', async (t) => {
  for (const mutate of [
    (result) => ({ ...result, answers: {} }),
    (result) => ({ ...result, answers: { ...result.answers, invented: {} } }),
    (result) => { result.answers.relation_0.choice = 'invented'; return result; },
    (result) => { result.answers.relation_0.probabilities.synergy = 0.2; return result; },
    (result) => { result.answers.useful_0.noul = 2; return result; },
  ]) {
    values.clear(); jev(t, 'synergy', 0.9, mutate);
    const previous = calls.length;
    const response = await POST(request(payload));
    assert.equal(response.status, 502); assert.equal((await response.json()).code, 'jev_invalid_output');
    assert.equal(calls.length, previous + 1);
  }
});

test('Jev overload does not retry or fall back and provider details stay private', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => { calls.push(url); return Response.json({ error: 'jev-test-secret' }, { status: 429 }); });
  const response = await POST(request(payload));
  assert.equal(response.status, 503); assert.equal(calls.length, 1);
  assert.ok(!JSON.stringify(await response.json()).includes('jev-test-secret'));
});

test('identical board requests and concurrent callers reuse one classification', async (t) => {
  jev(t);
  const results = await Promise.all([suggestConnections(payload), suggestConnections(payload)]);
  assert.deepEqual(results[0], results[1]);
  await suggestConnections({ ...payload, cards: [...payload.cards].reverse() });
  assert.equal(calls.length, 1); assert.equal(reservations.length, 1);
});

test('editing one card reuses unrelated pair judgments; changing goal invalidates them', async (t) => {
  jev(t);
  const input = { ...payload, cards: [...payload.cards, { id: 'c', text: 'Study groups' }] };
  await suggestConnections(input);
  await suggestConnections({ ...input, cards: input.cards.map((card) => card.id === 'c' ? { ...card, text: 'Study groups with mentors' } : card) });
  assert.equal(calls[0].state.pairs.length, 3); assert.equal(calls[1].state.pairs.length, 2);
  assert.ok(calls[1].state.pairs.every(({ a, b }) => a.id === 'c' || b.id === 'c'));
  await suggestConnections({ ...input, goal: 'New goal' });
  assert.equal(calls[2].state.pairs.length, 3);
});

test('model version changes invalidate cached judgments', async (t) => {
  jev(t); await suggestConnections(payload);
  process.env.JEV_MODEL = 'jev-other-version'; await suggestConnections(payload);
  assert.equal(calls.length, 2);
});

test('50-card boards use one bounded batch and at most three suggestions; repeat visits do not scan more', async (t) => {
  jev(t);
  const input = { ...payload, cards: Array.from({ length: 50 }, (_, index) => ({ id: `card-${index}`, text: `Study approach ${index}` })) };
  const result = await suggestConnections(input);
  assert.ok(calls[0].state.pairs.length <= 24); assert.ok(Buffer.byteLength(JSON.stringify(calls[0])) <= 48_000);
  assert.equal(result.suggestions.length, 3); assert.ok(result.remainingPairs > 0);
  await suggestConnections(input); assert.equal(calls.length, 1);
});

test('large multilingual cards remain within the Jev input byte limit', async (t) => {
  jev(t);
  const result = await suggestConnections({ ...payload, cards: Array.from({ length: 8 }, (_, index) => ({ id: String(index), text: 'Học '.repeat(1000) })) });
  assert.ok(Buffer.byteLength(JSON.stringify(calls[0])) <= 48_000); assert.ok(result.reviewedPairs > 0);
});

test('all-linked boards skip all providers', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('No provider needed'));
  const result = await suggestConnections({ ...payload, existingLinks: [{ sourceId: 'a', targetId: 'b' }] });
  assert.equal(result.status, 'none'); assert.equal(reservations.length, 0);
});

test('budget rejection happens before provider access and communicates retry timing', async (t) => {
  t.mock.method(connectionStore, 'reserve', async () => { throw new ConnectionError('budget_exhausted', 'Daily allowance exhausted.', 429, 120); });
  t.mock.method(globalThis, 'fetch', () => assert.fail('Budget must block provider'));
  const response = await POST(request(payload));
  assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '120');
});

test('explicit explanation calls Gemini once and reuses its cached answer', async (t) => {
  gemini(t);
  const response = await EXPLAIN(request(explanationInput));
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).result, explanation);
  await explainConnection(explanationInput);
  assert.equal(calls.length, 1); assert.deepEqual(reservations.map(([kind]) => kind), ['explanation']);
  assert.equal(calls[0].generationConfig.maxOutputTokens, 1500);
});

test('explanation cache respects source text, goal, type and direction', async (t) => {
  gemini(t);
  await explainConnection(explanationInput);
  for (const input of [
    { ...explanationInput, goal: 'Changed' },
    { ...explanationInput, sources: [{ ...payload.cards[0], text: 'Changed' }, payload.cards[1]] },
    { ...explanationInput, type: 'extends' },
    { ...explanationInput, sources: [...payload.cards].reverse() },
  ]) await explainConnection(input);
  assert.equal(calls.length, 5);
});

test('explanation overload makes one attempt despite a configured Gemini fallback', async (t) => {
  process.env.GEMINI_FALLBACK_MODEL = 'fallback'; gemini(t, explanation, 503);
  const response = await EXPLAIN(request(explanationInput));
  assert.equal(response.status, 503); assert.equal(calls.length, 1); assert.equal(reservations.length, 1);
});

test('Gemini can reject a wrong classification and conflicts require a supported condition', async (t) => {
  gemini(t, { supported: false, explanation: 'These notes do not support a conflict.', condition: null });
  assert.equal((await explainConnection({ ...explanationInput, type: 'conflict' })).supported, false);
  values.clear(); gemini(t, explanation);
  assert.equal((await EXPLAIN(request({ ...explanationInput, type: 'conflict' }))).status, 502);
});

test('invalid explanation requests do not reserve or call providers', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Invalid request'));
  for (const input of ['{', {}, { ...explanationInput, sources: [payload.cards[0], payload.cards[0]] }]) assert.equal((await EXPLAIN(request(input))).status, 400);
  assert.equal(reservations.length, 0);
});

test('direct oversized Jev calls are rejected before the provider', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Oversized request'));
  await assert.rejects(() => classifyPairs('Goal', Array(24).fill({ a: { id: 'a', text: 'x'.repeat(4000) }, b: { id: 'b', text: 'y'.repeat(4000) } })), (error) => error.code === 'jev_input_limit');
});
