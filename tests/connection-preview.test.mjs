import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptConnection, canAcceptConnection, connectionInputKey } from '../src/features/board/connection-preview.ts';

const ideas = ['a', 'b'].map((id) => ({ id, title: id, content: `Content ${id}`, position: { x: 0, y: 0 }, pinned: false, parentIds: [] }));
const board = { ideas, relationships: [] };
const preview = { id: 'preview', sourceId: 'a', targetId: 'b', type: 'conflict', explanation: 'A conflict', condition: 'Only one approach is allowed', sources: ideas.map(({ id, title, content }) => ({ id, title, content })) };

test('acceptance saves edited explanation, condition and direction while preserving ideas', () => {
  const edited = { ...preview, sourceId: 'b', targetId: 'a', explanation: 'Edited explanation' };
  const result = acceptConnection(board, edited);
  assert.equal(result.ideas, ideas);
  assert.deepEqual(result.relationships, [{ id: 'preview', source: 'b', target: 'a', type: 'conflict', explanation: 'Edited explanation', condition: preview.condition }]);
  assert.deepEqual(board.relationships, []);
});

test('mutation rejects stale content, stale titles, deleted cards, and invalid source snapshots', () => {
  for (const current of [
    { ...board, ideas: ideas.map((idea) => idea.id === 'a' ? { ...idea, content: 'Changed' } : idea) },
    { ...board, ideas: ideas.map((idea) => idea.id === 'b' ? { ...idea, title: 'Changed' } : idea) },
    { ...board, ideas: ideas.slice(0, 1) },
  ]) assert.equal(acceptConnection(current, preview), current);
  assert.equal(acceptConnection(board, { ...preview, sources: [] }), board);
  assert.equal(acceptConnection(board, { ...preview, targetId: 'missing' }), board);
});

test('concurrent acceptance of the same pair cannot create duplicate links', () => {
  const accepted = acceptConnection(board, preview);
  assert.equal(acceptConnection(accepted, { ...preview, id: 'other-browser', sourceId: 'b', targetId: 'a' }), accepted);
});

test('conflicts require a condition and every suggestion requires an explanation', () => {
  assert.equal(canAcceptConnection(board, { ...preview, condition: ' ' }), false);
  assert.equal(canAcceptConnection(board, { ...preview, explanation: ' ' }), false);
});

test('moving, pinning, reordering and accepting do not change the request key; text and goal do', () => {
  const key = connectionInputKey('Goal', ideas);
  assert.equal(connectionInputKey('Goal', [...ideas].reverse().map((idea) => ({ ...idea, position: { x: 100, y: 50 }, pinned: true }))), key);
  assert.equal(connectionInputKey('Goal', acceptConnection(board, preview).ideas), key);
  assert.notEqual(connectionInputKey('Changed goal', ideas), key);
  assert.notEqual(connectionInputKey('Goal', ideas.map((idea) => ({ ...idea, content: 'Edited' }))), key);
});
