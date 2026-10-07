import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDEA_CARD_SIZE } from '../src/features/board/model.ts';
import { NODE_CLEARANCE, resolveNodeOverlaps, withResolvedNodeOverlaps } from '../src/features/board/node-layout.ts';

const idea = (id, x, y, pinned = false) => ({ id, title: id, content: '', position: { x, y }, pinned, parentIds: [] });

function gap(first, second) {
  const horizontal = Math.max(first.x - (second.x + IDEA_CARD_SIZE.width), second.x - (first.x + IDEA_CARD_SIZE.width));
  const vertical = Math.max(first.y - (second.y + IDEA_CARD_SIZE.height), second.y - (first.y + IDEA_CARD_SIZE.height));
  return Math.max(horizontal, vertical);
}

test('overlapping cards end at least the clearance apart', () => {
  const positions = resolveNodeOverlaps([idea('a', 0, 0), idea('b', 10, 10), idea('c', 20, 0)]);
  const placed = [...positions.values()];
  for (const [index, first] of placed.entries()) {
    for (const second of placed.slice(index + 1)) assert.ok(gap(first, second) >= NODE_CLEARANCE, `${JSON.stringify(first)} and ${JSON.stringify(second)} are too close`);
  }
});

test('pinned cards never move, even when they overlap each other', () => {
  const ideas = [idea('a', 0, 0, true), idea('b', 10, 10, true), idea('c', 5, 5)];
  const positions = resolveNodeOverlaps(ideas);
  assert.deepEqual(positions.get('a'), { x: 0, y: 0 });
  assert.deepEqual(positions.get('b'), { x: 10, y: 10 });
  assert.ok(gap(positions.get('c'), positions.get('a')) >= NODE_CLEARANCE);
  assert.ok(gap(positions.get('c'), positions.get('b')) >= NODE_CLEARANCE);
});

test('an unpinned card in fixedIds stays and pushes the other card away', () => {
  const positions = resolveNodeOverlaps([idea('a', 0, 0), idea('b', 10, 10)], {}, new Set(['b']));
  assert.deepEqual(positions.get('b'), { x: 10, y: 10 });
  assert.ok(gap(positions.get('a'), positions.get('b')) >= NODE_CLEARANCE);
});

test('a board without overlaps is returned unchanged so callers can skip the write', () => {
  const board = { ideas: [idea('a', 0, 0), idea('b', IDEA_CARD_SIZE.width + NODE_CLEARANCE, 0)], relationships: [] };
  assert.equal(withResolvedNodeOverlaps(board), board);
  const crowded = { ...board, ideas: [idea('a', 0, 0), idea('b', 10, 0)] };
  assert.notEqual(withResolvedNodeOverlaps(crowded), crowded);
});
