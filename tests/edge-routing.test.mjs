import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDEA_CARD_SIZE } from '../src/features/board/model.ts';
import { routeCanvasEdges } from '../src/features/board/edge-routing.ts';

const idea = (id, x, y) => ({ id, title: id, content: '', position: { x, y }, pinned: false, parentIds: [] });

test('a label on a clear horizontal link sits on the link and stays visible', () => {
  const routes = routeCanvasEdges([idea('a', 0, 0), idea('b', 800, 0)], [{ id: 'link', source: 'a', target: 'b', label: 'Supports' }]);
  const route = routes.get('link');
  assert.equal(route.curved, false);
  assert.equal(route.labelCrowded, false);
  assert.equal(route.label.y, IDEA_CARD_SIZE.height / 2);
  assert.ok(route.label.x > IDEA_CARD_SIZE.width && route.label.x < 800);
});
